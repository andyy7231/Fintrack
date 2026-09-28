import { NextResponse } from "next/server";

/**
 * Standardized API response format.
 *
 * Success:
 * { success: true, data: T }
 *
 * Error:
 * { success: false, error: { code: string, message: string } }
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Return a JSON success response.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data } as const, { status });
}

/**
 * Return a JSON error response.
 * Never expose internal details (stack traces, DB errors) in production.
 */
export function apiError(
  code: string,
  message: string,
  status = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error: { code, message } } as const,
    { status }
  );
}

/**
 * Common error codes used throughout the API.
 */
export const ErrorCodes = {
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;
