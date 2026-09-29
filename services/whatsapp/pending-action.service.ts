import { db } from "@/lib/db";
import { whatsappPendingActions, transactions, transfers } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { TransactionService } from "@/services/transaction.service";
import { TransferService } from "@/services/transfer.service";
import { ResolvedActionPayload } from "@/services/ai/parser.service";

const PENDING_ACTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────────────────────

/**
 * Phase 5.1 BATCH payload stored in intentPayload JSONB column.
 * A "BATCH" pending action holds an ordered array of resolved actions that
 * are all committed atomically when the user confirms with YA.
 *
 * Single-action messages are stored as BATCH with one item — this unifies
 * the execution path and eliminates the old single-item special case.
 */
export interface BatchPendingActionPayload {
  actions: ResolvedActionPayload[];
}

// Keep legacy type for backward-compatible reads of old pending action rows
export interface LegacyPendingActionPayload {
  amount: number;
  description: string;
  transactionDate: string | Date;
  accountId?: string;
  categoryId?: string | null;
  fromAccountId?: string;
  toAccountId?: string;
}

export type PendingActionPayload = BatchPendingActionPayload | LegacyPendingActionPayload;

function isBatchPayload(p: unknown): p is BatchPendingActionPayload {
  return (
    typeof p === "object" &&
    p !== null &&
    "actions" in p &&
    Array.isArray((p as BatchPendingActionPayload).actions)
  );
}

// ─────────────────────────────────────────────────────────────
// PendingActionService
// ─────────────────────────────────────────────────────────────

