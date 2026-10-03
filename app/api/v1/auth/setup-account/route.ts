import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { accounts, categories } from "@/db/schema/finance";
import { UserMappingService } from "@/services/whatsapp/user-mapping.service";
import { normalizePhoneNumber } from "@/services/whatsapp/phone.utils";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";
import { eq, and, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_CATEGORIES } from "@/db/seed";

const setupAccountSchema = z.object({
  phoneNumber: z.string().trim().min(8),
});

/**
 * Maps legacy / variant per-user category names (lowercase) → canonical name.
 * Mirrors the same map in db/seed.ts but applied to user-scoped categories.
 */
const CANONICAL_NAME_MAP: Record<string, string> = {
  "tagihan":            "Tagihan & Utilitas",
  "utilitas & tagihan": "Tagihan & Utilitas",
  "pendapatan lain":    "Pemasukan Lain",
};

/**
 * Initialize default categories for a user.
 * - Idempotent: safe to call multiple times.
 * - Merges/renames legacy variant names to canonical.
 * - Uses global (userId=null) canonical categories as source of truth.
 * - Falls back to DEFAULT_CATEGORIES list from seed if no global categories found.
 */
async function initUserCategories(userId: string) {
  // 1. Fetch existing user-scoped categories
  const existing = await db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, userId));

  // 2. Fix any legacy/variant names in existing user categories
  for (const row of existing) {
    const canonical = CANONICAL_NAME_MAP[row.name.toLowerCase()];
    if (canonical && canonical !== row.name) {
      const canonicalAlreadyExists = existing.some(
        (r) =>
          r.id !== row.id &&
          r.name.toLowerCase() === canonical.toLowerCase() &&
          r.type === row.type
      );
      if (canonicalAlreadyExists) {
        // Canonical already exists → delete this duplicate variant
        await db.delete(categories).where(eq(categories.id, row.id));
      } else {
        // Rename in-place
        await db
          .update(categories)
          .set({ name: canonical })
          .where(eq(categories.id, row.id));
      }
    }
  }

  // 3. Re-fetch after cleanup
  const afterCleanup = await db
    .select({ name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, userId));

  // 4. Fetch global system categories as source of truth
  const globalCats = await db
    .select({ name: categories.name, type: categories.type, icon: categories.icon, color: categories.color })
    .from(categories)
    .where(isNull(categories.userId));

  // Use global list if available, else fall back to DEFAULT_CATEGORIES
  const templateCats = globalCats.length > 0 ? globalCats : DEFAULT_CATEGORIES;

  // 5. Insert any missing canonical categories (case-insensitive dedup)
  for (const cat of templateCats) {
    const exists = afterCleanup.some(
      (r) => r.name.toLowerCase() === cat.name.toLowerCase() && r.type === cat.type
    );
    if (!exists) {
      await db.insert(categories).values({
        userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon ?? null,
        color: cat.color ?? null,
        isDefault: true,
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError(ErrorCodes.UNAUTHORIZED, "Sesi tidak ditemukan atau telah berakhir", 401);
    }

    const body = await req.json();
    const parsed = setupAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, "Nomor WhatsApp tidak valid", 400);
    }

    const normalizedPhone = normalizePhoneNumber(parsed.data.phoneNumber);

    // 1. Link WhatsApp phone number automatically as verified (no 2x verification needed)
    await UserMappingService.linkPhoneNumber(user.id, normalizedPhone, true);

    // 2. Initialize default "Kas" account if user has no accounts yet
    const existingAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, user.id))
      .limit(1);

    if (existingAccounts.length === 0) {
      await db.insert(accounts).values({
        userId: user.id,
        name: "Kas",
        type: "CASH",
        initialBalance: "0.00",
        currency: "IDR",
        isActive: true,
      });
    }

    // 3. Initialize / repair default categories for this user (idempotent)
    await initUserCategories(user.id);

    return apiSuccess({
      success: true,
      message: "Akun berhasil diinisialisasi dengan nomor WhatsApp terverifikasi",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal inisialisasi akun";
    return apiError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }
}
