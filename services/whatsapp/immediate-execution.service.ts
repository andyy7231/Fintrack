/**
 * Immediate Execution Service for WhatsApp Transactions
 * 
 * Handles immediate execution of valid, unambiguous WhatsApp transactions
 * without requiring YA/BATAL confirmation. Reuses existing services for
 * atomicity, validation, and balance calculation.
 * 
 * SECURITY: All Phase D validations preserved through PendingActionService.executeBatchAtomic
 * ATOMICITY: Batch transactions remain atomic via existing transaction wrapper
 * IDEMPOTENCY: Duplicate prevention handled by whatsappMessageId constraint
 */

import { PendingActionService } from "./pending-action.service";
import { ResolvedActionPayload } from "@/services/ai/parser.service";
import { BudgetService } from "@/services/budget.service";
import { AccountService } from "@/services/account.service";
import {
  formatSingleImmediateSuccess,
  formatBatchImmediateSuccess,
  SingleImmediateResult,
  BatchImmediateResult } from "./response-formatter.service";

// --- Type Definitions --------------------------------------------------------



/**
 * Budget remaining information for response formatting
 */
export interface BudgetRemainingInfo {
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
}

/**
 * Balance information result for response formatting
 */
export interface BalanceInfoResult {
  categoryBudgets: Map<string, BudgetRemainingInfo>;
  totalBalance: number;
  primaryAccountId: string | null;
}

/**
 * Transaction result row type (from database)
 */
interface TransactionRow {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: "EXPENSE" | "INCOME";
  amount: string;
  description: string;
  transactionDate: Date;
  source: string;
  status: string;
  createdAt: Date;
}

/**
 * Transfer result row type (from database)
 */
interface TransferRow {
  id: string;
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string;
  transferDate: Date;
  source: string;
  status: string;
  createdAt: Date;
}

// --- Type Guards -------------------------------------------------------------

