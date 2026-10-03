import { FinancialParserProvider, MockAIProvider, GeminiAIProvider } from "./provider";
import { ParsedFinancialIntent } from "./schemas";
import { getJakartaDateString, parseIndonesianDate } from "./date.utils";
import { formatRupiah } from "./amount.utils";
import { IntentResolverService } from "./resolver.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";

// ─────────────────────────────────────────────────────────────
// Resolved action payload types
// ─────────────────────────────────────────────────────────────

export interface ResolvedActionPayload {
  intentType: "EXPENSE" | "INCOME" | "TRANSFER" | "BUDGET_ALLOCATION";
  amount: number;
  description: string;
  transactionDate: Date;
  // EXPENSE / INCOME
  accountId?: string;
  categoryId?: string | null;
  // TRANSFER
  fromAccountId?: string;
  toAccountId?: string;
  // BUDGET_ALLOCATION
  budgetCategoryId?: string;
}

// ─────────────────────────────────────────────────────────────
// Parse workflow result types
// ─────────────────────────────────────────────────────────────

export type ParseWorkflowResult =
  | {
      status: "READY_FOR_CONFIRMATION";
      actionCount: number;
      summaryText: string;
      confirmationPrompt: string;
      actions: ResolvedActionPayload[];
    }
  | {
      /**
       * Phase 5.2: BALANCE_QUERY — read-only, no pending action, no confirmation.
       * The response text is built by parser and sent directly by message.service.
       */
      status: "BALANCE_QUERY";
      responseText: string;
    }
  | {
      status: "NEEDS_CLARIFICATION";
      clarificationText: string;
    }
  | {
      status: "ERROR";
      errorText: string;
    };

// ─────────────────────────────────────────────────────────────
// FinancialParserService
// ─────────────────────────────────────────────────────────────

export class FinancialParserService {
  private provider: FinancialParserProvider;

  constructor(provider?: FinancialParserProvider) {
    if (provider) {
      this.provider = provider;
    } else if (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY) {
      this.provider = new GeminiAIProvider();
    } else {
      this.provider = new MockAIProvider();
    }
  }

  /**
   * Parse inbound natural-language message and resolve ALL domain entities.
   *
   * Phase 5.1: multi-action batch + atomic execution
   * Phase 5.2: BUDGET_ALLOCATION + BALANCE_QUERY added
   *
   * NEVER mutates the financial database directly.
   */
  async processFinancialText(
    text: string,
    userId: string
  ): Promise<ParseWorkflowResult> {
    try {
      const [userAccounts, userCategories] = await Promise.all([
        AccountService.getAccounts(userId),
        CategoryService.getCategories(userId),
      ]);

      const currentDate = getJakartaDateString();

      const batch = await this.provider.parseFinancialMessage({
        text,
        currentDate,
        timezone: "Asia/Jakarta",
        context: {
          userAccounts: userAccounts.map((a) => a.name),
          userCategories: userCategories.map((c) => c.name),
        },
      });

      const { actions: rawIntents } = batch;

      // ── 1. Check if the entire batch is a single UNKNOWN ────────────────────
      if (rawIntents.length === 1 && rawIntents[0]?.intent === "UNKNOWN") {
        const unknown = rawIntents[0];
        return {
          status: "NEEDS_CLARIFICATION",
          clarificationText:
            unknown.clarificationQuestion ||
            "Saya belum dapat memahami rincian transaksi tersebut. Coba tulis seperti: 'Beli kopi 25 ribu' atau 'Gajian 5 juta'.",
        };
      }

      // ── 2. Check if the entire batch is a BALANCE_QUERY ─────────────────────
      if (rawIntents.length === 1 && rawIntents[0]?.intent === "BALANCE_QUERY") {
        const bq = rawIntents[0];
        return await this._handleBalanceQuery(userId, text, bq.accountHint ?? null);
      }

      // ── 3. Resolve mutation actions ──────────────────────────────────────────
      const resolvedActions: ResolvedActionPayload[] = [];
      const summaryLines: string[] = [];
      let idx = 0;

      for (const intent of rawIntents) {
        const i = rawIntents.length > 1 ? `${++idx}. ` : "";

        // BALANCE_QUERY embedded in a mixed batch — skip with note
        if (intent.intent === "BALANCE_QUERY") {
          summaryLines.push(`${i}ℹ️ Cek saldo (akan dijawab terpisah)`);
          continue;
        }

        // UNKNOWN items in mixed batch
        if (intent.intent === "UNKNOWN") {
          summaryLines.push(
            `${i}⚠️ Satu item tidak dapat diparsing: ${intent.clarificationQuestion || intent.reason}`
          );
          continue;
        }

        const result = await this._resolveIntent(userId, intent, i, currentDate);
        if (result.type === "CLARIFICATION") {
          return { status: "NEEDS_CLARIFICATION", clarificationText: result.text };
        }
        resolvedActions.push(result.payload);
        summaryLines.push(result.summaryLine);
      }

      if (resolvedActions.length === 0) {
        return {
          status: "NEEDS_CLARIFICATION",
          clarificationText:
            "Semua item dalam pesan tidak dapat diparsing. Coba tulis ulang, contoh: 'Beli kopi 25 ribu, budget makan 600k'.",
        };
      }

      const actionCount = resolvedActions.length;
      const summaryText =
        actionCount === 1
          ? summaryLines.join("\n")
          : `📋 *${actionCount} tindakan akan diproses:*\n\n${summaryLines.join("\n\n")}`;

      const confirmationPrompt =
        actionCount === 1
          ? `${summaryText}\n\nBalas *YA* untuk memproses atau *BATAL* untuk membatalkan.`
          : `${summaryText}\n\nSemua ${actionCount} tindakan akan diproses sekaligus.\nBalas *YA* untuk memproses semua atau *BATAL* untuk membatalkan.`;

      return {
        status: "READY_FOR_CONFIRMATION",
        actionCount,
        summaryText,
        confirmationPrompt,
        actions: resolvedActions,
      };
    } catch (error) {
      console.error("[FinancialParserService] Error in processFinancialText:", error);
      return {
        status: "ERROR",
        errorText: "Maaf, terjadi kendala saat memproses pesan transaksi Anda. Coba tulis seperti: 'Beli kopi 25 ribu'.",
      };
    }
  }

