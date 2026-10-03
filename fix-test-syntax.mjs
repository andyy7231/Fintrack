import { readFileSync, writeFileSync } from 'fs';

const filePath = '__tests__/services/budget-expense-integration.test.ts';
let content = readFileSync(filePath, 'utf8');

// Fix the broken syntax - use Transportation2 as variable name
content = content.replace(/const updatedTransportation \(second\)Budget/g, 'const updatedTransportation2Budget');
content = content.replace(/updatedTransportation \(second\)Budget/g, 'updatedTransportation2Budget');
content = content.replace(/housingBudget\.id/g, 'transportation2Budget.id');
content = content.replace(/const housingBudget/g, 'const transportation2Budget');
content = content.replace(/Transportation \(second\)/g, 'Transportation-2');

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed test syntax');
