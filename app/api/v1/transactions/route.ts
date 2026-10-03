import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { TransactionService, TransactionFilters } from "@/services/transaction.service";
import { createTransactionSchema } from "@/schemas/transaction.schema";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const type = typeParam === "INCOME" || typeParam === "EXPENSE" ? typeParam : undefined;

  // Parse and validate date parameters
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  if (startDateParam) {
    const parsedStart = new Date(startDateParam);
    if (isNaN(parsedStart.getTime())) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        "Format tanggal startDate tidak valid",
        400
      );
    }
    startDate = parsedStart;
  }

  if (endDateParam) {
    const parsedEnd = new Date(endDateParam);
    if (isNaN(parsedEnd.getTime())) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        "Format tanggal endDate tidak valid",
        400
      );
    }
    endDate = parsedEnd;
  }

  // Validate date range logic
  if (startDate && endDate && startDate > endDate) {
    return apiError(
      ErrorCodes.VALIDATION_ERROR,
      "startDate tidak boleh lebih besar dari endDate",
      400
    );
  }

  const filters: TransactionFilters = {
    type,
    accountId: searchParams.get("accountId") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    search: searchParams.get("search") || undefined,
    startDate,
    endDate,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
  };

  try {
    const result = await TransactionService.getTransactionsWithSummary(user.id, filters);
    return apiSuccess(result);
  } catch (error) {
    console.error("[API] Transaction fetch error:", error);
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      "Gagal memuat transaksi",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.issues[0]?.message || "Input transaksi tidak valid",
        400
      );
    }

    const created = await TransactionService.createTransaction(user.id, validation.data);
    return apiSuccess(created, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat transaksi";
    return apiError(ErrorCodes.INVALID_INPUT, message, 400);
  }
}
