import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { categories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const DEFAULT_CATEGORIES = [
  // ── INCOME (7) ──────────────────────────────────────────────────────────────
  { name: "Gaji",           type: "INCOME",  icon: "briefcase",   color: "#10B981" },
  { name: "Bonus",          type: "INCOME",  icon: "gift",        color: "#059669" },
  { name: "Freelance",      type: "INCOME",  icon: "laptop",      color: "#0D9488" },
  { name: "Bisnis",         type: "INCOME",  icon: "trending-up", color: "#0284C7" },
  { name: "Investasi",      type: "INCOME",  icon: "bar-chart-2", color: "#7C3AED" },
  { name: "Hadiah",         type: "INCOME",  icon: "heart",       color: "#6366F1" },
  { name: "Pemasukan Lain", type: "INCOME",  icon: "plus-circle", color: "#6B7280" },

  // ── EXPENSE (10) ─────────────────────────────────────────────────────────────
  { name: "Makanan & Minuman",  type: "EXPENSE", icon: "coffee",       color: "#EF4444" },
  { name: "Transportasi",       type: "EXPENSE", icon: "truck",        color: "#F97316" },
  { name: "Tempat Tinggal",     type: "EXPENSE", icon: "home",         color: "#F59E0B" },
  { name: "Tagihan & Utilitas", type: "EXPENSE", icon: "zap",          color: "#EAB308" },
  { name: "Belanja",            type: "EXPENSE", icon: "shopping-bag", color: "#EC4899" },
  { name: "Kesehatan",          type: "EXPENSE", icon: "activity",     color: "#14B8A6" },
  { name: "Pendidikan",         type: "EXPENSE", icon: "book",         color: "#8B5CF6" },
  { name: "Hiburan",            type: "EXPENSE", icon: "film",         color: "#A855F7" },
  { name: "Lainnya",            type: "EXPENSE", icon: "box",          color: "#94A3B8" },
  { name: "Pengeluaran Lain",   type: "EXPENSE", icon: "minus-circle", color: "#9CA3AF" },
] as const;

/**
 * Maps legacy / variant names (lowercase) → canonical name.
 * Used during seed to rename stale global categories in-place.
 */
const CANONICAL_NAME_MAP: Record<string, string> = {
  // Tagihan variants → canonical
  "tagihan":            "Tagihan & Utilitas",
  "utilitas & tagihan": "Tagihan & Utilitas",

  // Income variants → canonical
  "pendapatan lain": "Pemasukan Lain",
};

export async function seedDefaultCategories() {
  console.log("Seeding default categories...");

  // 1. Fix any existing global categories with legacy / variant names
  const existingGlobal = await db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(isNull(categories.userId));

  for (const row of existingGlobal) {
    const canonical = CANONICAL_NAME_MAP[row.name.toLowerCase()];
    if (canonical && canonical !== row.name) {
      // Check if the canonical target already exists (different row)
      const canonicalAlreadyExists = existingGlobal.some(
        (r) =>
          r.id !== row.id &&
          r.name.toLowerCase() === canonical.toLowerCase() &&
          r.type === row.type
      );
      if (canonicalAlreadyExists) {
        // Canonical exists → delete this duplicate variant
        await db.delete(categories).where(eq(categories.id, row.id));
        console.log(`  Deleted duplicate global category: "${row.name}" (${row.type})`);
      } else {
        // Canonical does not exist yet → rename in-place (preserves FK references)
        await db
          .update(categories)
          .set({ name: canonical })
          .where(eq(categories.id, row.id));
        console.log(`  Renamed global category: "${row.name}" → "${canonical}" (${row.type})`);
      }
    }
  }

  // 2. Re-fetch after cleanup to know what actually exists now
  const afterCleanup = await db
    .select({ name: categories.name, type: categories.type })
    .from(categories)
    .where(isNull(categories.userId));

  // 3. Insert any missing canonical categories (idempotent — case-insensitive check)
  for (const cat of DEFAULT_CATEGORIES) {
    const alreadyExists = afterCleanup.some(
      (r) => r.name.toLowerCase() === cat.name.toLowerCase() && r.type === cat.type
    );

    if (!alreadyExists) {
      await db.insert(categories).values({
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        userId: null,
      });
      console.log(`  Inserted: "${cat.name}" (${cat.type})`);
    }
  }

  console.log("Default categories seeded successfully!");
}

// If executed directly
if (require.main === module || process.argv[1]?.includes("seed.ts")) {
  seedDefaultCategories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding error:", err);
      process.exit(1);
    });
}
