import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/ai/provider.ts';
let content = readFileSync(filePath, 'utf8');

// Find the return statement in isFreeCashQuery and replace it
const marker = 'export function isFreeCashQuery(text: string): boolean {';
const endMarker = '\n}';

const idx1 = content.indexOf(marker);
if (idx1 === -1) {
  console.error('Function start not found');
  process.exit(1);
}

// Find the closing brace for this function (look for the next standalone closing brace)
let idx2 = content.indexOf('\n}\n\n// ───', idx1);
if (idx2 === -1) {
  idx2 = content.indexOf('\n}', idx1 + 100); // Find next closing brace after some offset
}

const before = content.substring(0, idx1);
const after = content.substring(idx2 + 2); // +2 for \n}

const newFunction = `export function isFreeCashQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  
  // Explicit Free Cash keywords
  if (
    lower.includes("uang free") ||
    lower.includes("free cash") ||
    lower.includes("uang bebas") ||
    lower.includes("kas free") ||
    lower.includes("uang tersedia") ||
    lower.includes("uang bisa dipakai") ||
    lower.includes("uang yang bisa") ||
    (lower.includes("sisa") && lower.includes("free")) ||
    (lower.includes("berapa") && lower.includes("free"))
  ) {
    return true;
  }
  
  // DEFAULT: "sisa uang" queries return Free Cash (unallocated money)
  // Per spec requirement: "berapa sisa uang saya" should return Free Cash, not Actual Balance
  if (
    lower.includes("sisa uang") ||
    lower.includes("sisa duit") ||
    lower.includes("uang sisa")
  ) {
    return true;
  }
  
  // Only return Total Balance if user explicitly asks for "total" or "keseluruhan"
  if (
    lower.includes("total") ||
    lower.includes("keseluruhan") ||
    lower.includes("semua saldo") ||
    lower.includes("jumlah seluruh")
  ) {
    return false;
  }
  
  // Default balance queries return Free Cash (safer default for budgeting)
  return true;
}`;

const newContent = before + newFunction + after;

writeFileSync(filePath, newContent, 'utf8');
console.log('✓ Updated isFreeCashQuery function');
console.log('✓ "sisa uang" queries now return Free Cash by default');
