/**
 * BudgetService — Phase 6
 *
 * Authority: READ-ONLY access to transactions. All financial mutations
 * remain with TransactionService / TransferService / AccountService.
 *
 * Timezone semantics:
 *   transaction_date is stored as UTC without timezone (same as dashboard).
 *   Budget period boundaries are expressed as UTC instants that correspond to
 *   Jakarta local midnight (UTC-7h offset), matching the existing dashboard
 *   approach (getJakartaMonthBounds) so aggregations are consistent.
 */

import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/db/schema";
import { eq, and, or, isNull, gte, lt, lte, gt, sql } from "drizzle-orm";
import {
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@/schemas/budget.schema";

// ─── Constants ─────────────────────────────────────────────────────────────────

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // +07:00

// ─── Timezone helpers (Jakarta-consistent with dashboard.service) ───────────────

/**
 * Convert a Jakarta-local calendar month to [startUtc, nextMonthStartUtc).
 * Uses the same arithmetic as getJakartaMonthBounds in dashboard.service.ts.
 */
function jakartaMonthToUtcRange(year: number, month: number): { start: Date; end: Date } {
  // Jakarta local midnight of day 1 of the month → subtract offset to get UTC
  const startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const start = new Date(startLocal.getTime() - JAKARTA_OFFSET_MS);

  // First moment of the *next* month in Jakarta → UTC
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endLocal = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0));
  const end = new Date(endLocal.getTime() - JAKARTA_OFFSET_MS);

  return { start, end };
}

/**
 * Convert a Jakarta-local date string "YYYY-MM-DD" to the UTC instant that
 * represents Jakarta midnight of that day.
 */
function jakartaDateStringToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(localMidnight.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Given a CUSTOM budget's endDate string "YYYY-MM-DD", compute the exclusive
 * upper bound (start of next Jakarta day → UTC).
 */
function jakartaDateStringToExclusiveUtcEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Next day in Jakarta local, then convert to UTC
  const nextDayLocal = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return new Date(nextDayLocal.getTime() - JAKARTA_OFFSET_MS);
}


/**
 * Calculate rolling period (30/7/90 days) from a start date.
 * Returns [startUtc, endUtc) where endUtc = start + N days.
 * 
 * @param startDateStr Jakarta-local date string "YYYY-MM-DD" or null (defaults to today)
 * @param durationDays Number of days (30, 7, or 90)
 */
function calculateRollingPeriod(
  startDateStr: string | null | undefined,
  durationDays: 30 | 7 | 90
): { start: Date; end: Date } {
  let startUtc: Date;
  
  if (startDateStr) {
    startUtc = jakartaDateStringToUtc(startDateStr);
  } else {
    // Default to today Jakarta midnight
    const now = new Date();
    const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const year = jakartaNow.getUTCFullYear();
    const month = jakartaNow.getUTCMonth();
    const day = jakartaNow.getUTCDate();
    const todayLocal = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    startUtc = new Date(todayLocal.getTime() - JAKARTA_OFFSET_MS);
  }
  
  // End = start + N days (exclusive)
  const endUtc = new Date(startUtc.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  return { start: startUtc, end: endUtc };
}
// ─── DTO ───────────────────────────────────────────────────────────────────────

export interface BudgetProgressDTO {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  periodType: string;
  /** ISO string of inclusive start (UTC stored as Jakarta midnight) */
  startDate: Date;
  /** ISO string of exclusive end (UTC stored as Jakarta midnight of next day) */
  endDate: Date;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  /** Actual ratio × 100. Can exceed 100 when over budget. */
  usagePercentage: number;
  /** Capped at 100 for visual progress bars. */
  displayPercentage: number;
  isOverBudget: boolean;
  currency: string;
}

// ─── Category ownership helper ─────────────────────────────────────────────────

/**
 * Resolve a category that is accessible to userId and is of the given type.
 * Accessible = system default (userId IS NULL) OR owned by this user.
 * Throws with a descriptive message on any violation.
 */
async function resolveExpenseCategory(userId: string, categoryId: string) {
  const [cat] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), eq(categories.userId, userId))
      )
    )
    .limit(1);

  if (!cat) {
    throw new Error("Kategori tidak ditemukan atau bukan milik Anda.");
  }
  if (cat.type !== "EXPENSE") {
    throw new Error(
      `Kategori '${cat.name}' adalah tipe ${cat.type}. Budget hanya dapat dibuat untuk kategori EXPENSE.`
    );
  }
  return cat;
}

