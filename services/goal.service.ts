import { db } from "@/lib/db";
import { financialGoals, goalContributions, transactions } from "@/db/schema";
import { eq, and, sql, desc, ne } from "drizzle-orm";
import {
  CreateGoalInput,
  UpdateGoalInput,
  CreateContributionInput,
  UpdateContributionInput,
  GoalStatus,
} from "@/schemas/goal.schema";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+07:00

// ─── Timezone & Date Helpers ───────────────────────────────────────────────────

/**
 * Convert a "YYYY-MM-DD" string to a Date object representing Jakarta local midnight in UTC.
 */
export function jakartaDateStringToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(localMidnight.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Get the current calendar day at Jakarta local midnight in UTC.
 */
export function getJakartaTodayUtc(): Date {
  const now = new Date();
  const jakartaTime = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const year = jakartaTime.getUTCFullYear();
  const month = jakartaTime.getUTCMonth();
  const day = jakartaTime.getUTCDate();
  const localMidnight = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return new Date(localMidnight.getTime() - JAKARTA_OFFSET_MS);
}

/**
 * Compute days remaining and overdue status.
 */
export function computeDeadlineMetrics(
  targetDate: Date,
  status: string
): { daysRemaining: number; isOverdue: boolean } {
  const todayUtc = getJakartaTodayUtc();
  const diffMs = targetDate.getTime() - todayUtc.getTime();
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const isOverdue = daysRemaining < 0 && status !== "COMPLETED";

  return {
    daysRemaining: daysRemaining < 0 ? 0 : daysRemaining,
    isOverdue,
  };
}

// ─── DTO Types ─────────────────────────────────────────────────────────────────

export interface GoalDTO {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: number;
  targetDate: Date;
  currency: string;
  status: GoalStatus;
  contributedAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  displayPercentage: number;
  daysRemaining: number;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContributionDTO {
  id: string;
  goalId: string;
  userId: string;
  transactionId: string | null;
  amount: number;
  contributionDate: Date;
  description: string | null;
  transactionDescription?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalSummaryDTO {
  totalGoalsCount: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  totalTargetAmount: number;
  totalContributedAmount: number;
  overallProgressPercentage: number;
  activeGoals: GoalDTO[];
}

// ─── Goal Service ──────────────────────────────────────────────────────────────

export class GoalService {
  /**
   * Create a new Financial Goal.
   */
  static async createGoal(userId: string, input: CreateGoalInput): Promise<GoalDTO> {
    const targetDate = jakartaDateStringToUtc(input.targetDate);
    const targetAmount = parseFloat(input.targetAmount);

    const [created] = await db
      .insert(financialGoals)
      .values({
        userId,
        name: input.name,
        description: input.description || null,
        targetAmount: targetAmount.toFixed(2),
        targetDate,
        currency: input.currency || "IDR",
        status: "ACTIVE",
      })
      .returning();

    const { daysRemaining, isOverdue } = computeDeadlineMetrics(created.targetDate, created.status);

    return {
      id: created.id,
      userId: created.userId,
      name: created.name,
      description: created.description,
      targetAmount,
      targetDate: created.targetDate,
      currency: created.currency,
      status: created.status as GoalStatus,
      contributedAmount: 0,
      remainingAmount: targetAmount,
      progressPercentage: 0,
      displayPercentage: 0,
      daysRemaining,
      isOverdue,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Get a single goal by ID with live aggregated contributions.
   * Scoped strictly to the authenticated user.
   */
  static async getGoal(userId: string, goalId: string): Promise<GoalDTO | null> {
    const [goal] = await db
      .select()
      .from(financialGoals)
      .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)));

    if (!goal) return null;

    const [contribAgg] = await db
      .select({
        totalContributed: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
      })
      .from(goalContributions)
      .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)));

    const targetAmount = parseFloat(goal.targetAmount);
    const contributedAmount = parseFloat(contribAgg?.totalContributed || "0.00");
    const remainingAmount = Math.max(targetAmount - contributedAmount, 0);
    const progressPercentage =
      targetAmount > 0 ? Math.round(((contributedAmount / targetAmount) * 100) * 100) / 100 : 0;
    const displayPercentage = Math.min(Math.max(progressPercentage, 0), 100);

    const { daysRemaining, isOverdue } = computeDeadlineMetrics(goal.targetDate, goal.status);

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      description: goal.description,
      targetAmount,
      targetDate: goal.targetDate,
      currency: goal.currency,
      status: goal.status as GoalStatus,
      contributedAmount,
      remainingAmount,
      progressPercentage,
      displayPercentage,
      daysRemaining,
      isOverdue,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  /**
   * List all goals for the user, with server-side aggregated contributions (No N+1 queries).
   */
  static async listGoals(
    userId: string,
    statusFilter?: GoalStatus | "ALL"
  ): Promise<GoalDTO[]> {
    const query = db
      .select({
        id: financialGoals.id,
        userId: financialGoals.userId,
        name: financialGoals.name,
        description: financialGoals.description,
        targetAmount: financialGoals.targetAmount,
        targetDate: financialGoals.targetDate,
        currency: financialGoals.currency,
        status: financialGoals.status,
        createdAt: financialGoals.createdAt,
        updatedAt: financialGoals.updatedAt,
        contributedAmount: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
      })
      .from(financialGoals)
      .leftJoin(
        goalContributions,
        and(
          eq(goalContributions.goalId, financialGoals.id),
          eq(goalContributions.userId, userId)
        )
      )
      .where(
        statusFilter && statusFilter !== "ALL"
          ? and(
              eq(financialGoals.userId, userId),
              eq(financialGoals.status, statusFilter)
            )
          : eq(financialGoals.userId, userId)
      )
      .groupBy(financialGoals.id)
      .orderBy(desc(financialGoals.createdAt));

    const rows = await query;

    return rows.map((r) => {
      const targetAmount = parseFloat(r.targetAmount);
      const contributedAmount = parseFloat(r.contributedAmount);
      const remainingAmount = Math.max(targetAmount - contributedAmount, 0);
      const progressPercentage =
        targetAmount > 0 ? Math.round(((contributedAmount / targetAmount) * 100) * 100) / 100 : 0;
      const displayPercentage = Math.min(Math.max(progressPercentage, 0), 100);

      const { daysRemaining, isOverdue } = computeDeadlineMetrics(r.targetDate, r.status);

      return {
        id: r.id,
        userId: r.userId,
        name: r.name,
        description: r.description,
        targetAmount,
        targetDate: r.targetDate,
        currency: r.currency,
        status: r.status as GoalStatus,
        contributedAmount,
        remainingAmount,
        progressPercentage,
        displayPercentage,
        daysRemaining,
        isOverdue,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  /**
   * Update goal details (name, description, targetAmount, targetDate, currency, status).
   * Does not alter historical contributions.
   */
  static async updateGoal(
    userId: string,
    goalId: string,
    input: UpdateGoalInput
  ): Promise<GoalDTO | null> {
    const existing = await this.getGoal(userId, goalId);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.targetAmount !== undefined) {
      const newTarget = parseFloat(input.targetAmount);
      // Ensure new target is not less than already contributed amount
      if (newTarget < existing.contributedAmount) {
        throw new Error(
          `Target nominal baru (Rp${newTarget.toLocaleString("id-ID")}) tidak boleh lebih kecil dari dana yang sudah terkumpul (Rp${existing.contributedAmount.toLocaleString("id-ID")})`
        );
      }
      updates.targetAmount = newTarget.toFixed(2);
    }
    if (input.targetDate !== undefined) {
      updates.targetDate = jakartaDateStringToUtc(input.targetDate);
    }
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.status !== undefined) updates.status = input.status;

    if (Object.keys(updates).length > 0) {
      await db
        .update(financialGoals)
        .set(updates)
        .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)));
    }

    return this.getGoal(userId, goalId);
  }

  /**
   * Delete a goal.
   * Policy: If goal has historical contributions, reject hard delete to protect historical financial planning records.
   * Use archiveGoal instead.
   */
  static async deleteGoal(
    userId: string,
    goalId: string
  ): Promise<{ deleted: boolean; hasContributions?: boolean }> {
    const existing = await this.getGoal(userId, goalId);
    if (!existing) return { deleted: false };

    // Check if contributions exist
    const [contribCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goalContributions)
      .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)));

    if (contribCount && contribCount.count > 0) {
      throw new Error(
        "Goal yang sudah memiliki kontribusi tidak dapat dihapus. Silakan arsipkan goal ini untuk menjaga riwayat perencanaan."
      );
    }

    await db
      .delete(financialGoals)
      .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)));

    return { deleted: true };
  }

  /**
   * Archive a goal.
   */
  static async archiveGoal(userId: string, goalId: string): Promise<GoalDTO | null> {
    return this.updateGoal(userId, goalId, { status: "ARCHIVED" });
  }

  /**
   * Pause a goal.
   */
  static async pauseGoal(userId: string, goalId: string): Promise<GoalDTO | null> {
    return this.updateGoal(userId, goalId, { status: "PAUSED" });
  }

  /**
   * Resume an active goal.
   */
  static async resumeGoal(userId: string, goalId: string): Promise<GoalDTO | null> {
    return this.updateGoal(userId, goalId, { status: "ACTIVE" });
  }

  // ─── Contribution Operations ─────────────────────────────────────────────────

  /**
   * Add a contribution to a goal.
   * Concurrency-safe atomic transaction with row locking and target/transaction allocation limit enforcement.
   */
  static async createContribution(
    userId: string,
    goalId: string,
    input: CreateContributionInput
  ): Promise<ContributionDTO> {
    const amount = parseFloat(input.amount);
    if (amount <= 0) {
      throw new Error("Nominal kontribusi harus lebih dari 0");
    }

    const contributionDate = input.contributionDate
      ? jakartaDateStringToUtc(input.contributionDate)
      : getJakartaTodayUtc();

    return await db.transaction(async (tx) => {
      // 1. Lock and verify goal
      const [goal] = await tx
        .select()
        .from(financialGoals)
        .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)))
        .for("update");

      if (!goal) {
        throw new Error("Goal tidak ditemukan atau Anda tidak memiliki akses");
      }

      if (goal.status === "ARCHIVED") {
        throw new Error("Tidak dapat menambahkan kontribusi pada goal yang telah diarsipkan");
      }

      const targetAmount = parseFloat(goal.targetAmount);

      // 2. Sum existing contributions for this goal
      const [contribAgg] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
        })
        .from(goalContributions)
        .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)));

      const currentContributed = parseFloat(contribAgg?.total || "0.00");
      const remainingTarget = targetAmount - currentContributed;

      // Rule: Contribution cannot exceed remaining target
      if (amount > remainingTarget + 0.0001) {
        throw new Error(
          `Nominal kontribusi (Rp${amount.toLocaleString("id-ID")}) melebihi sisa target goal (Rp${Math.max(remainingTarget, 0).toLocaleString("id-ID")})`
        );
      }

      // 3. If linked to transaction: validate ownership and verify NO double counting / over-allocation
      let linkedTxDate = contributionDate;
      if (input.transactionId) {
        const [sourceTx] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, userId)));

        if (!sourceTx) {
          throw new Error("Transaksi sumber tidak ditemukan atau bukan milik Anda");
        }

        const txAmount = parseFloat(sourceTx.amount);

        // Sum all existing allocations of this source transaction across all goals
        const [allocAgg] = await tx
          .select({
            totalAllocated: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
          })
          .from(goalContributions)
          .where(
            and(
              eq(goalContributions.transactionId, input.transactionId),
              eq(goalContributions.userId, userId)
            )
          );

        const currentTxAllocated = parseFloat(allocAgg?.totalAllocated || "0.00");
        const availableTxAllocatable = txAmount - currentTxAllocated;

        if (amount > availableTxAllocatable + 0.0001) {
          throw new Error(
            `Nominal kontribusi melebihi batas alokasi transaksi (Tersedia: Rp${Math.max(availableTxAllocatable, 0).toLocaleString("id-ID")} dari total Rp${txAmount.toLocaleString("id-ID")})`
          );
        }

        // If user didn't explicitly provide contributionDate, use transaction date
        if (!input.contributionDate && sourceTx.transactionDate) {
          linkedTxDate = sourceTx.transactionDate;
        }
      }

      // 4. Insert contribution
      const [newContrib] = await tx
        .insert(goalContributions)
        .values({
          goalId,
          userId,
          transactionId: input.transactionId || null,
          amount: amount.toFixed(2),
          contributionDate: linkedTxDate,
          description: input.description || null,
        })
        .returning();

      // 5. Update goal status to COMPLETED if target reached
      const newTotal = currentContributed + amount;
      if (newTotal >= targetAmount - 0.0001 && goal.status !== "COMPLETED") {
        await tx
          .update(financialGoals)
          .set({ status: "COMPLETED" })
          .where(eq(financialGoals.id, goalId));
      }

      return {
        id: newContrib.id,
        goalId: newContrib.goalId,
        userId: newContrib.userId,
        transactionId: newContrib.transactionId,
        amount,
        contributionDate: newContrib.contributionDate,
        description: newContrib.description,
        createdAt: newContrib.createdAt,
        updatedAt: newContrib.updatedAt,
      };
    });
  }

  /**
   * List all contributions for a goal.
   */
  static async listContributions(userId: string, goalId: string): Promise<ContributionDTO[]> {
    // Verify goal belongs to user
    const [goal] = await db
      .select({ id: financialGoals.id })
      .from(financialGoals)
      .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)));

    if (!goal) {
      throw new Error("Goal tidak ditemukan atau Anda tidak memiliki akses");
    }

    const rows = await db
      .select({
        id: goalContributions.id,
        goalId: goalContributions.goalId,
        userId: goalContributions.userId,
        transactionId: goalContributions.transactionId,
        amount: goalContributions.amount,
        contributionDate: goalContributions.contributionDate,
        description: goalContributions.description,
        transactionDescription: transactions.description,
        createdAt: goalContributions.createdAt,
        updatedAt: goalContributions.updatedAt,
      })
      .from(goalContributions)
      .leftJoin(transactions, eq(goalContributions.transactionId, transactions.id))
      .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)))
      .orderBy(desc(goalContributions.contributionDate), desc(goalContributions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      goalId: r.goalId,
      userId: r.userId,
      transactionId: r.transactionId,
      amount: parseFloat(r.amount),
      contributionDate: r.contributionDate,
      description: r.description,
      transactionDescription: r.transactionDescription,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Get single contribution by ID.
   */
  static async getContribution(
    userId: string,
    goalId: string,
    contributionId: string
  ): Promise<ContributionDTO | null> {
    const [row] = await db
      .select({
        id: goalContributions.id,
        goalId: goalContributions.goalId,
        userId: goalContributions.userId,
        transactionId: goalContributions.transactionId,
        amount: goalContributions.amount,
        contributionDate: goalContributions.contributionDate,
        description: goalContributions.description,
        transactionDescription: transactions.description,
        createdAt: goalContributions.createdAt,
        updatedAt: goalContributions.updatedAt,
      })
      .from(goalContributions)
      .leftJoin(transactions, eq(goalContributions.transactionId, transactions.id))
      .where(
        and(
          eq(goalContributions.id, contributionId),
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.userId, userId)
        )
      );

    if (!row) return null;

    return {
      id: row.id,
      goalId: row.goalId,
      userId: row.userId,
      transactionId: row.transactionId,
      amount: parseFloat(row.amount),
      contributionDate: row.contributionDate,
      description: row.description,
      transactionDescription: row.transactionDescription,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Update an existing contribution.
   */
  static async updateContribution(
    userId: string,
    goalId: string,
    contributionId: string,
    input: UpdateContributionInput
  ): Promise<ContributionDTO> {
    return await db.transaction(async (tx) => {
      // 1. Lock and verify goal
      const [goal] = await tx
        .select()
        .from(financialGoals)
        .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)))
        .for("update");

      if (!goal) {
        throw new Error("Goal tidak ditemukan atau Anda tidak memiliki akses");
      }

      // 2. Fetch existing contribution
      const [contrib] = await tx
        .select()
        .from(goalContributions)
        .where(
          and(
            eq(goalContributions.id, contributionId),
            eq(goalContributions.goalId, goalId),
            eq(goalContributions.userId, userId)
          )
        );

      if (!contrib) {
        throw new Error("Kontribusi tidak ditemukan atau Anda tidak memiliki akses");
      }

      const updates: Record<string, unknown> = {};
      const newAmount = input.amount !== undefined ? parseFloat(input.amount) : parseFloat(contrib.amount);
      const targetTransactionId =
        input.transactionId !== undefined ? input.transactionId : contrib.transactionId;

      if (newAmount <= 0) {
        throw new Error("Nominal kontribusi harus lebih dari 0");
      }

      // 3. Check goal target limit
      const targetAmount = parseFloat(goal.targetAmount);
      const [otherContribAgg] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
        })
        .from(goalContributions)
        .where(
          and(
            eq(goalContributions.goalId, goalId),
            eq(goalContributions.userId, userId),
            ne(goalContributions.id, contributionId)
          )
        );

      const otherTotal = parseFloat(otherContribAgg?.total || "0.00");
      const remainingForThis = targetAmount - otherTotal;

      if (newAmount > remainingForThis + 0.0001) {
        throw new Error(
          `Nominal kontribusi (Rp${newAmount.toLocaleString("id-ID")}) melebihi sisa target goal (Rp${Math.max(remainingForThis, 0).toLocaleString("id-ID")})`
        );
      }

      // 4. If transaction linked: check double counting
      if (targetTransactionId) {
        const [sourceTx] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, targetTransactionId), eq(transactions.userId, userId)));

        if (!sourceTx) {
          throw new Error("Transaksi sumber tidak ditemukan atau bukan milik Anda");
        }

        const txAmount = parseFloat(sourceTx.amount);

        const [allocAgg] = await tx
          .select({
            totalAllocated: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
          })
          .from(goalContributions)
          .where(
            and(
              eq(goalContributions.transactionId, targetTransactionId),
              eq(goalContributions.userId, userId),
              ne(goalContributions.id, contributionId)
            )
          );

        const otherAllocated = parseFloat(allocAgg?.totalAllocated || "0.00");
        const availableAlloc = txAmount - otherAllocated;

        if (newAmount > availableAlloc + 0.0001) {
          throw new Error(
            `Nominal kontribusi melebihi batas alokasi transaksi (Tersedia: Rp${Math.max(availableAlloc, 0).toLocaleString("id-ID")} dari total Rp${txAmount.toLocaleString("id-ID")})`
          );
        }

        updates.transactionId = targetTransactionId;
      } else if (input.transactionId === null) {
        updates.transactionId = null;
      }

      if (input.amount !== undefined) {
        updates.amount = newAmount.toFixed(2);
      }
      if (input.contributionDate !== undefined) {
        updates.contributionDate = jakartaDateStringToUtc(input.contributionDate);
      }
      if (input.description !== undefined) {
        updates.description = input.description;
      }

      if (Object.keys(updates).length > 0) {
        await tx
          .update(goalContributions)
          .set(updates)
          .where(eq(goalContributions.id, contributionId));
      }

      // 5. Update goal status (if reached -> COMPLETED; if was COMPLETED and now below target -> ACTIVE)
      const newTotal = otherTotal + newAmount;
      if (newTotal >= targetAmount - 0.0001 && goal.status !== "COMPLETED") {
        await tx
          .update(financialGoals)
          .set({ status: "COMPLETED" })
          .where(eq(financialGoals.id, goalId));
      } else if (newTotal < targetAmount - 0.0001 && goal.status === "COMPLETED") {
        await tx
          .update(financialGoals)
          .set({ status: "ACTIVE" })
          .where(eq(financialGoals.id, goalId));
      }

      const [updated] = await tx
        .select()
        .from(goalContributions)
        .where(eq(goalContributions.id, contributionId));

      return {
        id: updated.id,
        goalId: updated.goalId,
        userId: updated.userId,
        transactionId: updated.transactionId,
        amount: parseFloat(updated.amount),
        contributionDate: updated.contributionDate,
        description: updated.description,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Delete a contribution.
   * Progress recalculates automatically. Goal reverts from COMPLETED to ACTIVE if below target.
   */
  static async deleteContribution(
    userId: string,
    goalId: string,
    contributionId: string
  ): Promise<{ deleted: boolean }> {
    return await db.transaction(async (tx) => {
      const [goal] = await tx
        .select()
        .from(financialGoals)
        .where(and(eq(financialGoals.id, goalId), eq(financialGoals.userId, userId)))
        .for("update");

      if (!goal) {
        throw new Error("Goal tidak ditemukan atau Anda tidak memiliki akses");
      }

      const [contrib] = await tx
        .select()
        .from(goalContributions)
        .where(
          and(
            eq(goalContributions.id, contributionId),
            eq(goalContributions.goalId, goalId),
            eq(goalContributions.userId, userId)
          )
        );

      if (!contrib) {
        return { deleted: false };
      }

      await tx
        .delete(goalContributions)
        .where(eq(goalContributions.id, contributionId));

      // Check new total
      const [contribAgg] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${goalContributions.amount}), '0.00')`,
        })
        .from(goalContributions)
        .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)));

      const newTotal = parseFloat(contribAgg?.total || "0.00");
      const targetAmount = parseFloat(goal.targetAmount);

      if (newTotal < targetAmount - 0.0001 && goal.status === "COMPLETED") {
        await tx
          .update(financialGoals)
          .set({ status: "ACTIVE" })
          .where(eq(financialGoals.id, goalId));
      }

      return { deleted: true };
    });
  }

  /**
   * Get goal summary for dashboard integration.
   * Efficient server-side aggregation without N+1 query.
   */
  static async getGoalSummary(userId: string): Promise<GoalSummaryDTO> {
    const allGoals = await this.listGoals(userId);

    const activeGoals = allGoals.filter((g) => g.status === "ACTIVE");
    const completedGoals = allGoals.filter((g) => g.status === "COMPLETED");

    const totalTargetAmount = allGoals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalContributedAmount = allGoals.reduce((sum, g) => sum + g.contributedAmount, 0);
    const overallProgressPercentage =
      totalTargetAmount > 0
        ? Math.round(((totalContributedAmount / totalTargetAmount) * 100) * 100) / 100
        : 0;

    return {
      totalGoalsCount: allGoals.length,
      activeGoalsCount: activeGoals.length,
      completedGoalsCount: completedGoals.length,
      totalTargetAmount,
      totalContributedAmount,
      overallProgressPercentage,
      activeGoals: activeGoals.slice(0, 4), // Top 4 active goals for dashboard widget
    };
  }
}
