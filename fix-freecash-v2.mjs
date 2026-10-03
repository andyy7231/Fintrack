import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/account.service.ts';
let content = readFileSync(filePath, 'utf8');

// Find the getFreeCash method and replace its implementation
const marker1 = '      // 2. Sum active budget allocations for this account';
const marker2 = '      // 3. Free cash = total balance - allocations';

const idx1 = content.indexOf(marker1);
const idx2 = content.indexOf(marker2);

if (idx1 === -1 || idx2 === -1) {
  console.error('Markers not found');
  console.log('idx1:', idx1, 'idx2:', idx2);
  process.exit(1);
}

const before = content.substring(0, idx1);
const after = content.substring(idx2);

const newMiddle = `      // 2. Calculate sum of REMAINING active budget allocations
      // Free Cash = Actual Balance - Sum(Remaining Budgets), NOT original allocations
      const now = new Date();
      const activeBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.accountId, accountId),
            lte(budgets.startDate, now),
            gt(budgets.endDate, now)
          )
        );
      
      let totalRemainingAllocated = 0;
      
      for (const budget of activeBudgets) {
        const { BudgetService } = await import("./budget.service");
        const budgetWithSpent = await BudgetService.findApplicableBudget(
          userId,
          accountId,
          budget.categoryId,
          now
        );
        
        if (budgetWithSpent) {
          totalRemainingAllocated += Math.max(0, budgetWithSpent.remaining);
        }
      }

`;

let newContent = before + newMiddle + after;

// Fix the variable name in the calculation
newContent = newContent.replace(
  'const freeCash = totalBalance - totalAllocated;',
  'const freeCash = totalBalance - totalRemainingAllocated;'
);

writeFileSync(filePath, newContent, 'utf8');
console.log('✓ Fixed getFreeCash to use REMAINING budget amounts');
