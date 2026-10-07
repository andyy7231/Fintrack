import { db } from "@/lib/db";
import { categories, transactions } from "@/db/schema";
import { eq, and, or, isNull, sql, gte, lte } from "drizzle-orm";
import { CreateCategoryInput, UpdateCategoryInput } from "@/schemas/category.schema";

export interface CategoryWithStats {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  userId: string | null;
  monthlyTotal: number;
  transactionCount: number;
  portion: number;
}

export interface CategoriesSummaryStats {
  totalCategories: number;
  expenseCategoriesCount: number;
  incomeCategoriesCount: number;
  totalExpenseMonth: number;
  totalIncomeMonth: number;
  expenseTxCount: number;
  incomeTxCount: number;
}

export class CategoryService {
  /**
   * List available categories for the user (system default + user's custom categories).
   *
   * Deduplication rules (applied in-memory after DB fetch):
   *  1. User-scoped category wins over global (userId=null) category with the same
   *     case-insensitive name+type.
   *  2. If two rows share the same name+type (e.g. due to a legacy data issue), keep
   *     the first occurrence (preserves existing IDs used by transactions).
   */
  static async getCategories(userId: string, type?: "INCOME" | "EXPENSE") {
    const conditions = [or(isNull(categories.userId), eq(categories.userId, userId))];

    if (type) {
      conditions.push(eq(categories.type, type));
    }

    const rows = await db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(categories.type, categories.name);

    // Deduplicate: key = `${type}:${name.toLowerCase()}`
    // User-owned rows appear first because we sort by (type, name) and then handle
    // collisions by preferring the user-owned entry.
    const seen = new Map<string, typeof rows[0]>();

    for (const row of rows) {
      const key = `${row.type}:${row.name.toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, row);
      } else {
        // Keep user-scoped over global; if both same scope, keep first (older).
        if (existing.userId === null && row.userId !== null) {
          seen.set(key, row); // prefer user-owned
        }
      }
    }

    // Return in the same type→name order
    return [...seen.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Create a custom category for the user.
   * Prevents creating an exact duplicate (case-insensitive name+type) for same user.
   */
  static async createCustomCategory(userId: string, input: CreateCategoryInput) {
    // Check for existing (user-scoped or global) with same name+type
    const allCats = await this.getCategories(userId, input.type as "INCOME" | "EXPENSE");
    const duplicate = allCats.find(
      (c) => c.name.toLowerCase() === input.name.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Kategori "${input.name}" sudah ada.`);
    }

    const [newCat] = await db
      .insert(categories)
      .values({
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon || null,
        color: input.color || null,
        isDefault: false,
      })
      .returning();

    return newCat;
  }

  /**
   * Update user-owned category (strictly prevents modifying system default categories)
   */
  static async updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (!existing) {
      return null; // Not found or is a default category belonging to system
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.color !== undefined && { color: input.color }),
      })
      .where(eq(categories.id, categoryId))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete custom category (strictly prevents deleting system default categories)
   */
  static async deleteCategory(userId: string, categoryId: string) {
    const [deleted] = await db
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .returning();

    return deleted ?? null;
  }

  /**
   * List categories with monthly spending/income stats and summary KPIs.
   */
  static async getCategoriesWithStats(userId: string) {
    const cats = await this.getCategories(userId);

    // Compute Jakarta calendar month bounds (UTC+7)
    const tzOffsetMs = 7 * 60 * 60 * 1000;
    const now = new Date(Date.now() + tzOffsetMs);
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - tzOffsetMs);
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endOfMonth = new Date(Date.UTC(year, month, daysInMonth, 23, 59, 59, 999) - tzOffsetMs);

    const txRows = await db
      .select({
        categoryId: transactions.categoryId,
        type: transactions.type,
        count: sql<number>`cast(count(${transactions.id}) as integer)`,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.status, "CONFIRMED"),
          gte(transactions.transactionDate, startOfMonth),
          lte(transactions.transactionDate, endOfMonth)
        )
      )
      .groupBy(transactions.categoryId, transactions.type);

    const statsMap = new Map<string, { count: number; total: number }>();
    let totalExpenseMonth = 0;
    let totalIncomeMonth = 0;
    let expenseTxCount = 0;
    let incomeTxCount = 0;

    for (const row of txRows) {
      const amount = parseFloat(row.total || "0");
      const count = Number(row.count || 0);
      if (row.categoryId) {
        statsMap.set(row.categoryId, { count, total: amount });
      }
      if (row.type === "EXPENSE") {
        totalExpenseMonth += amount;
        expenseTxCount += count;
      } else if (row.type === "INCOME") {
        totalIncomeMonth += amount;
        incomeTxCount += count;
      }
    }

    const categoriesWithStats: CategoryWithStats[] = cats.map((cat) => {
      const stat = statsMap.get(cat.id) || { count: 0, total: 0 };
      const denom = cat.type === "EXPENSE" ? totalExpenseMonth : totalIncomeMonth;
      const portion = denom > 0 ? (stat.total / denom) * 100 : 0;
      return {
        ...cat,
        monthlyTotal: Math.round(stat.total * 100) / 100,
        transactionCount: stat.count,
        portion: Math.round(portion * 10) / 10,
      };
    });

    const expenseCategoriesCount = categoriesWithStats.filter((c) => c.type === "EXPENSE").length;
    const incomeCategoriesCount = categoriesWithStats.filter((c) => c.type === "INCOME").length;

    const summary: CategoriesSummaryStats = {
      totalCategories: categoriesWithStats.length,
      expenseCategoriesCount,
      incomeCategoriesCount,
      totalExpenseMonth: Math.round(totalExpenseMonth * 100) / 100,
      totalIncomeMonth: Math.round(totalIncomeMonth * 100) / 100,
      expenseTxCount,
      incomeTxCount,
    };

    return {
      categories: categoriesWithStats,
      summary,
    };
  }
}
