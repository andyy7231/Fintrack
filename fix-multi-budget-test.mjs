import { readFileSync, writeFileSync } from 'fs';

const filePath = '__tests__/services/budget-expense-integration.test.ts';
let content = readFileSync(filePath, 'utf8');

// Fix the second budget amount to be within remaining Free Cash
// After 600k Food budget, only 400k left, so use 300k instead of 500k
content = content.replace(
  /amount: '500000',  \/\/ For transportation2Budget/g,
  "amount: '300000',"
);

// Also fix the expected remaining value
content = content.replace(
  /\.remainingAmount\)\.toBe\(750000\);/g,
  '.remainingAmount).toBe(300000);'
);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed multiple budgets test amounts');
