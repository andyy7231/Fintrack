import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountService } from "@/services/account.service";
import { createAccountSchema } from "@/schemas/account.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const userAccounts = await AccountService.getAccountsWithBalances(user.id);
  return apiSuccess(userAccounts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input tidak valid",
        400
      );
    }

    const created = await AccountService.createAccount(user.id, validation.data);
    return apiSuccess(created, 201);
  } catch {
    return apiError(ErrorCodes.INTERNAL_ERROR, "Gagal membuat akun keuangan", 500);
  }
}