// ─── Overlap / duplicate detection ─────────────────────────────────────────────

/**
 * Check whether any existing budget for (userId, categoryId) overlaps with
 * [newStart, newEnd). Excludes the budget identified by `excludeId` (for updates).
 *
 * Overlap condition: existing.start < newEnd AND existing.end > newStart
 */
async function hasOverlappingBudget(
  userId: string,
  categoryId: string,
  newStart: Date,
  newEnd: Date,
  excludeId?: string
): Promise<boolean> {
  const rows = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.categoryId, categoryId),
        lt(budgets.startDate, newEnd),
        gte(budgets.endDate, newStart)
      )
    );

  if (excludeId) {
    return rows.some((r) => r.id !== excludeId);
  }
  return rows.length > 0;
}

// ─── Spending aggregation ──────────────────────────────────────────────────────

/**
 * Aggregate actual spending from transactions for a single budget.
 * Only EXPENSE, CONFIRMED transactions by the owner, within the period, with
 * the matching category, are summed.
 *
 * `endDate` is treated as EXCLUSIVE upper bound (consistent with period helpers
 * that produce start of next period).
 */
async function aggregateSpending(
  userId: string,
  categoryId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        eq(transactions.status, "CONFIRMED"),
        eq(transactions.categoryId, categoryId),
        gte(transactions.transactionDate, startDate),
        lt(transactions.transactionDate, endDate)
      )
    );

  return parseFloat(result[0]?.total ?? "0");
}

/**
 * Aggregate spending for multiple budgets concurrently.
 * Uses Promise.all for concurrent DB calls — one per budget — which avoids
 * sequential blocking while remaining correct across overlapping periods.
 *
 * Returns a Map<budgetId, spentAmount>.
 */
export async function aggregateSpendingBulk(
  userId: string,
  budgetList: Array<{ id: string; categoryId: string; startDate: Date; endDate: Date }>
): Promise<Map<string, number>> {
  if (budgetList.length === 0) return new Map();

  const spentAmounts = await Promise.all(
    budgetList.map((b) =>
      aggregateSpending(userId, b.categoryId, b.startDate, b.endDate)
    )
  );

  const spendingMap = new Map<string, number>();
  budgetList.forEach((b, i) => {
    spendingMap.set(b.id, spentAmounts[i]);
  });

  return spendingMap;
}

// ─── Budget calculation helper ──────────────────────────────────────────────────

