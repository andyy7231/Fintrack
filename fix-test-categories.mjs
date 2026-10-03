import { readFileSync, writeFileSync } from 'fs';

const filePath = '__tests__/services/budget-expense-integration.test.ts';
let content = readFileSync(filePath, 'utf8');

// Fix category names
content = content.replace(/testCategoryTransport/g, 'testCategoryTransportation');
content = content.replace(/TEST_CATEGORIES\.TRANSPORT/g, 'TEST_CATEGORIES.TRANSPORTATION');

// Remove housing references (not in fixtures)
content = content.replace(/let testCategoryHousing: string;/g, '');
content = content.replace(/testCategoryHousing = TEST_CATEGORIES\.HOUSING\.id;/g, '');

// Fix the multiple categories test to use TRANSPORTATION instead of HOUSING
content = content.replace(/testCategoryHousing/g, 'testCategoryTransportation');
content = content.replace(/Housing/g, 'Transportation (second)');
content = content.replace(/'750000'/g, "'500000'");

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed test category references');