  // ─── Private helpers ───────────────────────────────────────

  /**
   * BALANCE_QUERY handler — read-only, uses AccountService.getAccountsWithBalances.
   * Detects if user is asking for "free cash" (unallocated) vs total balance.
   */
  private async _handleBalanceQuery(
    userId: string,
    originalText: string,
    accountHint: string | null
  ): Promise<ParseWorkflowResult> {
    const { isFreeCashQuery } = await import("@/services/ai/provider");
    const accountsWithBalances = await AccountService.getAccountsWithBalances(userId);
    const activeAccounts = accountsWithBalances.filter((a) => a.isActive);

    if (activeAccounts.length === 0) {
      return {
        status: "BALANCE_QUERY",
        responseText: "Anda belum memiliki akun keuangan aktif. Silakan tambahkan akun melalui dashboard FinTrack.",
      };
    }

    // Determine if user is asking for free cash vs total balance
    const askingForFreeCash = isFreeCashQuery(originalText);

    // Account-specific query
    if (accountHint) {
      const search = accountHint.toLowerCase().trim();
      const match = activeAccounts.find((a) => a.name.toLowerCase().includes(search));
      if (match) {
        const amount = askingForFreeCash ? (match.freeCash ?? match.currentBalance) : match.currentBalance;
        const label = askingForFreeCash ? "Uang Free (tersedia)" : "Saldo";
        return {
          status: "BALANCE_QUERY",
          responseText:
            `💰 ${label} ${match.name} Anda saat ini: *${formatRupiah(amount)}*`,
        };
      }
    }

    // Total balance or free cash across all active accounts
    if (askingForFreeCash) {
      const totalFree = activeAccounts.reduce((sum, a) => sum + (a.freeCash ?? a.currentBalance), 0);
      const lines = activeAccounts.map((a) => 
        `• ${a.name}: ${formatRupiah(a.freeCash ?? a.currentBalance)}`
      ).join("\n");

      return {
        status: "BALANCE_QUERY",
        responseText:
          `💵 Uang Free Anda saat ini: *${formatRupiah(totalFree)}*\n` +
          `(Uang yang bisa dipakai setelah dikurangi alokasi budget)\n\n` +
          `Rincian:\n${lines}`,
      };
    } else {
      // Total balance (including budget allocations)
      const total = activeAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
      const lines = activeAccounts.map((a) => `• ${a.name}: ${formatRupiah(a.currentBalance)}`).join("\n");

      return {
        status: "BALANCE_QUERY",
        responseText:
          `💰 Sisa uang Anda saat ini: *${formatRupiah(total)}*\n\nRincian:\n${lines}`,
      };
    }
  }

