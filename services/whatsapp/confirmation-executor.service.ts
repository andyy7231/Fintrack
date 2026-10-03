/**
 * WhatsApp Confirmation Executor
 *
 * Wraps PendingActionService.confirmAction() and builds the rich response
 * using the WhatsApp Response Formatter.
 *
 * Separation of concerns:
 *  - PendingActionService: DB mutation + atomic commit
 *  - ConfirmationExecutor: post-execution balance fetch + response building
 */

import { PendingActionService, BatchPendingActionPayload } from "./pending-action.service";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import {
  formatExpenseSuccess,
  formatIncomeSuccess,
  formatTransferSuccess,
  formatBatchSuccess,
  formatConfirmationSuccess,
  formatSystemError,
  BatchItem,
} from "./response-formatter.service";

// ─── DB row types returned by _executeBatchAtomic ────────────────────────────

interface TransactionRow {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: "EXPENSE" | "INCOME";
  amount: string;
  description: string;
}

interface TransferRow {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string | null;
}

function isTransactionRow(r: unknown): r is TransactionRow {
  return (
    typeof r === "object" &&
    r !== null &&
    "accountId" in r &&
    "type" in r
  );
}

function isTransferRow(r: unknown): r is TransferRow {
  return (
    typeof r === "object" &&
    r !== null &&
    "fromAccountId" in r &&
    "toAccountId" in r
  );
}

export class ConfirmationExecutor {
  /**
   * Execute a pending action and return a formatted WhatsApp response string.
   *
   * Fetches post-execution balance from the affected account(s) so the response
   * contains real values, not estimates.
   */
  static async executeAndFormat(
    actionId: string,
    userId: string
  ): Promise<string> {
    try {
      const confirmResult = await PendingActionService.confirmAction(actionId, userId);
      const { results, actionCount } = confirmResult;
      const payload = confirmResult as unknown as { actionType: string };

      // ── Single action → rich response ────────────────────────────────────────
      if (actionCount === 1 && results.length === 1) {
        const row = results[0];

        if (isTransferRow(row)) {
          const fromAcc = await AccountService.getAccountById(userId, row.fromAccountId);
          return formatTransferSuccess({
            fromAccountName: fromAcc?.name ?? "Akun Sumber",
            toAccountName: (await AccountService.getAccountById(userId, row.toAccountId))?.name ?? "Akun Tujuan",
            amount: parseFloat(row.amount),
            fromAccountBalance: fromAcc?.currentBalance ?? 0,
          });
        }

        if (isTransactionRow(row)) {
          const acc = await AccountService.getAccountById(userId, row.accountId);
          const accName = acc?.name ?? "Akun";
          const accBalance = acc?.currentBalance ?? 0;
          let catName: string | null = null;
          if (row.categoryId) {
            const cats = await CategoryService.getCategories(userId, row.type);
            catName = cats.find((c) => c.id === row.categoryId)?.name ?? null;
          }

          const r = {
            type: row.type,
            categoryName: catName,
            amount: parseFloat(row.amount),
            description: row.description,
            accountName: accName,
            accountBalance: accBalance,
          };

          return row.type === "EXPENSE"
            ? formatExpenseSuccess(r)
            : formatIncomeSuccess(r);
        }
      }

      // ── Multi-action → batch summary ──────────────────────────────────────────
      const batchItems: BatchItem[] = [];
      let primaryAccountId: string | undefined;

      for (const row of results) {
        if (isTransactionRow(row)) {
          let catName: string | null = null;
          if (row.categoryId) {
            const cats = await CategoryService.getCategories(userId, row.type);
            catName = cats.find((c) => c.id === row.categoryId)?.name ?? null;
          }
          batchItems.push({
            type: row.type,
            categoryName: catName,
            amount: parseFloat(row.amount),
            description: row.description,
          });
          if (!primaryAccountId) primaryAccountId = row.accountId;
        } else if (isTransferRow(row)) {
          batchItems.push({
            type: "TRANSFER",
            categoryName: null,
            amount: parseFloat(row.amount),
            description: row.description ?? "Transfer",
          });
        }
      }

      if (batchItems.length > 0) {
        let accName: string | undefined;
        let accBalance: number | undefined;
        if (primaryAccountId) {
          const acc = await AccountService.getAccountById(userId, primaryAccountId);
          accName = acc?.name;
          accBalance = acc?.currentBalance;
        }

        return formatBatchSuccess({
          items: batchItems,
          accountName: accName,
          accountBalance: accBalance,
        });
      }

      // Fallback for budget allocations / edge cases
      const totalExpense = batchItems.filter(i => i.type === "EXPENSE").reduce((s, i) => s + i.amount, 0);
      const totalIncome = batchItems.filter(i => i.type === "INCOME").reduce((s, i) => s + i.amount, 0);
      return formatConfirmationSuccess({
        count: actionCount,
        totalExpense,
        totalIncome,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      if (errMsg.includes("DUPLICATE_CONFIRMATION")) {
        return "Transaksi ini sudah dicatat sebelumnya.";
      }
      if (errMsg.includes("kadaluarsa")) {
        return "Konfirmasi sudah kadaluarsa (melebihi batas waktu 5 menit). Silakan kirim ulang transaksi.";
      }
      if (errMsg.includes("dibatalkan")) {
        return "Transaksi ini sudah dibatalkan sebelumnya.";
      }
      console.error("[ConfirmationExecutor] Error:", err);
      return formatSystemError();
    }
  }
}
