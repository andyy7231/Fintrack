import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { categories } from "@/db/schema";
import { isNull, eq } from "drizzle-orm";

const CANONICAL_COLORS: Record<string, string> = {
  // Expenses
  "makanan & minuman": "#EF4444",
  "transportasi": "#F97316",
  "tempat tinggal": "#F59E0B",
  "tagihan & utilitas": "#EAB308",
  "tagihan": "#EAB308",
  "belanja": "#EC4899",
  "kesehatan": "#14B8A6",
  "pendidikan": "#8B5CF6",
  "hiburan": "#A855F7",
  "lainnya": "#64748B",
  "pengeluaran lain": "#9CA3AF",
  "kos": "#F59E0B",

  // Incomes
  "gaji": "#10B981",
  "bonus": "#059669",
  "freelance": "#0D9488",
  "bisnis": "#0284C7",
  "investasi": "#7C3AED",
  "hadiah": "#6366F1",
  "pemasukan lain": "#6B7280",
};

const EXTRA_PALETTE = [
  "#06B6D4", "#F43F5E", "#84CC16", "#6366F1", "#D946EF",
  "#3B82F6", "#F97316", "#14B8A6", "#EC4899", "#8B5CF6"
];

async function main() {
  console.log("Checking categories for missing or null colors...");
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
      userId: categories.userId,
    })
    .from(categories);

  let updatedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.color || row.color.trim() === "") {
      const normalized = row.name.toLowerCase().trim();
      const color = CANONICAL_COLORS[normalized] || EXTRA_PALETTE[i % EXTRA_PALETTE.length];

      await db
        .update(categories)
        .set({ color })
        .where(eq(categories.id, row.id));

      console.log(`Updated [${row.type}] "${row.name}" (${row.id}) -> ${color}`);
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} categories with distinct colors.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
