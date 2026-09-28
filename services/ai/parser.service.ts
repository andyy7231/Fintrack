import { FinancialParserProvider, MockAIProvider } from "./provider";
import { ParsedFinancialIntent, financialIntentSchema } from "./schemas";
import { getJakartaDateString, parseIndonesianDate } from "./date.utils";
import { formatRupiah } from "./amount.utils";
import { IntentResolverService } from "./resolver.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";

export type ParseWorkflowResult =
  | {
      status: "READY_FOR_CONFIRMATION";
      intentType: "EXPENSE" | "INCOME" | "TRANSFER";
      summaryText: string;
      confirmationPrompt: string;
      payload: {
        amount: number;
        description: string;
        transactionDate: Date;
        accountId?: string;
        categoryId?: string | null;
        fromAccountId?: string;
        toAccountId?: string;
      };
    }
  | {
      status: "NEEDS_CLARIFICATION";
      clarificationText: string;
    }
  | {
      status: "ERROR";
      errorText: string;
    };

export class FinancialParserService {
  private provider: FinancialParserProvider;

  constructor(provider: FinancialParserProvider = new MockAIProvider()) {
    this.provider = provider;
  }

  /**
   * Parse inbound natural-language message and resolve domain entities.
   * NEVER mutates financial database directly.
   */
  async processFinancialText(
    text: string,
    userId: string
  ): Promise<ParseWorkflowResult> {
    try {
      // 1. Fetch user accounts and categories context
      const userAccounts = await AccountService.getAccounts(userId);
      const userCategories = await CategoryService.getCategories(userId);

      const currentDate = getJakartaDateString();

      // 2. Call AI Provider
      const rawIntent = await this.provider.parseFinancialMessage({
        text,
        currentDate,
        timezone: "Asia/Jakarta",
        context: {
          userAccounts: userAccounts.map((a) => a.name),
          userCategories: userCategories.map((c) => c.name),
        },
      });

      // 3. Strict schema validation
      const intent: ParsedFinancialIntent = financialIntentSchema.parse(rawIntent);

      // 4. Handle UNKNOWN intent or missing parameters
      if (intent.intent === "UNKNOWN") {
        return {
          status: "NEEDS_CLARIFICATION",
          clarificationText:
            intent.clarificationQuestion ||
            "Saya belum dapat memahami rincian transaksi tersebut. Coba tulis seperti: 'Beli kopi 25 ribu' atau 'Gajian 5 juta'.",
        };
      }

      // 5. Handle TRANSFER intent
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
            clarificationText: `Akun asal transfer "${intent.fromAccountHint || ""}" tidak ditemukan atau belum jelas. Silakan sebutkan akun pengirim (contoh: dari BCA).`,
          };
        }

        if (toRes.status !== "RESOLVED") {
          return {
            status: "NEEDS_CLARIFICATION",
            clarificationText: `Akun tujuan transfer "${intent.toAccountHint || ""}" tidak ditemukan atau belum jelas. Silakan sebutkan akun penerima (contoh: ke GoPay).`,
          };
        }

        if (fromRes.account.id === toRes.account.id) {
          return {
            status: "NEEDS_CLARIFICATION",
            clarificationText: "Akun asal dan akun tujuan transfer tidak boleh sama.",
          };
        }

        const transferDate = parseIndonesianDate(intent.transferDate);
        const formattedAmount = formatRupiah(intent.amount);

        const summaryText =
          `Transfer:\n` +
          `• Nominal: ${formattedAmount}\n` +
          `• Dari: ${fromRes.account.name}\n` +
          `• Ke: ${toRes.account.name}`;

        const confirmationPrompt =
          `Transfer ${formattedAmount} dari ${fromRes.account.name} ke ${toRes.account.name}?\n\n` +
          `Balas *YA* untuk melanjutkan atau *BATAL* untuk membatalkan.`;

        return {
          status: "READY_FOR_CONFIRMATION",
          intentType: "TRANSFER",
          summaryText,
          confirmationPrompt,
          payload: {
            amount: intent.amount,
            description: intent.description || `Transfer ${fromRes.account.name} ke ${toRes.account.name}`,
            transactionDate: transferDate,
            fromAccountId: fromRes.account.id,
            toAccountId: toRes.account.id,
          },
        };
      }

      // 6. Handle EXPENSE / INCOME intent
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
      } else if (catRes.status === "AMBIGUOUS") {
        // Can pick first or keep uncategorized
        if (catRes.categories[0]) {
          resolvedCategoryId = catRes.categories[0].id;
          categoryName = catRes.categories[0].name;
        }
      }

      const txDate = parseIndonesianDate(intent.transactionDate);
      const formattedAmount = formatRupiah(intent.amount);
      const label = intent.intent === "EXPENSE" ? "Pengeluaran" : "Pemasukan";

      const summaryText =
        `${label}:\n` +
        `• Nominal: ${formattedAmount}\n` +
        `• Keterangan: ${intent.description}\n` +
        `• Kategori: ${categoryName}\n` +
        `• Akun: ${accRes.account.name}`;

      const confirmationPrompt =
        `Catat ${label.toLowerCase()} ${formattedAmount} untuk "${intent.description}" (${accRes.account.name})?\n\n` +
        `Balas *YA* untuk mencatat atau *BATAL* untuk membatalkan.`;

      return {
        status: "READY_FOR_CONFIRMATION",
        intentType: intent.intent,
        summaryText,
        confirmationPrompt,
        payload: {
          amount: intent.amount,
          description: intent.description,
          transactionDate: txDate,
          accountId: accRes.account.id,
          categoryId: resolvedCategoryId,
        },
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
