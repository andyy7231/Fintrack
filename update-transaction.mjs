import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/transaction.service.ts';
let content = readFileSync(filePath, 'utf8');

// Find the position right after category validation closing brace
const marker = `      }
    }

    // 3. Insert transaction`;

if (!content.includes(marker)) {
  console.error('Marker not found');
  process.exit(1);
}

const budgetValidation = `      }
    }

    // 3. NEW: Budget-aware validation for EXPENSE transactions
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

content = content.replace(marker, budgetValidation);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Added budget validation to TransactionService');
