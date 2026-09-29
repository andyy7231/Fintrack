import { FinancialParserProvider, MockAIProvider, GeminiAIProvider } from "./provider";
import { ParsedFinancialIntent } from "./schemas";
import { getJakartaDateString, parseIndonesianDate } from "./date.utils";
import { formatRupiah } from "./amount.utils";
import { IntentResolverService } from "./resolver.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";

// ─────────────────────────────────────────────────────────────
// Resolved action payload (passed to PendingActionService)
// ─────────────────────────────────────────────────────────────

export interface ResolvedActionPayload {
  intentType: "EXPENSE" | "INCOME" | "TRANSFER";
  amount: number;
  description: string;
  transactionDate: Date;
  accountId?: string;
  categoryId?: string | null;
  fromAccountId?: string;
  toAccountId?: string;
}

// ─────────────────────────────────────────────────────────────
// Parse workflow result (returned by FinancialParserService)
// ─────────────────────────────────────────────────────────────

export type ParseWorkflowResult =
  | {
      status: "READY_FOR_CONFIRMATION";
      /** Total number of actions that will be atomically committed on YA */
      actionCount: number;
      summaryText: string;
      confirmationPrompt: string;
      /** All resolved actions — stored together in one pending action record */
      actions: ResolvedActionPayload[];
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
   * Phase 5.1 change: the parser now resolves an entire BATCH of actions in
   * one pass, building a single confirmation message that covers all actions.
   * Execution remains atomic — either all succeed or all are rolled back.
   *
   * NEVER mutates the financial database directly.
   */
  async processFinancialText(
    text: string,
    userId: string
  ): Promise<ParseWorkflowResult> {
    try {
      // 1. Fetch user accounts and categories for context
      const [userAccounts, userCategories] = await Promise.all([
        AccountService.getAccounts(userId),
        CategoryService.getCategories(userId),
      ]);

      const currentDate = getJakartaDateString();

      // 2. Call AI Provider — returns ParsedFinancialBatch
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

      // 3. If the entire batch is a single UNKNOWN, ask for clarification
      if (rawIntents.length === 1 && rawIntents[0]?.intent === "UNKNOWN") {
        const unknown = rawIntents[0];
        return {
          status: "NEEDS_CLARIFICATION",
          clarificationText:
            unknown.clarificationQuestion ||
            "Saya belum dapat memahami rincian transaksi tersebut. Coba tulis seperti: 'Beli kopi 25 ribu' atau 'Gajian 5 juta'.",
        };
      }

      // 4. Resolve each action in the batch
      const resolvedActions: ResolvedActionPayload[] = [];
      const summaryLines: string[] = [];

      for (let i = 0; i < rawIntents.length; i++) {
        const intent: ParsedFinancialIntent = rawIntents[i]!;
        const actionNum = rawIntents.length > 1 ? `${i + 1}. ` : "";

        // Skip UNKNOWN items embedded in a multi-action batch — report them
        if (intent.intent === "UNKNOWN") {
          summaryLines.push(
            `${actionNum}⚠️ Satu item tidak dapat diparse: ${intent.clarificationQuestion || intent.reason}`
          );
          continue;
        }

        if (intent.intent === "TRANSFER") {
          const fromRes = await IntentResolverService.resolveAccount(
            userId,
            intent.fromAccountHint
          );
          const toRes = await IntentResolverService.resolveAccount(
            userId,
            intent.toAccountHint
          );

          if (fromRes.status !== "RESOLVED") {
            return {
              status: "NEEDS_CLARIFICATION",
              clarificationText: `Akun asal transfer "${intent.fromAccountHint || ""}" tidak ditemukan atau belum jelas. Sebutkan akun pengirim (contoh: dari BCA).`,
            };
          }

          if (toRes.status !== "RESOLVED") {
            return {
              status: "NEEDS_CLARIFICATION",
              clarificationText: `Akun tujuan transfer "${intent.toAccountHint || ""}" tidak ditemukan atau belum jelas. Sebutkan akun penerima (contoh: ke GoPay).`,
            };
          }

          if (fromRes.account.id === toRes.account.id) {
            return {
              status: "NEEDS_CLARIFICATION",
              clarificationText: "Akun asal dan akun tujuan transfer tidak boleh sama.",
            };
          }

          const transferDate = parseIndonesianDate(intent.transferDate);
          const fmtAmount = formatRupiah(intent.amount);

          resolvedActions.push({
            intentType: "TRANSFER",
            amount: intent.amount,
            description:
              intent.description ||
              `Transfer ${fromRes.account.name} ke ${toRes.account.name}`,
            transactionDate: transferDate,
            fromAccountId: fromRes.account.id,
            toAccountId: toRes.account.id,
          });

          summaryLines.push(
            `${actionNum}🔄 Transfer ${fmtAmount}\n   Dari: ${fromRes.account.name} → Ke: ${toRes.account.name}`
          );
          continue;
        }

        // EXPENSE | INCOME
        const accRes = await IntentResolverService.resolveAccount(
          userId,
          intent.accountHint
        );

        if (accRes.status !== "RESOLVED") {
          if (accRes.status === "AMBIGUOUS") {
            const names = accRes.accounts.map((a) => `• ${a.name}`).join("\n");
            return {
              status: "NEEDS_CLARIFICATION",
              clarificationText: `Ditemukan beberapa akun yang cocok. Mau pakai akun yang mana?\n${names}`,
            };
          }
          return {
            status: "NEEDS_CLARIFICATION",
            clarificationText: `Akun "${intent.accountHint || ""}" tidak ditemukan. Silakan sebutkan akun yang ingin digunakan.`,
          };
        }

        const catRes = await IntentResolverService.resolveCategory(
          userId,
          intent.intent,
          intent.categoryHint
        );

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

        resolvedActions.push({
          intentType: intent.intent,
          amount: intent.amount,
          description: intent.description,
          transactionDate: txDate,
          accountId: accRes.account.id,
          categoryId: resolvedCategoryId,
        });

        summaryLines.push(
          `${actionNum}${emoji} ${label} ${fmtAmount} — ${intent.description}\n   Kategori: ${categoryName} | Akun: ${accRes.account.name}`
        );
      }

      // 5. If nothing resolved (all UNKNOWN in mixed batch), ask for clarification
      if (resolvedActions.length === 0) {
        return {
          status: "NEEDS_CLARIFICATION",
          clarificationText:
            "Semua item dalam pesan tidak dapat diparsing. Coba tulis ulang, contoh: 'Beli kopi 25 ribu, beli bensin 50 ribu'.",
        };
      }

      // 6. Build confirmation message
      const actionCount = resolvedActions.length;
      const summaryText =
        actionCount === 1
          ? summaryLines.join("\n")
          : `📋 *${actionCount} transaksi akan dicatat:*\n\n${summaryLines.join("\n\n")}`;

      const confirmationPrompt =
        actionCount === 1
          ? `${summaryText}\n\nBalas *YA* untuk mencatat atau *BATAL* untuk membatalkan.`
          : `${summaryText}\n\nSemua ${actionCount} transaksi akan diproses sekaligus.\nBalas *YA* untuk mencatat semua atau *BATAL* untuk membatalkan.`;

      return {
        status: "READY_FOR_CONFIRMATION",
        actionCount,
        summaryText,
        confirmationPrompt,
        actions: resolvedActions,
      };
    } catch {
      return {
        status: "ERROR",
        errorText:
          "Maaf, terjadi kendala saat memproses pesan transaksi Anda. Coba tulis seperti: 'Beli kopi 25 ribu'.",
      };
    }
  }
}
