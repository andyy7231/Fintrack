import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "@/lib/db";
import { categories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const DEFAULT_CATEGORIES = [
  // Income
  { name: "Gaji", type: "INCOME", icon: "briefcase", color: "#10B981" },
  { name: "Bonus", type: "INCOME", icon: "gift", color: "#059669" },
  { name: "Freelance", type: "INCOME", icon: "laptop", color: "#0D9488" },
  { name: "Bisnis", type: "INCOME", icon: "trending-up", color: "#0284C7" },
  { name: "Hadiah", type: "INCOME", icon: "heart", color: "#6366F1" },
  { name: "Pemasukan Lain", type: "INCOME", icon: "plus-circle", color: "#6B7280" },

  // Expense
  { name: "Makanan & Minuman", type: "EXPENSE", icon: "coffee", color: "#EF4444" },
  { name: "Transportasi", type: "EXPENSE", icon: "truck", color: "#F97316" },
  { name: "Tempat Tinggal", type: "EXPENSE", icon: "home", color: "#F59E0B" },
  { name: "Utilitas & Tagihan", type: "EXPENSE", icon: "zap", color: "#EAB308" },
  { name: "Belanja", type: "EXPENSE", icon: "shopping-bag", color: "#EC4899" },
  { name: "Kesehatan", type: "EXPENSE", icon: "activity", color: "#14B8A6" },
  { name: "Pendidikan", type: "EXPENSE", icon: "book", color: "#8B5CF6" },
  { name: "Hiburan", type: "EXPENSE", icon: "film", color: "#A855F7" },
  { name: "Tagihan", type: "EXPENSE", icon: "file-text", color: "#DC2626" },
  { name: "Pengeluaran Lain", type: "EXPENSE", icon: "minus-circle", color: "#9CA3AF" },
] as const;

export async function seedDefaultCategories() {
  console.log("Seeding default categories...");

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.userId),
          eq(categories.name, cat.name),
          eq(categories.type, cat.type)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(categories).values({
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
        userId: null,
      });
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
