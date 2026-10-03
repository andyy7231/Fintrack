/**
 * Migration: Deduplicate and canonicalize categories
 *
 * This script:
 *  1. Renames global (userId=null) variant category names to canonical form
 *  2. Deletes global duplicates (keeping the canonical one)
 *  3. Reassigns transactions from deleted category IDs to canonical category IDs
 *  4. Applies the same cleanup to all per-user categories
 *  5. Inserts any missing global canonical categories
 *
 * Safe to run multiple times (idempotent).
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { categories, transactions } from "@/db/schema";
import { eq, isNull, isNotNull, and } from "drizzle-orm";
import { seedDefaultCategories } from "@/db/seed";

// Maps legacy names (lowercase) → canonical name
const CANONICAL_MAP: Record<string, string> = {
  "tagihan":            "Tagihan & Utilitas",
  "utilitas & tagihan": "Tagihan & Utilitas",
  "pendapatan lain":    "Pemasukan Lain",
};

async function deduplicateScopedCategories(scopeLabel: string, scopeCondition: ReturnType<typeof isNull> | ReturnType<typeof eq>) {
  const rows = await db
    .select({ id: categories.id, name: categories.name, type: categories.type, userId: categories.userId })
    .from(categories)
    .where(scopeCondition);

  let renamedCount = 0;
  let deletedCount = 0;
  const reassignedTxCount = 0;

  // Step A: Rename legacy variants to canonical (in-place)
  for (const row of rows) {
    const canonical = CANONICAL_MAP[row.name.toLowerCase()];
    if (canonical && canonical !== row.name) {
      // Does the canonical already exist in this scope?
      const canonicalRow = rows.find(
        (r) => r.id !== row.id && r.name.toLowerCase() === canonical.toLowerCase() && r.type === row.type
      );

      if (canonicalRow) {
        // Canonical exists → reassign transactions referencing this row to canonical, then delete
        const txResult = await db
          .update(transactions)
          .set({ categoryId: canonicalRow.id })
          .where(eq(transactions.categoryId, row.id));

        // Count reassigned: drizzle returns rows array for update.returning(); use length
        // Since we didn't use .returning() here, estimate from the operation
        await db.delete(categories).where(eq(categories.id, row.id));

        console.log(`  [${scopeLabel}] Reassigned txns from "${row.name}" → "${canonical}" and deleted duplicate.`);
        deletedCount++;
      } else {
        // Rename in-place (preserves FK)
        await db.update(categories).set({ name: canonical }).where(eq(categories.id, row.id));
        console.log(`  [${scopeLabel}] Renamed: "${row.name}" → "${canonical}" (${row.type})`);
        renamedCount++;
      }
    }
  }

  // Step B: Deduplicate identical name+type pairs within this scope
  // Reload after renames
  const afterRename = await db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(scopeCondition);

  const seenKeys = new Map<string, string>(); // key → id (winner)

  for (const row of afterRename) {
    const key = `${row.type}:${row.name.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.set(key, row.id);
    } else {
      // Duplicate — reassign and delete
      const winnerId = seenKeys.get(key)!;
      await db
        .update(transactions)
        .set({ categoryId: winnerId })
        .where(eq(transactions.categoryId, row.id));

      await db.delete(categories).where(eq(categories.id, row.id));
      console.log(`  [${scopeLabel}] Deduped "${row.name}" (${row.type}) — merged into ${winnerId}`);
      deletedCount++;
    }
  }

  return { renamedCount, deletedCount, reassignedTxCount };
}

async function main() {
  console.log("=== Category Deduplication & Canonicalization Migration ===\n");

  // 1. Fix global (system) categories
  console.log("--- Global (system) categories ---");
  await deduplicateScopedCategories("global", isNull(categories.userId));

  // 2. Fix per-user categories
  console.log("\n--- Per-user categories ---");
  const userIds = await db
    .selectDistinct({ userId: categories.userId })
    .from(categories)
    .where(isNotNull(categories.userId));

  for (const { userId } of userIds) {
    if (!userId) continue;
    await deduplicateScopedCategories(`user:${userId.slice(0, 8)}`, eq(categories.userId, userId));
  }

  // 3. Ensure all canonical global categories exist
  console.log("\n--- Seeding missing canonical categories ---");
  await seedDefaultCategories();

  console.log("\n=== Migration complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
