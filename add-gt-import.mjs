import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/account.service.ts';
let content = readFileSync(filePath, 'utf8');

// Add gt to imports
const oldImport = 'import { eq, and, sql, lte, gte } from "drizzle-orm";';
const newImport = 'import { eq, and, sql, lte, gte, gt } from "drizzle-orm";';

if (!content.includes(oldImport)) {
  console.error('Import line not found');
  if (content.includes('gt } from "drizzle-orm"')) {
    console.log('✓ Already imported gt');
    process.exit(0);
  }
  process.exit(1);
}

content = content.replace(oldImport, newImport);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Added gt to drizzle-orm imports');
