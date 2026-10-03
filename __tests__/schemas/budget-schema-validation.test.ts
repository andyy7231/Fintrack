import { createBudgetSchema } from "@/schemas/budget.schema";

describe("Budget Schema Validation & Regression Tests", () => {
  const validAccountId = "acc_cash_123";
  const validCategoryId = "cat_food_456";

  describe("Regression: Undefined accountId validation error", () => {
    it("fails with 'Invalid input: expected string, received undefined' on CUSTOM when accountId is missing/undefined", () => {
      const payloadWithoutAccountId = {
        periodType: "CUSTOM",
        categoryId: validCategoryId,
        amount: 600000,
        startDate: "2026-09-29",
        endDate: "2026-10-31",
      };

      const result = createBudgetSchema.safeParse(payloadWithoutAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["accountId"]);
        expect(issue.message).toBe("Invalid input: expected string, received undefined");
      }
    });

    it("fails with 'Invalid input: expected string, received undefined' on MONTHLY when accountId is missing/undefined", () => {
      const payloadWithoutAccountId = {
        periodType: "MONTHLY",
        categoryId: validCategoryId,
        amount: 500000,
        year: 2026,
        month: 10,
      };

      const result = createBudgetSchema.safeParse(payloadWithoutAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["accountId"]);
        expect(issue.message).toBe("Invalid input: expected string, received undefined");
      }
    });

    it("fails with 'Invalid input: expected string, received undefined' on ROLLING_7_DAYS when accountId is missing/undefined", () => {
      const payloadWithoutAccountId = {
        periodType: "ROLLING_7_DAYS",
        categoryId: validCategoryId,
        amount: 200000,
        startDate: "2026-09-29",
      };

      const result = createBudgetSchema.safeParse(payloadWithoutAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["accountId"]);
        expect(issue.message).toBe("Invalid input: expected string, received undefined");
      }
    });

    it("fails with 'accountId diperlukan' when accountId is empty string", () => {
      const payloadWithEmptyAccountId = {
        periodType: "CUSTOM",
        accountId: "",
        categoryId: validCategoryId,
        amount: 600000,
        startDate: "2026-09-29",
        endDate: "2026-10-31",
      };

      const result = createBudgetSchema.safeParse(payloadWithEmptyAccountId);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue.path).toEqual(["accountId"]);
        expect(issue.message).toBe("accountId diperlukan");
      }
    });
  });

  describe("Contract: All Period Types with valid accountId", () => {
    it("successfully validates MONTHLY budget creation", () => {
      const payload = {
        periodType: "MONTHLY" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 750000,
        year: 2026,
        month: 10,
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.periodType).toBe("MONTHLY");
        expect(result.data.accountId).toBe(validAccountId);
        expect(result.data.amount).toBe("750000");
        expect(result.data.currency).toBe("IDR"); // default
      }
    });

    it("successfully validates ROLLING_7_DAYS budget creation", () => {
      const payload = {
        periodType: "ROLLING_7_DAYS" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 300000,
        startDate: "2026-09-29",
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.periodType).toBe("ROLLING_7_DAYS");
        expect(result.data.accountId).toBe(validAccountId);
        expect(result.data.amount).toBe("300000");
      }
    });

    it("successfully validates ROLLING_30_DAYS budget creation (startDate optional)", () => {
      const payload = {
        periodType: "ROLLING_30_DAYS" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 1500000,
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.periodType).toBe("ROLLING_30_DAYS");
        expect(result.data.startDate).toBeUndefined();
      }
    });

    it("successfully validates ROLLING_90_DAYS budget creation", () => {
      const payload = {
        periodType: "ROLLING_90_DAYS" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 4500000,
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("successfully validates CUSTOM budget creation", () => {
      const payload = {
        periodType: "CUSTOM" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 600000,
        startDate: "2026-09-29",
        endDate: "2026-10-31",
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.periodType).toBe("CUSTOM");
        expect(result.data.accountId).toBe(validAccountId);
        expect(result.data.startDate).toBe("2026-09-29");
        expect(result.data.endDate).toBe("2026-10-31");
      }
    });

    it("rejects CUSTOM budget if startDate > endDate", () => {
      const payload = {
        periodType: "CUSTOM" as const,
        accountId: validAccountId,
        categoryId: validCategoryId,
        amount: 600000,
        startDate: "2026-10-31",
        endDate: "2026-09-29",
      };

      const result = createBudgetSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("startDate harus sebelum atau sama dengan endDate");
      }
    });
  });

  describe("Frontend Payload Contract & Account Selection", () => {
    const mockAccounts = [
      { id: "acc_bank_1", name: "Bank BCA", type: "BANK", currency: "IDR", currentBalance: 3500000 },
      { id: "acc_cash_2", name: "Dompet Kas", type: "CASH", currency: "IDR", currentBalance: 500000 },
    ];

    function buildFrontendPayload(params: {
      periodType: "MONTHLY" | "ROLLING_7_DAYS" | "ROLLING_30_DAYS" | "ROLLING_90_DAYS" | "CUSTOM";
      accountId: string;
      categoryId: string;
      amount: string;
      year?: number;
      month?: number;
      startDate?: string;
      customEndDate?: string;
    }) {
      if (!params.accountId) {
        throw new Error("Pilih akun sumber dana terlebih dahulu");
      }

      if (params.periodType === "MONTHLY") {
        return {
          periodType: params.periodType,
          accountId: params.accountId,
          categoryId: params.categoryId,
          amount: parseFloat(params.amount),
          year: params.year!,
          month: params.month!,
        };
      } else if (params.periodType === "CUSTOM") {
        if (!params.startDate || !params.customEndDate) {
          throw new Error("Tanggal mulai dan tanggal akhir harus diisi untuk budget custom");
        }
        return {
          periodType: params.periodType,
          accountId: params.accountId,
          categoryId: params.categoryId,
          amount: parseFloat(params.amount),
          startDate: params.startDate,
          endDate: params.customEndDate,
        };
      } else {
        return {
          periodType: params.periodType,
          accountId: params.accountId,
          categoryId: params.categoryId,
          amount: parseFloat(params.amount),
          ...(params.startDate && { startDate: params.startDate }),
        };
      }
    }

    it("MONTHLY payload includes chosen accountId and passes schema", () => {
      const payload = buildFrontendPayload({
        periodType: "MONTHLY",
        accountId: mockAccounts[0].id,
        categoryId: validCategoryId,
        amount: "500000",
        year: 2026,
        month: 10,
      });

      expect(payload.accountId).toBe("acc_bank_1");
      const validation = createBudgetSchema.safeParse(payload);
      expect(validation.success).toBe(true);
    });

    it("ROLLING_7_DAYS payload includes chosen accountId and passes schema", () => {
      const payload = buildFrontendPayload({
        periodType: "ROLLING_7_DAYS",
        accountId: mockAccounts[1].id,
        categoryId: validCategoryId,
        amount: "250000",
        startDate: "2026-10-03",
      });

      expect(payload.accountId).toBe("acc_cash_2");
      const validation = createBudgetSchema.safeParse(payload);
      expect(validation.success).toBe(true);
    });

    it("ROLLING_30_DAYS payload includes chosen accountId and passes schema", () => {
      const payload = buildFrontendPayload({
        periodType: "ROLLING_30_DAYS",
        accountId: mockAccounts[0].id,
        categoryId: validCategoryId,
        amount: "1500000",
      });

      expect(payload.accountId).toBe("acc_bank_1");
      const validation = createBudgetSchema.safeParse(payload);
      expect(validation.success).toBe(true);
    });

    it("ROLLING_90_DAYS payload includes chosen accountId and passes schema", () => {
      const payload = buildFrontendPayload({
        periodType: "ROLLING_90_DAYS",
        accountId: mockAccounts[0].id,
        categoryId: validCategoryId,
        amount: "4500000",
      });

      expect(payload.accountId).toBe("acc_bank_1");
      const validation = createBudgetSchema.safeParse(payload);
      expect(validation.success).toBe(true);
    });

    it("CUSTOM payload includes chosen accountId and passes schema", () => {
      const payload = buildFrontendPayload({
        periodType: "CUSTOM",
        accountId: mockAccounts[0].id,
        categoryId: validCategoryId,
        amount: "600000",
        startDate: "2026-09-29",
        customEndDate: "2026-10-31",
      });

      expect(payload.accountId).toBe("acc_bank_1");
      expect(payload.endDate).toBe("2026-10-31");
      const validation = createBudgetSchema.safeParse(payload);
      expect(validation.success).toBe(true);
    });

    it("throws error when accountId is missing, preventing empty submission", () => {
      expect(() =>
        buildFrontendPayload({
          periodType: "CUSTOM",
          accountId: "",
          categoryId: validCategoryId,
          amount: "600000",
          startDate: "2026-09-29",
          customEndDate: "2026-10-31",
        })
      ).toThrow("Pilih akun sumber dana terlebih dahulu");
    });
  });

  describe("Date Serialization & Runtime Safety Regression", () => {
    function toSafeDate(date: Date | string): Date {
      return date instanceof Date ? date : new Date(date);
    }

    it("serialized ISO string dates from API do not crash on .getTime() after toSafeDate", () => {
      const serializedBudget = {
        startDate: "2026-10-03T00:00:00.000Z",
        endDate: "2026-11-02T00:00:00.000Z",
      };

      // Direct call on string would fail: serializedBudget.endDate.getTime() -> TypeError
      expect(() => (serializedBudget.endDate as unknown as Date).getTime()).toThrow(TypeError);

      // Safe normalization ensures .getTime() works properly
      const safeEndDate = toSafeDate(serializedBudget.endDate);
      expect(typeof safeEndDate.getTime()).toBe("number");
      expect(safeEndDate.getTime()).toBeGreaterThan(0);

      // Exclusive upper bound display calculation: endDate - 1 day
      const displayEnd = new Date(safeEndDate.getTime() - 24 * 60 * 60 * 1000);
      expect(displayEnd.toISOString().startsWith("2026-11-01")).toBe(true);
    });

    it("preserves [startDate, endDate) exclusive semantics: 30-day budget from 2026-10-03 to 2026-11-02 displays up to 1 Nov", () => {
      const start = new Date("2026-10-03T00:00:00+07:00");
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(end.toISOString()).toBe(new Date("2026-11-02T00:00:00+07:00").toISOString());

      // Last day included in the period is end - 1 day
      const lastIncludedDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      expect(lastIncludedDay.getDate()).toBe(1); // 1 Nov
      expect(lastIncludedDay.getMonth()).toBe(10); // Nov (0-indexed 10)
    });
  });
});