export class PendingActionService {
  /**
   * Create a new persistent pending action for an interpreted financial intent.
   *
   * Phase 5.1: always stores as BATCH intentType with the resolved actions array.
   * Cancels any previous pending actions for the same user and phone number.
   */
  static async createPendingAction(
    userId: string,
    phoneNumber: string,
    whatsappMessageId: string,
    actions: ResolvedActionPayload[]
  ) {
    // Invalidate older pending actions for this user and phone
    await db
      .update(whatsappPendingActions)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(whatsappPendingActions.userId, userId),
          eq(whatsappPendingActions.phoneNumber, phoneNumber),
          eq(whatsappPendingActions.status, "PENDING")
        )
      );

    const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS);
    const payload: BatchPendingActionPayload = { actions };

    const [created] = await db
      .insert(whatsappPendingActions)
      .values({
        userId,
        phoneNumber,
        whatsappMessageId,
        intentType: "BATCH",
        intentPayload: payload as unknown as Record<string, unknown>,
        status: "PENDING",
        expiresAt,
      })
      .returning();

    return created;
  }

  /**
   * Find active, non-expired pending action for user and phone.
   */
  static async getActivePendingAction(userId: string, phoneNumber: string) {
    const [action] = await db
      .select()
      .from(whatsappPendingActions)
      .where(
        and(
          eq(whatsappPendingActions.userId, userId),
          eq(whatsappPendingActions.phoneNumber, phoneNumber),
          eq(whatsappPendingActions.status, "PENDING"),
          gte(whatsappPendingActions.expiresAt, new Date())
        )
      )
      .orderBy(desc(whatsappPendingActions.createdAt))
      .limit(1);

    return action || null;
  }

  /**
   * Execute confirmation atomically.
   *
   * Phase 5.1: All actions in the batch are committed inside a SINGLE
   * database transaction. If any one fails, ALL are rolled back.
   *
   * Idempotency: duplicate confirmation requests are rejected.
   */
  static async confirmAction(actionId: string, userId: string) {
    const [action] = await db
      .select()
      .from(whatsappPendingActions)
      .where(
        and(
          eq(whatsappPendingActions.id, actionId),
          eq(whatsappPendingActions.userId, userId)
        )
      )
      .limit(1);

    if (!action) {
      throw new Error("Aksi konfirmasi tidak ditemukan atau bukan milik Anda.");
    }

    if (action.status === "EXECUTED" || action.status === "CONFIRMED") {
      throw new Error("DUPLICATE_CONFIRMATION: Transaksi ini sudah dicatat sebelumnya.");
    }

    if (action.status === "CANCELLED") {
      throw new Error("Transaksi ini sudah dibatalkan sebelumnya.");
    }

    if (new Date() > action.expiresAt) {
      await db
        .update(whatsappPendingActions)
        .set({ status: "EXPIRED" })
        .where(eq(whatsappPendingActions.id, actionId));
      throw new Error("Konfirmasi sudah kadaluarsa (melebihi batas waktu 5 menit).");
    }

    // Step 1: Optimistic lock — mark CONFIRMED before financial execution
    await db
      .update(whatsappPendingActions)
      .set({ status: "CONFIRMED", updatedAt: new Date() })
      .where(eq(whatsappPendingActions.id, actionId));

    const payload = action.intentPayload as unknown;

    try {
      // Step 2: Route to the correct executor
      let results: unknown[];

      if (isBatchPayload(payload)) {
        // Phase 5.1: BATCH — execute atomically
        results = await this._executeBatchAtomic(userId, payload.actions);
      } else {
        // Legacy fallback: old single-action payload format
        results = [await this._executeLegacySingle(userId, action.intentType, payload as LegacyPendingActionPayload)];
      }

      // Step 3: Mark EXECUTED
      await db
        .update(whatsappPendingActions)
        .set({ status: "EXECUTED", updatedAt: new Date() })
        .where(eq(whatsappPendingActions.id, actionId));

      return {
        success: true,
        actionType: action.intentType,
        actionCount: isBatchPayload(payload) ? payload.actions.length : 1,
        results,
      };
    } catch (err) {
      // Financial creation failed — mark FAILED and rethrow
      await db
        .update(whatsappPendingActions)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(whatsappPendingActions.id, actionId));
      throw err;
    }
  }

  /**
   * Execute all actions in the batch as a single atomic database transaction.
   * Uses Drizzle's db.transaction() so either ALL commit or NONE do.
   */
  private static async _executeBatchAtomic(
    userId: string,
    actions: ResolvedActionPayload[]
  ): Promise<unknown[]> {
    return db.transaction(async (tx) => {
      const results: unknown[] = [];

      for (const action of actions) {
        if (action.intentType === "EXPENSE" || action.intentType === "INCOME") {
          if (!action.accountId) {
            throw new Error(`Akun transaksi wajib ada untuk item: ${action.description}`);
          }

          const [created] = await tx
            .insert(transactions)
            .values({
              userId,
              accountId: action.accountId,
              categoryId: action.categoryId || null,
              type: action.intentType,
              amount: action.amount.toFixed(2),
              description: action.description,
              transactionDate: new Date(action.transactionDate),
              source: "WHATSAPP",
              status: "CONFIRMED",
            })
            .returning();

          results.push(created);
        } else if (action.intentType === "TRANSFER") {
          if (!action.fromAccountId || !action.toAccountId) {
            throw new Error(
              `Akun asal dan tujuan transfer wajib ada untuk item: ${action.description}`
            );
          }

          const [created] = await tx
            .insert(transfers)
            .values({
              userId,
              fromAccountId: action.fromAccountId,
              toAccountId: action.toAccountId,
              amount: action.amount.toFixed(2),
              description: action.description || null,
              transferDate: new Date(action.transactionDate),
            })
            .returning();

          results.push(created);
        }
      }

      return results;
    });
  }

  /**
   * Legacy execution for old pending action rows (pre-5.1).
   * Reads the old single-payload format and routes accordingly.
   */
  private static async _executeLegacySingle(
    userId: string,
    intentType: string,
    payload: LegacyPendingActionPayload
  ): Promise<unknown> {
    if (intentType === "EXPENSE" || intentType === "INCOME") {
      if (!payload.accountId) throw new Error("Akun transaksi wajib ada.");
      return TransactionService.createTransaction(userId, {
        accountId: payload.accountId,
        categoryId: payload.categoryId || null,
        type: intentType as "EXPENSE" | "INCOME",
        amount: payload.amount.toFixed(2),
        description: payload.description,
        transactionDate: new Date(payload.transactionDate),
      });
    }

    if (intentType === "TRANSFER") {
      if (!payload.fromAccountId || !payload.toAccountId) {
        throw new Error("Akun asal dan akun tujuan transfer wajib ada.");
      }
      return TransferService.createTransfer(userId, {
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: payload.amount.toFixed(2),
        description: payload.description,
        transferDate: new Date(payload.transactionDate),
      });
    }

    throw new Error(`Tipe aksi tidak dikenal: ${intentType}`);
  }

  /**
   * Cancel an active pending action.
   */
  static async cancelAction(actionId: string, userId: string) {
    const result = await db
      .update(whatsappPendingActions)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(
        and(
          eq(whatsappPendingActions.id, actionId),
          eq(whatsappPendingActions.userId, userId),
          eq(whatsappPendingActions.status, "PENDING")
        )
      )
      .returning();

    return result.length > 0;
  }
}
