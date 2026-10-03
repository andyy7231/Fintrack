import { readFileSync, writeFileSync } from 'fs';

const filePath = '__tests__/services/budget-expense-integration.test.ts';
let content = readFileSync(filePath, 'utf8');

// Find and replace the 500000 amount in the transportation2Budget
const oldLine = "      amount: '500000',";
const newLine = "      amount: '300000', // Reduced to fit within remaining Free Cash";

// Only replace the second occurrence (transportation2Budget, not the first foodBudget which is 600k)
const parts = content.split(oldLine);
if (parts.length >= 3) {
  // Rejoin: first part + first 500000 + middle + REPLACED 500000 + rest
  content = parts[0] + oldLine + parts[1] + newLine + parts.slice(2).join(oldLine);
}

// Also update the expected remaining
content = content.replace(
  'expect(updatedTransportation2Budget.remainingAmount).toBe(750000);',
  'expect(updatedTransportation2Budget.remainingAmount).toBe(300000);'
);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed transportation budget amount to 300k');