  /**
   * Resolve a single ParsedFinancialIntent to a ResolvedActionPayload.
   * Returns either a resolved payload+summaryLine or a clarification request.
   */
  private async _resolveIntent(
    userId: string,
    intent: ParsedFinancialIntent,
    prefix: string,
    currentDate: string
  ): Promise<
    | { type: "RESOLVED"; payload: ResolvedActionPayload; summaryLine: string }
    | { type: "CLARIFICATION"; text: string }
  > {
    // ── BUDGET_ALLOCATION ────────────────────────────────────────────────────────
    if (intent.intent === "BUDGET_ALLOCATION") {
      const catRes = await IntentResolverService.resolveBudgetCategory(
        userId,
        intent.categoryName
      );

      if (catRes.status !== "RESOLVED") {
        if (catRes.status === "AMBIGUOUS") {
          const names = catRes.categories.map((c) => `• ${c.name}`).join("\n");
          return {
            type: "CLARIFICATION",
            text: `Ditemukan beberapa kategori yang cocok untuk "${intent.categoryName}":\n${names}\nSebutkan nama kategori yang lebih spesifik.`,
          };
        }
        return {
          type: "CLARIFICATION",
          text: `Kategori budget "${intent.categoryName}" tidak ditemukan. Pastikan kategori sudah ada di FinTrack, atau gunakan nama kategori yang terdaftar.`,
        };
      }

      // RESOLVED
      const fmtAmount = formatRupiah(intent.amount);
      return {
        type: "RESOLVED",
        payload: {
          intentType: "BUDGET_ALLOCATION",
          amount: intent.amount,
          description: `Budget ${catRes.category.name}`,
          transactionDate: parseIndonesianDate(currentDate),
          budgetCategoryId: catRes.category.id,
        },
        summaryLine: `${prefix}📊 Budget ${catRes.category.name} ${fmtAmount}`,
      };
    }

    // ── TRANSFER ─────────────────────────────────────────────────────────────────
    if (intent.intent === "TRANSFER") {
      const fromRes = await IntentResolverService.resolveAccount(userId, intent.fromAccountHint);
      const toRes = await IntentResolverService.resolveAccount(userId, intent.toAccountHint);

      if (fromRes.status !== "RESOLVED") {
        return {
          type: "CLARIFICATION",
          text: `Akun asal transfer "${intent.fromAccountHint || ""}" tidak ditemukan. Sebutkan akun pengirim (contoh: dari BCA).`,
        };
      }
      if (toRes.status !== "RESOLVED") {
        return {
          type: "CLARIFICATION",
          text: `Akun tujuan transfer "${intent.toAccountHint || ""}" tidak ditemukan. Sebutkan akun penerima (contoh: ke GoPay).`,
        };
      }
      if (fromRes.account.id === toRes.account.id) {
        return { type: "CLARIFICATION", text: "Akun asal dan akun tujuan transfer tidak boleh sama." };
      }

      const transferDate = parseIndonesianDate(intent.transferDate);
      const fmtAmount = formatRupiah(intent.amount);
      return {
        type: "RESOLVED",
        payload: {
          intentType: "TRANSFER",
          amount: intent.amount,
          description: intent.description || `Transfer ${fromRes.account.name} ke ${toRes.account.name}`,
          transactionDate: transferDate,
          fromAccountId: fromRes.account.id,
          toAccountId: toRes.account.id,
        },
        summaryLine: `${prefix}🔄 Transfer ${fmtAmount}\n   Dari: ${fromRes.account.name} → Ke: ${toRes.account.name}`,
      };
    }

    // Guard: Only EXPENSE and INCOME proceed below
    if (intent.intent !== "EXPENSE" && intent.intent !== "INCOME") {
      return {
        type: "CLARIFICATION",
        text:
          intent.intent === "UNKNOWN"
            ? intent.clarificationQuestion || "Item tidak dapat dipahami."
            : "Format transaksi tidak valid.",
      };
    }

    // ── EXPENSE / INCOME ──────────────────────────────────────────────────────────
    const accRes = await IntentResolverService.resolveAccount(userId, intent.accountHint);
    if (accRes.status !== "RESOLVED") {
      if (accRes.status === "AMBIGUOUS") {
        const names = accRes.accounts.map((a) => `• ${a.name}`).join("\n");
        return { type: "CLARIFICATION", text: `Ditemukan beberapa akun yang cocok:\n${names}` };
      }
      return {
        type: "CLARIFICATION",
        text: `Akun "${intent.accountHint || ""}" tidak ditemukan. Silakan sebutkan akun yang ingin digunakan.`,
      };
    }

    const catRes = await IntentResolverService.resolveCategory(userId, intent.intent, intent.categoryHint);
    let resolvedCategoryId: string | null = null;
    let categoryName = "Tanpa Kategori";
    if (catRes.status === "RESOLVED") {
      resolvedCategoryId = catRes.category.id;
      categoryName = catRes.category.name;
    } else if (catRes.status === "AMBIGUOUS" && catRes.categories[0]) {
      resolvedCategoryId = catRes.categories[0].id;
      categoryName = catRes.categories[0].name;
    }

    const txDate = parseIndonesianDate(intent.transactionDate);
    const fmtAmount = formatRupiah(intent.amount);
    const emoji = intent.intent === "EXPENSE" ? "💸" : "💰";
    const label = intent.intent === "EXPENSE" ? "Pengeluaran" : "Pemasukan";

    return {
      type: "RESOLVED",
      payload: {
        intentType: intent.intent,
        amount: intent.amount,
        description: intent.description,
        transactionDate: txDate,
        accountId: accRes.account.id,
        categoryId: resolvedCategoryId,
      },
      summaryLine: `${prefix}${emoji} ${label} ${fmtAmount} — ${intent.description}\n   Kategori: ${categoryName} | Akun: ${accRes.account.name}`,
    };
  }
}
