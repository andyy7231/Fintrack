import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";

export type AccountResolveResult =
  | { status: "RESOLVED"; account: { id: string; name: string; type: string }; isDefault?: boolean }
  | { status: "AMBIGUOUS"; accounts: Array<{ id: string; name: string; type: string }> }
  | { status: "NOT_FOUND"; hint: string };

export type CategoryResolveResult =
  | { status: "RESOLVED"; category: { id: string; name: string; type: string } }
  | { status: "AMBIGUOUS"; categories: Array<{ id: string; name: string; type: string }> }
  | { status: "NOT_SPECIFIED"; categoryId: null }
  | { status: "NOT_FOUND"; hint: string };

export class IntentResolverService {
  /**
   * Resolve an accountHint to a specific user-owned active account.
   * Enforces strict user isolation.
   */
  static async resolveAccount(
    userId: string,
    accountHint?: string | null
  ): Promise<AccountResolveResult> {
    const userAccounts = await AccountService.getAccounts(userId);
    const activeAccounts = userAccounts.filter((a) => a.isActive);

    if (activeAccounts.length === 0) {
      return { status: "NOT_FOUND", hint: accountHint || "Tidak ada akun aktif" };
    }

    if (!accountHint) {
      // If user has exactly one active account, resolve to it as default
      if (activeAccounts.length === 1 && activeAccounts[0]) {
        return {
          status: "RESOLVED",
          account: {
            id: activeAccounts[0].id,
            name: activeAccounts[0].name,
            type: activeAccounts[0].type,
          },
          isDefault: true,
        };
      }
      // If user has multiple accounts and didn't specify one, default to first or mark ambiguous
      const defaultCash = activeAccounts.find((a) => a.type === "CASH") || activeAccounts[0];
      if (defaultCash) {
        return {
          status: "RESOLVED",
          account: {
            id: defaultCash.id,
            name: defaultCash.name,
            type: defaultCash.type,
          },
          isDefault: true,
        };
      }
      return {
        status: "AMBIGUOUS",
        accounts: activeAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      };
    }

    const search = accountHint.toLowerCase().trim();
    const matches = activeAccounts.filter(
      (a) =>
        a.name.toLowerCase().includes(search) ||
        a.type.toLowerCase().includes(search)
    );

    if (matches.length === 1 && matches[0]) {
      return {
        status: "RESOLVED",
        account: {
          id: matches[0].id,
          name: matches[0].name,
          type: matches[0].type,
        },
      };
    }

    if (matches.length > 1) {
      return {
        status: "AMBIGUOUS",
        accounts: matches.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      };
    }

    return { status: "NOT_FOUND", hint: accountHint };
  }

  /**
   * Resolve a categoryHint to a matching user category or system default.
   * Enforces strict type compatibility (INCOME vs EXPENSE).
   */
  static async resolveCategory(
    userId: string,
    type: "INCOME" | "EXPENSE",
    categoryHint?: string | null
  ): Promise<CategoryResolveResult> {
    if (!categoryHint) {
      return { status: "NOT_SPECIFIED", categoryId: null };
    }

    const allCategories = await CategoryService.getCategories(userId);
    const compatible = allCategories.filter((c) => c.type === type);

    const search = categoryHint.toLowerCase().trim();
    let matches = compatible.filter(
      (c) =>
        c.name.toLowerCase() === search ||
        c.name.toLowerCase().includes(search) ||
        search.includes(c.name.toLowerCase())
    );

    if (matches.length === 0) {
      // Common Indonesian category synonyms / aliases
      const synonyms: Record<string, string[]> = {
        makan: ["makanan", "minuman", "kuliner", "food"],
        transport: ["transportasi", "kendaraan", "bensin"],
        kos: ["kost", "tempat tinggal", "sewa", "hunian", "kontrakan"],
        tagihan: ["utilitas", "listrik", "air", "internet", "pulsa"],
        belanja: ["shopping", "mall", "pasar"],
        kesehatan: ["obat", "dokter", "medis"],
        hiburan: ["entertainment", "game", "hobi"],
        pendidikan: ["sekolah", "kuliah", "kursus", "edukasi"],
      };

      for (const [key, synList] of Object.entries(synonyms)) {
        if (search === key || synList.includes(search) || search.includes(key)) {
          matches = compatible.filter((c) => {
            const cLower = c.name.toLowerCase();
            return cLower.includes(key) || synList.some((s) => cLower.includes(s));
          });
          if (matches.length > 0) break;
        }
      }
    }

    // 1. Exact name match takes precedence
    const exactMatches = matches.filter((c) => c.name.toLowerCase() === search);
    if (exactMatches.length === 1 && exactMatches[0]) {
      return {
        status: "RESOLVED",
        category: {
          id: exactMatches[0].id,
          name: exactMatches[0].name,
          type: exactMatches[0].type,
        },
      };
    }
    if (exactMatches.length > 1) {
      const userMatch = exactMatches.find((c) => c.userId === userId) || exactMatches[0]!;
      return {
        status: "RESOLVED",
        category: {
          id: userMatch.id,
          name: userMatch.name,
          type: userMatch.type,
        },
      };
    }

    // 2. Single match
    if (matches.length === 1 && matches[0]) {
      return {
        status: "RESOLVED",
        category: {
          id: matches[0].id,
          name: matches[0].name,
          type: matches[0].type,
        },
      };
    }

    // 3. If multiple partial matches, check if exactly one belongs to user
    if (matches.length > 1) {
      const userMatches = matches.filter((c) => c.userId === userId);
      if (userMatches.length === 1 && userMatches[0]) {
        return {
          status: "RESOLVED",
          category: {
            id: userMatches[0].id,
            name: userMatches[0].name,
            type: userMatches[0].type,
          },
        };
      }

      return {
        status: "AMBIGUOUS",
        categories: matches.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      };
    }

    return { status: "NOT_FOUND", hint: categoryHint };
  }

  /**
   * Resolve a free-text categoryName from AI to a user-accessible EXPENSE category.
   *
   * Phase 5.2 trust boundary: AI provides only a human-readable name (e.g. "makan",
   * "kos", "transport"). This method fuzzy-matches it against the user's categories
   * plus system defaults, all of type EXPENSE.
   *
   * Never trusts a categoryId from AI input.
   */
  static async resolveBudgetCategory(
    userId: string,
    categoryName: string
  ): Promise<CategoryResolveResult> {
    return this.resolveCategory(userId, "EXPENSE", categoryName);
  }
}
