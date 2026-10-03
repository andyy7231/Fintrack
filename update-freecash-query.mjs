import { readFileSync, writeFileSync } from 'fs';

const filePath = 'services/ai/provider.ts';
let content = readFileSync(filePath, 'utf8');

// Find and update isFreeCashQuery function
const oldFunction = `export function isFreeCashQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes("uang free") ||
    lower.includes("free cash") ||
    lower.includes("uang bebas") ||
    lower.includes("kas free") ||
    lower.includes("uang tersedia") ||
    lower.includes("uang bisa dipakai") ||
    lower.includes("uang yang bisa") ||
    (lower.includes("sisa") && lower.includes("free")) ||
    (lower.includes("berapa") && lower.includes("free"))
  );
}`;

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
    lower.includes("semua") ||
    lower.includes("jumlah seluruh")
  ) {
    return false;
  }
  
  // Default balance queries return Free Cash (safer default for budgeting)
  return true;
}`;

if (!content.includes(oldFunction)) {
  console.error('Function not found - may have different formatting');
  process.exit(1);
}

content = content.replace(oldFunction, newFunction);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Updated isFreeCashQuery to default to Free Cash for "sisa uang" queries');
console.log('✓ Per spec: "berapa sisa uang saya" now returns Free Cash, not Actual Balance');
