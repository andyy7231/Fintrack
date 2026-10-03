import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/account.service.ts';
let content = readFileSync(filePath, 'utf8');

// Find the section to replace (from "// 2. Sum active budget allocations" to "const totalAllocated")
const oldSection = `      // 2. Sum active budget allocations for this account
      // Active = budget period includes current time (startDate <= now < endDate)
      const now = new Date();
      const [allocationsRes] = await db
        .select({
          total: sql<string>\`coalesce(sum(\${budgets.amount}), '0.00')\`,
        })
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.accountId, accountId),
            lte(budgets.startDate, now),  // Budget has started
            gt(budgets.endDate, now)      // Budget hasn't ended (exclusive upper bound)
          )
        );
      
      const totalAllocated = parseFloat(allocationsRes?.total || "0");`;

const newSection = `      // 2. Calculate sum of REMAINING active budget allocations
      // Free Cash = Actual Balance - Sum(Remaining Budgets), NOT original allocations
      const now = new Date();
      const activeBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.accountId, accountId),
            lte(budgets.startDate, now),  // Budget has started
            gt(budgets.endDate, now)      // Budget hasn't ended (exclusive upper bound)
          )
        );
      
      let totalRemainingAllocated = 0;
      
      // For each active budget, calculate remaining = original - spent
      for (const budget of activeBudgets) {
        const { BudgetService } = await import("./budget.service");
        
        // Get spent amount via budget service aggregation
        const budgetWithSpent = await BudgetService.findApplicableBudget(
          userId,
          accountId,
          budget.categoryId,
          now
        );
        
        if (budgetWithSpent) {
          // Use remaining amount (handles negative if overspent)
          totalRemainingAllocated += Math.max(0, budgetWithSpent.remaining);
        }
      }`;

if (!content.includes(oldSection)) {
  console.error('Section not found');
  process.exit(1);
}

content = content.replace(oldSection, newSection);

// Update the Free Cash calculation comment
content = content.replace(
  '      // 3. Free cash = total balance - allocations',
  '      // 3. Free cash = total balance - sum of remaining allocations'
);

content = content.replace(
  'const freeCash = totalBalance - totalAllocated;',
  'const freeCash = totalBalance - totalRemainingAllocated;'
);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed getFreeCash to use REMAINING budget amounts instead of original allocations');
console.log('✓ Free Cash = Actual Balance - Sum(Remaining Active Budgets)');
