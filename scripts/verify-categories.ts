import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { categories } from "@/db/schema";
import { isNull } from "drizzle-orm";

async function main() {
  const all = await db
    .select({ name: categories.name, type: categories.type, isDefault: categories.isDefault })
    .from(categories)
    .where(isNull(categories.userId))
    .orderBy(categories.type, categories.name);

  console.log("=== GLOBAL CATEGORIES AFTER MIGRATION ===");
  for (const c of all) {
    console.log(`  ${c.type.padEnd(7)} | ${c.name}`);
  }
  const incomeCount = all.filter((c) => c.type === "INCOME").length;
  const expenseCount = all.filter((c) => c.type === "EXPENSE").length;
  console.log(`\nTotal: ${all.length} | INCOME: ${incomeCount} | EXPENSE: ${expenseCount}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
