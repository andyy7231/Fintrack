import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { accounts, categories } from "@/db/schema/finance";
import { UserMappingService } from "@/services/whatsapp/user-mapping.service";
import { normalizePhoneNumber } from "@/services/whatsapp/phone.utils";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";
import { eq } from "drizzle-orm";
import { z } from "zod";

const setupAccountSchema = z.object({
  phoneNumber: z.string().trim().min(8),
});

const DEFAULT_CATEGORIES = [
  { name: "Makanan & Minuman", type: "EXPENSE" as const, icon: "🍔" },
  { name: "Transportasi", type: "EXPENSE" as const, icon: "🚗" },
  { name: "Belanja", type: "EXPENSE" as const, icon: "🛒" },
  { name: "Hiburan", type: "EXPENSE" as const, icon: "🎬" },
  { name: "Tagihan & Utilitas", type: "EXPENSE" as const, icon: "💡" },
  { name: "Kesehatan", type: "EXPENSE" as const, icon: "🏥" },
  { name: "Pendidikan", type: "EXPENSE" as const, icon: "📚" },
  { name: "Lainnya", type: "EXPENSE" as const, icon: "📦" },
  { name: "Gaji", type: "INCOME" as const, icon: "💰" },
  { name: "Freelance", type: "INCOME" as const, icon: "💻" },
  { name: "Investasi", type: "INCOME" as const, icon: "📈" },
  { name: "Hadiah", type: "INCOME" as const, icon: "🎁" },
  { name: "Pendapatan Lain", type: "INCOME" as const, icon: "💵" },
];

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

    // 3. Initialize default categories if user has no categories yet
    const existingCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, user.id))
      .limit(1);

    if (existingCategories.length === 0) {
      await db.insert(categories).values(
        DEFAULT_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          isDefault: true,
        }))
      );
    }

    return apiSuccess({
      success: true,
      message: "Akun berhasil diinisialisasi dengan nomor WhatsApp terverifikasi",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal inisialisasi akun";
    return apiError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }
}