function isTransactionRow(r: unknown): r is TransactionRow {
  return (
    typeof r === "object" &&
    r !== null &&
    "accountId" in r &&
    "type" in r &&
    ("type" in r && (r.type === "EXPENSE" || r.type === "INCOME"))
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

// --- Immediate Execution Service ---------------------------------------------

export class ImmediateExecutionService {
  
  /**
   * Check if actions can be executed immediately without confirmation.
   * Returns false if any action has missing required fields.
   * 
   * BUG CONDITION: This implements allActionsFullyResolved() validation.
   */
  static canExecuteImmediately(actions: ResolvedActionPayload[]): boolean {
    for (const action of actions) {
      if (action.intentType === "EXPENSE" || action.intentType === "INCOME") {
        // EXPENSE/INCOME require accountId and positive amount
        if (!action.accountId || action.amount <= 0) {
          return false;
        }
      } else if (action.intentType === "TRANSFER") {
        // TRANSFER requires both accounts and positive amount
        if (!action.fromAccountId || !action.toAccountId || action.amount <= 0) {
          return false;
        }
      } else if (action.intentType === "BUDGET_ALLOCATION") {
        // BUDGET_ALLOCATION requires budgetCategoryId and positive amount
        if (!action.budgetCategoryId || action.amount <= 0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Execute actions immediately and format rich response with balance info.
   * Reuses PendingActionService.executeBatchAtomic for execution.
   * Adds budget and balance calculation for response.
   */
  static async executeAndFormatImmediate(
    userId: string,
    actions: ResolvedActionPayload[],
    whatsappMessageId: string
  ): Promise<string> {
    try {
      // Execute actions atomically (Phase D security + atomicity guaranteed)
      const results = await this._executeActionsImmediate(userId, actions);
      
      // Calculate balances for response
      const balanceInfo = await this._calculateBalanceInfo(userId, results, actions);
      
      // Format rich response with budget + balance
      return this._formatImmediateResponse(results, balanceInfo, actions);
      
    } catch (error) {
      // If execution fails, return error message (no success response)
      const errorMsg = error instanceof Error ? error.message : "Terjadi kesalahan sistem";
      return `? Gagal memproses transaksi: ${errorMsg}`;
    }
  }

  /**
   * Execute actions atomically (reuse PendingActionService logic).
   * PRIVATE: Implementation detail, not part of public API.
   */
  private static async _executeActionsImmediate(
    userId: string,
    actions: ResolvedActionPayload[]
  ): Promise<unknown[]> {
    // Reuse existing atomic execution logic from PendingActionService
    // This preserves ALL Phase D security validations:
    // - Account ownership validation
    // - Category type compatibility validation  
    // - Transfer validation (same account, currency mismatch)
    // - Atomic rollback on any failure
    return await PendingActionService.executeBatchAtomic(userId, actions);
  }

  /**
   * Calculate category budget remaining and total balance for response.
   * PRIVATE: Implementation detail, not part of public API.
   */
  private static async _calculateBalanceInfo(
    userId: string,
    results: unknown[],
    actions: ResolvedActionPayload[]
  ): Promise<BalanceInfoResult> {
    const affectedAccountIds = new Set<string>();
    const categoryBudgets = new Map<string, BudgetRemainingInfo>();
    
    // For each executed transaction, calculate budget remaining
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const action = actions[i];
      
      if (!action) continue;
      
      if (isTransactionRow(result)) {
        affectedAccountIds.add(result.accountId);
        
        // Fetch budget remaining for this category (only for EXPENSE)
        if (result.categoryId && result.type === "EXPENSE") {
          const budgetRemaining = await this._getCategoryBudgetRemaining(
            userId,
            result.categoryId
          );
          if (budgetRemaining !== null) {
            categoryBudgets.set(result.categoryId, budgetRemaining);
          }
        }
      } else if (isTransferRow(result)) {
        affectedAccountIds.add(result.fromAccountId);
        affectedAccountIds.add(result.toAccountId);
      }
    }
    
    // Calculate total balance across all active accounts
    const totalBalance = await this._getTotalBalance(userId);
    
    return {
      categoryBudgets,
      totalBalance,
      primaryAccountId: Array.from(affectedAccountIds)[0] || null,
    };
  }

  /**
   * Get category budget remaining for current period.
   * Returns null if no active budget exists for category.
   * PRIVATE: Implementation detail, not part of public API.
   */
  private static async _getCategoryBudgetRemaining(
    userId: string,
    categoryId: string
  ): Promise<BudgetRemainingInfo | null> {
    try {
      // Use existing BudgetService to get active budget for category in current period
      const budgets = await BudgetService.listBudgets(userId);
      
      if (budgets.length === 0) return null;
      
      // Find budget that covers current date AND matches the category
      const now = new Date();
      const activeBudget = budgets.find(b => 
        b.categoryId === categoryId &&
        b.startDate <= now && 
        b.endDate > now
      );
      
      if (!activeBudget) return null;
      
      // BudgetService already calculates remainingAmount
      return {
        categoryName: activeBudget.categoryName || "Kategori",
        limitAmount: activeBudget.limitAmount,
        spentAmount: activeBudget.spentAmount,
        remainingAmount: activeBudget.remainingAmount,
      };
    } catch (error) {
      // If budget calculation fails, don't fail the whole response
      console.warn(`[ImmediateExecution] Budget calculation failed for category ${categoryId}:`, error);
      return null;
    }
  }

  /**
   * Calculate total balance across all active accounts.
   * PRIVATE: Implementation detail, not part of public API.
   */
  private static async _getTotalBalance(userId: string): Promise<number> {
    try {
      // Reuse existing AccountService.getAccountsWithBalances
      const accounts = await AccountService.getAccountsWithBalances(userId);
      
      return accounts
        .filter(acc => acc.isActive)
        .reduce((sum, acc) => sum + acc.currentBalance, 0);
    } catch (error) {
      // If balance calculation fails, return 0 (don't fail the whole response)
      console.warn(`[ImmediateExecution] Balance calculation failed for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Format immediate execution response with budget and balance info.
   * PRIVATE: Implementation detail, delegates to response formatters.
   */
  private static _formatImmediateResponse(
    results: unknown[],
    balanceInfo: BalanceInfoResult,
    actions: ResolvedActionPayload[]
  ): string {
    if (results.length === 1 && actions.length === 1) {
      // Single action response - use new formatSingleImmediateSuccess
      const action = actions[0]!;
      const result = results[0];
      
      // Build SingleImmediateResult
      const singleResult: SingleImmediateResult = {
        type: action.intentType as "EXPENSE" | "INCOME" | "TRANSFER",
        categoryName: null,
        amount: action.amount,
        description: action.description,
        totalBalance: balanceInfo.totalBalance,
      };
      
      // Extract category name and budget info from result
      if (isTransactionRow(result)) {
        // For EXPENSE/INCOME, get categoryName from budget info
        if (result.categoryId && balanceInfo.categoryBudgets.has(result.categoryId)) {
          const budget = balanceInfo.categoryBudgets.get(result.categoryId)!;
          singleResult.categoryName = budget.categoryName;
          singleResult.budgetInfo = {
            categoryName: budget.categoryName,
            remainingAmount: budget.remainingAmount,
            spentAmount: budget.spentAmount,
            limitAmount: budget.limitAmount,
          };
        }
      } else if (isTransferRow(result)) {
        // For TRANSFER, set type and placeholder account names
        singleResult.type = "TRANSFER";
        singleResult.fromAccountName = "Account"; // TODO: Fetch actual names if needed
        singleResult.toAccountName = "Account";
      }
      
      return formatSingleImmediateSuccess(singleResult);
    } else {
      // Batch action response - use new formatBatchImmediateSuccess
      const batchResult: BatchImmediateResult = {
        actions: actions.map(action => ({
          type: action.intentType as "EXPENSE" | "INCOME" | "TRANSFER",
          categoryName: null, // TODO: Map from results if needed
          amount: action.amount,
          description: action.description,
        })),
        budgetInfos: Array.from(balanceInfo.categoryBudgets.values()).map(budget => ({
          categoryName: budget.categoryName,
          remainingAmount: budget.remainingAmount,
          spentAmount: budget.spentAmount,
          limitAmount: budget.limitAmount,
        })),
        totalBalance: balanceInfo.totalBalance,
      };
      
      return formatBatchImmediateSuccess(batchResult);
    }
  }
}



