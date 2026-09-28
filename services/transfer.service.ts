import { db } from "@/lib/db";
import { transfers, accounts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { CreateTransferInput } from "@/schemas/transfer.schema";

export class TransferService {
  /**
   * Execute an atomic transfer between two accounts of the same user.
   * Uses database transaction to ensure atomicity.
   */
  static async createTransfer(userId: string, input: CreateTransferInput) {
    if (input.fromAccountId === input.toAccountId) {
      throw new Error("Akun asal dan akun tujuan transfer tidak boleh sama.");
    }

    return db.transaction(async (tx) => {
      // 1. Fetch and verify source account ownership
      const [fromAcc] = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.fromAccountId), eq(accounts.userId, userId)))
        .limit(1);

      if (!fromAcc) {
        throw new Error("Akun asal tidak ditemukan atau bukan milik Anda.");
      }

      if (!fromAcc.isActive) {
        throw new Error("Akun asal sedang dinonaktifkan.");
      }

      // 2. Fetch and verify destination account ownership
      const [toAcc] = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.toAccountId), eq(accounts.userId, userId)))
        .limit(1);

      if (!toAcc) {
        throw new Error("Akun tujuan tidak ditemukan atau bukan milik Anda.");
      }

      if (!toAcc.isActive) {
        throw new Error("Akun tujuan sedang dinonaktifkan.");
      }

      // 3. Currency matching rule (Phase 2 rejects currency mismatch)
      if (fromAcc.currency !== toAcc.currency) {
        throw new Error(
          `Mata uang akun berbeda (${fromAcc.currency} vs ${toAcc.currency}). Konversi otomatis belum didukung.`
        );
      }

      // 4. Insert transfer record atomically
      const [transferRecord] = await tx
        .insert(transfers)
        .values({
          userId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          amount: input.amount,
          description: input.description || null,
          transferDate: input.transferDate,
        })
        .returning();

      return transferRecord;
    });
  }

  /**
   * List all transfers for the user with account names
   */
  static async getTransfers(userId: string) {
    return db
      .select({
        id: transfers.id,
        userId: transfers.userId,
        fromAccountId: transfers.fromAccountId,
        toAccountId: transfers.toAccountId,
        amount: transfers.amount,
        description: transfers.description,
        transferDate: transfers.transferDate,
        createdAt: transfers.createdAt,
      })
      .from(transfers)
      .where(eq(transfers.userId, userId))
      .orderBy(desc(transfers.transferDate), desc(transfers.createdAt));
  }

  /**
   * Delete transfer with ownership check
   */
  static async deleteTransfer(userId: string, transferId: string) {
    const [deleted] = await db
      .delete(transfers)
      .where(and(eq(transfers.id, transferId), eq(transfers.userId, userId)))
      .returning();

    return deleted ?? null;
  }
}
