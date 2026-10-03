import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/account.service.ts';
let content = readFileSync(filePath, 'utf8');

// Fix the date boundary issue
const oldLine = '            gte(budgets.endDate, now)     // Budget hasn\'t ended';
const newLine = '            gt(budgets.endDate, now)      // Budget hasn\'t ended (exclusive upper bound)';

if (!content.includes(oldLine)) {
  console.error('Line not found - may already be fixed');
  // Check if already correct
  if (content.includes('gt(budgets.endDate, now)')) {
    console.log('✓ Already fixed: using gt() for exclusive upper bound');
    process.exit(0);
  }
  process.exit(1);
}

content = content.replace(oldLine, newLine);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed getFreeCash date boundary: gte() → gt() for exclusive upper bound');
console.log('✓ Active budgets now correctly match: startDate <= now < endDate');
