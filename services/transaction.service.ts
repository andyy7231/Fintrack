import { db } from "@/lib/db";
import { transactions, accounts, categories } from "@/db/schema";
import { eq, and, or, isNull, gte, lte, ilike, desc } from "drizzle-orm";
import { CreateTransactionInput, UpdateTransactionInput } from "@/schemas/transaction.schema";

export interface TransactionFilters {
  type?: "INCOME" | "EXPENSE";
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export class TransactionService {
  /**
   * Create a new transaction with strict ownership and category type validation
   */
  static async createTransaction(userId: string, input: CreateTransactionInput) {
    // 1. Verify account ownership
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
      .limit(1);

    if (!account) {
      throw new Error("Akun keuangan tidak ditemukan atau bukan milik Anda.");
    }

    if (!account.isActive) {
      throw new Error("Akun keuangan sedang nonaktif.");
    }

    // 2. Verify category ownership and type compatibility (if category provided)
    if (input.categoryId) {
      const [category] = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            or(isNull(categories.userId), eq(categories.userId, userId))
          )
        )
        .limit(1);

      if (!category) {
        throw new Error("Kategori tidak ditemukan.");
      }

      if (category.type !== input.type) {
        throw new Error(
          `Kategori '${category.name}' adalah tipe ${category.type}, tidak cocok dengan transaksi ${input.type}.`
        );
      }
    }

    // 3. NEW: Budget-aware validation for EXPENSE transactions
    if (input.type === "EXPENSE") {
      const { BudgetService } = await import("./budget.service");
      
      const validation = await BudgetService.validateBudgetConsumption(
        userId,
        input.accountId,
        input.categoryId || null,
        parseFloat(input.amount),
        input.transactionDate
      );

      if (!validation.canProceed) {
        throw new Error(validation.warnings.join(". "));
      }

      // Log warnings if any (overspending, etc.)
      if (validation.warnings.length > 0) {
        console.warn(`[Budget Warning] ${validation.warnings.join(". ")}`);
      }
    }

    // 4. Insert transaction
    const [created] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId || null,
        type: input.type,
        amount: input.amount,
        description: input.description,
        transactionDate: input.transactionDate,
        source: "WEB",
        status: "CONFIRMED",
      })
      .returning();

    return created;
  }

  /**
   * List transactions for the authenticated user with optional filters
   */
  static async getTransactions(userId: string, filters: TransactionFilters = {}) {
    const conditions = [eq(transactions.userId, userId)];

    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters.accountId) {
      conditions.push(eq(transactions.accountId, filters.accountId));
    }
    if (filters.categoryId) {
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    }
    if (filters.startDate) {
      conditions.push(gte(transactions.transactionDate, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(transactions.transactionDate, filters.endDate));
    }
    if (filters.search) {
      conditions.push(ilike(transactions.description, `%${filters.search}%`));
    }

    const query = db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        accountName: accounts.name,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        transactionDate: transactions.transactionDate,
        source: transactions.source,
        status: transactions.status,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return query;
  }

  /**
   * Get single transaction by ID with ownership verification
   */
  static async getTransactionById(userId: string, transactionId: string) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);

    return tx ?? null;
  }

  /**
   * Update transaction with ownership verification
   */
  static async updateTransaction(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput
  ) {
    // 1. Verify existence and ownership
    const existing = await this.getTransactionById(userId, transactionId);
    if (!existing) {
      return null;
    }

    // 2. If accountId changed, verify new account
    if (input.accountId && input.accountId !== existing.accountId) {
      const [acc] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!acc) throw new Error("Akun tujuan tidak valid atau bukan milik Anda.");
    }

    // 3. If categoryId changed, verify new category
    const targetType = input.type || existing.type;
    if (input.categoryId) {
      const [cat] = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            or(isNull(categories.userId), eq(categories.userId, userId))
          )
        )
        .limit(1);
      if (!cat) throw new Error("Kategori tidak valid.");
      if (cat.type !== targetType) {
        throw new Error(
          `Kategori '${cat.name}' tidak cocok dengan tipe transaksi ${targetType}.`
        );
      }
    }

    // 4. Update transaction
    const [updated] = await db
      .update(transactions)
      .set({
        ...(input.accountId && { accountId: input.accountId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.type && { type: input.type }),
        ...(input.amount && { amount: input.amount }),
        ...(input.description && { description: input.description }),
        ...(input.transactionDate && { transactionDate: input.transactionDate }),
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .returning();

    return updated ?? null;
  }

  /**
   * Delete transaction with ownership check
   */
  static async deleteTransaction(userId: string, transactionId: string) {
    const [deleted] = await db
      .delete(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .returning();

    return deleted ?? null;
  }
}
