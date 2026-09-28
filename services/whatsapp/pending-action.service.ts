import { db } from "@/lib/db";
import { whatsappPendingActions } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { TransactionService } from "@/services/transaction.service";
import { TransferService } from "@/services/transfer.service";

const PENDING_ACTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PendingActionPayload {
  amount: number;
  description: string;
  transactionDate: string | Date;
  accountId?: string;
  categoryId?: string | null;
  fromAccountId?: string;
  toAccountId?: string;
}

export class PendingActionService {
  /**
   * Create a new persistent pending action for an interpreted financial intent.
   * Cancels any previous pending actions for the same user.
   */
  static async createPendingAction(
    userId: string,
    phoneNumber: string,
    whatsappMessageId: string,
    intentType: "EXPENSE" | "INCOME" | "TRANSFER",
    payload: PendingActionPayload
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

    const [created] = await db
      .insert(whatsappPendingActions)
      .values({
        userId,
        phoneNumber,
        whatsappMessageId,
        intentType,
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
   * Execute confirmation: routes strictly through the existing financial core.
   * Ensures idempotency: duplicate confirmation requests are rejected.
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

    // Step 1: Mark CONFIRMED before financial execution
    await db
      .update(whatsappPendingActions)
      .set({ status: "CONFIRMED", updatedAt: new Date() })
      .where(eq(whatsappPendingActions.id, actionId));

    const payload = action.intentPayload as unknown as PendingActionPayload;

    let executionResult: unknown = null;

    try {
      if (action.intentType === "EXPENSE" || action.intentType === "INCOME") {
        if (!payload.accountId) {
          throw new Error("Akun transaksi wajib ada.");
        }

        executionResult = await TransactionService.createTransaction(userId, {
          accountId: payload.accountId,
          categoryId: payload.categoryId || null,
          type: action.intentType,
          amount: payload.amount.toFixed(2),
          description: payload.description,
          transactionDate: new Date(payload.transactionDate),
        });
      } else if (action.intentType === "TRANSFER") {
        if (!payload.fromAccountId || !payload.toAccountId) {
          throw new Error("Akun asal dan akun tujuan transfer wajib ada.");
        }

        executionResult = await TransferService.createTransfer(userId, {
          fromAccountId: payload.fromAccountId,
          toAccountId: payload.toAccountId,
          amount: payload.amount.toFixed(2),
          description: payload.description,
          transferDate: new Date(payload.transactionDate),
        });
      }

      // Step 2: Mark EXECUTED after financial core confirms success
      await db
        .update(whatsappPendingActions)
        .set({ status: "EXECUTED", updatedAt: new Date() })
        .where(eq(whatsappPendingActions.id, actionId));

      return {
        success: true,
        actionType: action.intentType,
        result: executionResult,
      };
    } catch (err) {
      // If financial creation fails, mark FAILED and throw
      await db
        .update(whatsappPendingActions)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(eq(whatsappPendingActions.id, actionId));
      throw err;
    }
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
