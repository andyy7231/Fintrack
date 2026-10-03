import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/transaction.service.ts';
let content = readFileSync(filePath, 'utf8');

// Find and replace the comment
const oldComment = '    // 3. Insert transaction';
const newSection = `    // 3. NEW: Budget-aware validation for EXPENSE transactions
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
        console.warn(\`[Budget Warning] \${validation.warnings.join(". ")}\`);
      }
    }

    // 4. Insert transaction`;

if (!content.includes(oldComment)) {
  console.error('Comment marker not found');
  process.exit(1);
}

content = content.replace(oldComment, newSection);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Added budget validation to TransactionService.createTransaction');
console.log('✓ EXPENSE transactions now validate against budgets before insert');