function calculateProgress(
  limitAmount: number,
  spentAmount: number
): Pick<BudgetProgressDTO, "remainingAmount" | "usagePercentage" | "displayPercentage" | "isOverBudget"> {
  const remaining = limitAmount - spentAmount;
  const usagePct = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : 0;
  return {
    remainingAmount: remaining,
    usagePercentage: usagePct,
    displayPercentage: Math.min(usagePct, 100),
    isOverBudget: spentAmount > limitAmount,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class BudgetService {
  // ──────────────────────────────────────────────────────────────────────────────
  // BUDGET MATCHING AND VALIDATION (for expense creation)
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Find active applicable budget for an expense transaction.
   * Returns budget if found, null if no matching budget.
   * 
   * Matches on:
   * - userId
   * - accountId
   * - categoryId
   * - transactionDate within [startDate, endDate)
   */
  static async findApplicableBudget(
    userId: string,
    accountId: string,
    categoryId: string,
    transactionDate: Date
  ): Promise<{
    id: string;
    amount: string;
    spentAmount: number;
    remaining: number;
  } | null> {
    // 1. Find matching budget
    const [budget] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.accountId, accountId),
          eq(budgets.categoryId, categoryId),
          lte(budgets.startDate, transactionDate),
          gt(budgets.endDate, transactionDate) // exclusive upper bound
        )
      )
      .limit(1);

    if (!budget) return null;

    // 2. Calculate spent amount
    const spentAmount = await aggregateSpending(
      userId,
      categoryId,
      budget.startDate,
      budget.endDate
    );

    const limitAmount = parseFloat(budget.amount);
    const remaining = limitAmount - spentAmount;

    return {
      id: budget.id,
      amount: budget.amount,
      spentAmount,
      remaining,
    };
  }

  /**
   * Validate budget consumption for an expense.
   * Returns validation result indicating:
   * - Can expense proceed?
   * - How much from budget?
   * - How much from free cash?
   * - Any warnings?
   */
  static async validateBudgetConsumption(
    userId: string,
    accountId: string,
    categoryId: string | null,
    expenseAmount: number,
    transactionDate: Date
  ): Promise<{
    canProceed: boolean;
    budgetConsumption: number;
    freeCashConsumption: number;
    warnings: string[];
    budgetId?: string;
  }> {
    const warnings: string[] = [];

    // If no category, use free cash only
    if (!categoryId) {
      const { AccountService } = await import("./account.service");
      const freeCash = await AccountService.getFreeCash(userId, accountId);

      if (expenseAmount > freeCash) {
        return {
          canProceed: false,
          budgetConsumption: 0,
          freeCashConsumption: 0,
          warnings: [
            `Free cash tidak mencukupi. Tersedia: Rp${freeCash.toLocaleString()}, Dibutuhkan: Rp${expenseAmount.toLocaleString()}`
          ],
        };
      }

      return {
        canProceed: true,
        budgetConsumption: 0,
        freeCashConsumption: expenseAmount,
        warnings: [],
      };
    }

    // Try to find applicable budget
    const budget = await this.findApplicableBudget(
      userId,
      accountId,
      categoryId,
      transactionDate
    );

    // No budget found - use free cash
    if (!budget) {
      const { AccountService } = await import("./account.service");
      const freeCash = await AccountService.getFreeCash(userId, accountId);

      if (expenseAmount > freeCash) {
        return {
          canProceed: false,
          budgetConsumption: 0,
          freeCashConsumption: 0,
          warnings: [
            `Free cash tidak mencukupi (tidak ada budget untuk kategori ini). Tersedia: Rp${freeCash.toLocaleString()}, Dibutuhkan: Rp${expenseAmount.toLocaleString()}`
          ],
        };
      }

      return {
        canProceed: true,
        budgetConsumption: 0,
        freeCashConsumption: expenseAmount,
        warnings: [],
      };
    }

    // Budget found - check if it covers the expense
    if (expenseAmount <= budget.remaining) {
      // Budget covers entire expense
      return {
        canProceed: true,
        budgetConsumption: expenseAmount,
        freeCashConsumption: 0,
        warnings: [],
        budgetId: budget.id,
      };
    }

    // Overspending - budget + free cash
    const overage = expenseAmount - budget.remaining;
    const { AccountService } = await import("./account.service");
    const freeCash = await AccountService.getFreeCash(userId, accountId);

    if (overage > freeCash) {
      return {
        canProceed: false,
        budgetConsumption: 0,
        freeCashConsumption: 0,
        warnings: [
          `Budget tersisa Rp${budget.remaining.toLocaleString()}, overage Rp${overage.toLocaleString()} melebihi free cash Rp${freeCash.toLocaleString()}`
        ],
      };
    }

    warnings.push(
      `⚠️ Budget melebihi sisa! Budget tersisa: Rp${budget.remaining.toLocaleString()}, Expense: Rp${expenseAmount.toLocaleString()}. Overage Rp${overage.toLocaleString()} akan dikurangi dari free cash.`
    );

    return {
      canProceed: true,
      budgetConsumption: budget.remaining,
      freeCashConsumption: overage,
      warnings,
      budgetId: budget.id,
    };
  }
  // ──────────────────────────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────────────────────────

  static async createBudget(userId: string, input: CreateBudgetInput
  ): Promise<BudgetProgressDTO> {
    // 1. Validate & resolve category (EXPENSE only, ownership enforced)
    await resolveExpenseCategory(userId, input.categoryId);

    // 2. Validate sufficient free cash
    const { AccountService } = await import("./account.service");
    const freeCash = await AccountService.getFreeCash(userId, input.accountId);
    const allocationAmount = parseFloat(input.amount);
    
    if (allocationAmount > freeCash) {
      throw new Error(
        `Saldo free cash tidak mencukupi. Tersedia: ${freeCash.toLocaleString()}, Dibutuhkan: ${allocationAmount.toLocaleString()}`
      );
    }

    // 3. Compute UTC period boundaries
    let startUtc: Date;
    let endUtc: Date;

    if (input.periodType === "MONTHLY") {
      const bounds = jakartaMonthToUtcRange(input.year, input.month);
      startUtc = bounds.start;
      endUtc = bounds.end;
    } else if (input.periodType === "CUSTOM") {
      startUtc = jakartaDateStringToUtc(input.startDate);
      endUtc = jakartaDateStringToExclusiveUtcEnd(input.endDate);
    } else {
      // ROLLING periods: ROLLING_30_DAYS, ROLLING_7_DAYS, ROLLING_90_DAYS
      const durationMap = {
        "ROLLING_30_DAYS": 30,
        "ROLLING_7_DAYS": 7,
        "ROLLING_90_DAYS": 90,
      } as const;
      
      const duration = durationMap[input.periodType as keyof typeof durationMap];
      if (!duration) {
        throw new Error("Invalid period type: " + input.periodType);
      }
      
      const period = calculateRollingPeriod(input.startDate || null, duration);
      startUtc = period.start;
      endUtc = period.end;
    }

    // 4. Check for overlapping budget (duplicate/ambiguity prevention)
    const overlaps = await hasOverlappingBudget(
      userId,
      input.categoryId,
      startUtc,
      endUtc
    );
    if (overlaps) {
      throw new Error(
        "Sudah ada budget yang aktif untuk kategori dan periode yang sama atau tumpang tindih."
      );
    }

    // 5. Insert with accountId
    const [created] = await db
      .insert(budgets)
      .values({ userId, accountId: input.accountId,
        categoryId: input.categoryId,
        periodType: input.periodType,
        startDate: startUtc,
        endDate: endUtc,
        amount: input.amount,
        currency: input.currency ?? "IDR",
      })
      .returning();

    return this.getBudgetProgress(userId, created.id);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // GET ONE
  // ──────────────────────────────────────────────────────────────────────────────

  static async getBudget(
    userId: string,
    budgetId: string
  ): Promise<BudgetProgressDTO | null> {
    try {
      return await this.getBudgetProgress(userId, budgetId);
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // LIST
  // ──────────────────────────────────────────────────────────────────────────────

  static async listBudgets(userId: string): Promise<BudgetProgressDTO[]> {
    // 1. Fetch all budgets with category info (single query)
    const rows = await db
      .select({
        id: budgets.id,
        userId: budgets.userId,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        periodType: budgets.periodType,
        startDate: budgets.startDate,
        endDate: budgets.endDate,
        amount: budgets.amount,
        currency: budgets.currency,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.userId, userId))
      .orderBy(budgets.startDate);

    if (rows.length === 0) return [];

    // 2. Aggregate spending in parallel (one DB call per budget, concurrently)
    const budgetList = rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      startDate: r.startDate,
      endDate: r.endDate,
    }));

    const spendingMap = await aggregateSpendingBulk(userId, budgetList);

    // 3. Build DTOs
    return rows.map((r) => {
      const limitAmount = parseFloat(r.amount ?? "0");
      const spentAmount = spendingMap.get(r.id) ?? 0;
      const progress = calculateProgress(limitAmount, spentAmount);

      return {
        id: r.id,
        userId: r.userId,
        categoryId: r.categoryId,
        categoryName: r.categoryName ?? "Tanpa Kategori",
        categoryColor: r.categoryColor ?? null,
        categoryIcon: r.categoryIcon ?? null,
        periodType: r.periodType,
        startDate: r.startDate,
        endDate: r.endDate,
        limitAmount,
        spentAmount,
        currency: r.currency,
        ...progress,
      };
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────────

  static async updateBudget(
    userId: string,
    budgetId: string,
    input: UpdateBudgetInput
  ): Promise<BudgetProgressDTO | null> {
    // 1. Verify ownership
    const [existing] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .limit(1);

    if (!existing) return null;

    // 2. Validate new category if changing
    if (input.categoryId && input.categoryId !== existing.categoryId) {
      await resolveExpenseCategory(userId, input.categoryId);
    }

    // 3. Compute new period boundaries
    const newPeriodType = input.periodType ?? existing.periodType;
    let newStart = existing.startDate;
    let newEnd = existing.endDate;

    if (newPeriodType === "MONTHLY") {
      if (input.year !== undefined || input.month !== undefined) {
        // Need to derive year/month from existing if only one is provided
        const existingJakartaStart = new Date(
          existing.startDate.getTime() + JAKARTA_OFFSET_MS
        );
        const existingYear = existingJakartaStart.getUTCFullYear();
        const existingMonth = existingJakartaStart.getUTCMonth() + 1;

        const year = input.year ?? existingYear;
        const month = input.month ?? existingMonth;
        const bounds = jakartaMonthToUtcRange(year, month);
        newStart = bounds.start;
        newEnd = bounds.end;
      } else if (existing.periodType !== "MONTHLY" && newPeriodType === "MONTHLY") {
        throw new Error(
          "Untuk mengubah ke MONTHLY, sertakan year dan month."
        );
      }
    } else if (newPeriodType === "CUSTOM") {
      if (input.startDate || input.endDate) {
        const existingJakartaStart = new Date(
          existing.startDate.getTime() + JAKARTA_OFFSET_MS
        );
        // endDate in budget is exclusive; to reconstruct original jakarta endDate we go back one day
        const existingJakartaEndExcl = new Date(
          existing.endDate.getTime() + JAKARTA_OFFSET_MS
        );
        const existingEndDateStr = new Date(
          existingJakartaEndExcl.getTime() - 24 * 60 * 60 * 1000
        )
          .toISOString()
          .slice(0, 10);

        const startStr =
          input.startDate ??
          existingJakartaStart.toISOString().slice(0, 10);
        const endStr = input.endDate ?? existingEndDateStr;

        if (startStr > endStr) {
          throw new Error("startDate harus sebelum atau sama dengan endDate");
        }

        newStart = jakartaDateStringToUtc(startStr);
        newEnd = jakartaDateStringToExclusiveUtcEnd(endStr);
      }
    }

    const newCategoryId = input.categoryId ?? existing.categoryId;

    // 4. Check overlap (excluding self)
    const overlaps = await hasOverlappingBudget(
      userId,
      newCategoryId,
      newStart,
      newEnd,
      budgetId
    );
    if (overlaps) {
      throw new Error(
        "Perubahan ini akan menyebabkan tumpang tindih dengan budget lain yang ada."
      );
    }

    // 5. Apply update
    const [updated] = await db
      .update(budgets)
      .set({
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        periodType: newPeriodType,
        startDate: newStart,
        endDate: newEnd,
      })
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning();

    if (!updated) return null;

    return this.getBudgetProgress(userId, budgetId);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Delete budget. Does NOT delete any transactions.
   * Returns true if deleted, false if not found / not owned by userId.
   */
  static async deleteBudget(userId: string, budgetId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .returning({ id: budgets.id });

    return !!deleted;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // GET BUDGET PROGRESS (single budget with live spending)
  // ──────────────────────────────────────────────────────────────────────────────

  static async getBudgetProgress(
    userId: string,
    budgetId: string
  ): Promise<BudgetProgressDTO> {
    const [row] = await db
      .select({
        id: budgets.id,
        userId: budgets.userId,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        periodType: budgets.periodType,
        startDate: budgets.startDate,
        endDate: budgets.endDate,
        amount: budgets.amount,
        currency: budgets.currency,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
      .limit(1);

    if (!row) {
      throw new Error(`Budget tidak ditemukan: ${budgetId}`);
    }

    const limitAmount = parseFloat(row.amount ?? "0");
    const spentAmount = await aggregateSpending(
      userId,
      row.categoryId,
      row.startDate,
      row.endDate
    );
    const progress = calculateProgress(limitAmount, spentAmount);

    return {
      id: row.id,
      userId: row.userId,
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? "Tanpa Kategori",
      categoryColor: row.categoryColor ?? null,
      categoryIcon: row.categoryIcon ?? null,
      periodType: row.periodType,
      startDate: row.startDate,
      endDate: row.endDate,
      limitAmount,
      spentAmount,
      currency: row.currency,
      ...progress,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // GET BUDGET SUMMARY (for dashboard — fetches all budgets with progress)
  // ──────────────────────────────────────────────────────────────────────────────

  static async getBudgetSummary(userId: string): Promise<BudgetProgressDTO[]> {
    return this.listBudgets(userId);
  }
}

