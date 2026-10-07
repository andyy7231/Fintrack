import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { getCurrentUser } from "@/lib/auth/session";
import { TransactionService } from "@/services/transaction.service";

// Mock dependencies
vi.mock("@/lib/auth/session");
vi.mock("@/services/transaction.service");

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetTransactionsWithSummary = vi.mocked(TransactionService.getTransactionsWithSummary);

describe("GET /api/v1/transactions", () => {
  const mockUser = { id: "user-123", name: "Test User", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/v1/transactions");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("should accept valid date parameters", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetTransactionsWithSummary.mockResolvedValue({
      transactions: [],
      summary: { income: 0, expense: 0, net: 0 },
    });

    const startDate = "2024-01-01T00:00:00.000Z";
    const endDate = "2024-01-31T23:59:59.999Z";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`
    );

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetTransactionsWithSummary).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
    );
  });

  it("should return 400 when startDate format is invalid", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const req = new NextRequest(
      "http://localhost:3000/api/v1/transactions?startDate=invalid-date"
    );
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("startDate");
  });

  it("should return 400 when endDate format is invalid", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const req = new NextRequest(
      "http://localhost:3000/api/v1/transactions?endDate=not-a-date"
    );
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("endDate");
  });

  it("should return 400 when startDate is greater than endDate", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const startDate = "2024-12-31T00:00:00.000Z";
    const endDate = "2024-01-01T23:59:59.999Z";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`
    );

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("startDate tidak boleh lebih besar dari endDate");
  });

  it("should work without date parameters (backward compatibility)", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetTransactionsWithSummary.mockResolvedValue({
      transactions: [],
      summary: { income: 0, expense: 0, net: 0 },
    });

    const req = new NextRequest("http://localhost:3000/api/v1/transactions");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetTransactionsWithSummary).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        startDate: undefined,
        endDate: undefined,
      })
    );
  });

  it("should return transactions and summary in response", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    
    const mockResult = {
      transactions: [
        {
          id: "tx-1",
          userId: "user-123",
          accountId: "acc-1",
          accountName: "BCA",
          categoryId: "cat-1",
          categoryName: "Food",
          categoryColor: "#22c55e",
          categoryIcon: "🍔",
          type: "EXPENSE" as const,
          amount: "25000",
          description: "Makan siang",
          transactionDate: new Date("2024-01-15T05:00:00.000Z"),
          source: "WEB" as const,
          status: "CONFIRMED" as const,
          createdAt: new Date("2024-01-15T05:00:00.000Z"),
        },
      ],
      summary: {
        income: 1000000,
        expense: 500000,
        net: 500000,
      },
    };

    mockGetTransactionsWithSummary.mockResolvedValue(mockResult);

    const req = new NextRequest("http://localhost:3000/api/v1/transactions");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      transactions: expect.any(Array),
      summary: {
        income: 1000000,
        expense: 500000,
        net: 500000,
      },
    });
  });

  it("should pass all filter parameters to service", async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetTransactionsWithSummary.mockResolvedValue({
      transactions: [],
      summary: { income: 0, expense: 0, net: 0 },
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/transactions?type=EXPENSE&accountId=acc-1&categoryId=cat-1&search=makan&startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.999Z&limit=20&offset=10"
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockGetTransactionsWithSummary).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        type: "EXPENSE",
        accountId: "acc-1",
        categoryId: "cat-1",
        search: "makan",
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        endDate: new Date("2024-01-31T23:59:59.999Z"),
        limit: 20,
        offset: 10,
      })
    );
  });
});
