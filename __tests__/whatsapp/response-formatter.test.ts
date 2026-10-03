/**
 * Regression tests: WhatsApp Response Formatter
 *
 * Tests ALL response types from response-formatter.service.ts
 * without touching the database or parser.
 *
 * Coverage:
 *  - Expense responses (all 7 canonical categories + generic)
 *  - Income responses (all 7 canonical categories + generic)
 *  - Transfer success / error variants
 *  - Multi-action batch (expense-only, income-only, mixed)
 *  - Confirmation prompts (single / multi)
 *  - YA success (single / multi)
 *  - BATAL
 *  - Balance query (single account / multi-account)
 *  - Transaction list formatting
 *  - Delete confirmation / success / cancellation
 *  - Missing amount / missing description
 *  - Unknown message
 *  - System error
 *  - Rupiah format
 *  - Encoding / no mojibake
 */

import { describe, test, expect } from "vitest";
import {
  formatExpenseSuccess,
  formatIncomeSuccess,
  formatTransferSuccess,
  formatTransferDestinationNotFound,
  formatTransferSameAccount,
  formatTransferInsufficientBalance,
  formatBatchSuccess,
  formatConfirmation,
  formatConfirmationSuccess,
  formatCancellation,
  formatNoPendingAction,
  formatBalance,
  formatTransactionList,
  formatCategorySummary,
  formatDeleteConfirmation,
  formatDeleteSuccess,
  formatDeleteCancellation,
  formatMissingAmount,
  formatMissingDescription,
  formatUnknownMessage,
  formatSystemError,
  getCategoryIcon,
  formatAmount,
  BalanceAccount,
  TransactionListItem,
} from "@/services/whatsapp/response-formatter.service";

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeExpenseResult(category: string, amount = 25000) {
  return {
    type: "EXPENSE" as const,
    categoryName: category,
    amount,
    description: `Test ${category.toLowerCase()}`,
    accountName: "BCA",
    accountBalance: 1000000,
  };
}

function makeIncomeResult(category: string, amount = 5000000) {
  return {
    type: "INCOME" as const,
    categoryName: category,
    amount,
    description: `Test ${category.toLowerCase()}`,
    accountName: "BCA",
    accountBalance: 6000000,
  };
}

// ─── Category Icon Mapping ────────────────────────────────────────────────────

describe("getCategoryIcon", () => {
  test.each([
    ["Makanan & Minuman", "🍽️"],
    ["Transportasi", "🚗"],
    ["Tagihan & Utilitas", "🧾"],
    ["Belanja", "🛍️"],
    ["Kesehatan", "💊"],
    ["Hiburan", "🎮"],
    ["Pendidikan", "📚"],
    ["Gaji", "💰"],
    ["Bonus", "🎁"],
    ["Freelance", "💼"],
    ["Bisnis", "🏪"],
    ["Investasi", "📈"],
    ["Hadiah", "🎁"],
    ["Pemasukan Lain", "💵"],
  ])('getCategoryIcon("%s") returns correct icon', (cat, expectedIcon) => {
    expect(getCategoryIcon(cat)).toBe(expectedIcon);
  });

  test("null category returns fallback icon", () => {
    expect(getCategoryIcon(null)).toBe("📌");
    expect(getCategoryIcon(undefined)).toBe("📌");
    expect(getCategoryIcon("")).toBe("📌");
  });

  test("unknown category returns fallback icon (not an error)", () => {
    const result = getCategoryIcon("Kategori Aneh Sekali");
    expect(result).toBe("📌");
  });

  test("case-insensitive icon lookup", () => {
    expect(getCategoryIcon("makanan & minuman")).toBe(getCategoryIcon("Makanan & Minuman"));
    expect(getCategoryIcon("GAJI")).toBe(getCategoryIcon("Gaji"));
  });
});

// ─── Amount Formatting ────────────────────────────────────────────────────────

describe("formatAmount", () => {
  test.each([
    [1000, "Rp1.000"],
    [25000, "Rp25.000"],
    [100000, "Rp100.000"],
    [1500000, "Rp1.500.000"],
    [5000000, "Rp5.000.000"],
  ])("formatAmount(%i) = %s", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });

  test("accepts string input", () => {
    expect(formatAmount("25000")).toBe("Rp25.000");
  });

  test('does NOT produce "25000 IDR" format', () => {
    expect(formatAmount(25000)).not.toMatch(/IDR/);
  });

  test("does NOT produce space after Rp", () => {
    expect(formatAmount(25000)).not.toMatch(/Rp\s/);
  });

  test("uses dots as thousands separator", () => {
    expect(formatAmount(1000000)).toMatch(/1\.000\.000/);
  });
});

// ─── Expense Responses — all 7 canonical categories ──────────────────────────

const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Tagihan & Utilitas",
  "Belanja",
  "Kesehatan",
  "Hiburan",
  "Pendidikan",
] as const;

describe("formatExpenseSuccess", () => {
  for (const cat of EXPENSE_CATEGORIES) {
    test(`category: ${cat}`, () => {
      const r = makeExpenseResult(cat);
      const msg = formatExpenseSuccess(r);

      expect(msg).toContain("Pengeluaran berhasil dicatat");
      expect(msg).toContain(cat);
      expect(msg).toContain("Rp25.000");
      expect(msg).toContain("BCA");
      expect(msg).toContain("Saldo BCA");
      expect(msg).toContain("Rp1.000.000");
      // icon from mapping (not hardcoded)
      expect(msg).toContain(getCategoryIcon(cat));
    });
  }

  // 22 food input cases — all should produce "Makanan & Minuman" category response
  const FOOD_DESCRIPTIONS = [
    "makan", "minum", "jajan", "kopi", "nasi", "sayur", "warteg",
    "kuliner", "ayam", "bakso", "soto", "gado-gado", "mie", "noodle",
    "pizza", "burger", "sushi", "ramen", "dimsum", "kebab", "martabak", "gorengan",
  ];
  for (const desc of FOOD_DESCRIPTIONS) {
    test(`Makanan & Minuman description "${desc}" — response contains category`, () => {
      const r = {
        ...makeExpenseResult("Makanan & Minuman"),
        description: desc,
      };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Makanan & Minuman");
      expect(msg).toContain("🍽️");
    });
  }

  // 12 transportation input cases
  const TRANSPORT_DESCRIPTIONS = [
    "bensin", "ojek", "grab", "gojek", "tol", "parkir",
    "taxi", "busway", "kereta", "angkot", "motor", "bbm",
  ];
  for (const desc of TRANSPORT_DESCRIPTIONS) {
    test(`Transportasi description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Transportasi"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Transportasi");
      expect(msg).toContain("🚗");
    });
  }

  // 12 utilities cases
  const UTILITIES_DESCRIPTIONS = [
    "listrik", "pulsa", "wifi", "kuota", "pdam", "bpjs",
    "token pln", "air", "gas", "iuran", "internet", "paket data",
  ];
  for (const desc of UTILITIES_DESCRIPTIONS) {
    test(`Tagihan & Utilitas description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Tagihan & Utilitas"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Tagihan & Utilitas");
      expect(msg).toContain("🧾");
    });
  }

  // 11 belanja cases
  const BELANJA_DESCRIPTIONS = [
    "belanja", "shopee", "baju", "sepatu", "indomaret", "galon",
    "alfamart", "lazada", "tokopedia", "groceries", "supermarket",
  ];
  for (const desc of BELANJA_DESCRIPTIONS) {
    test(`Belanja description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Belanja"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Belanja");
      expect(msg).toContain("🛍️");
    });
  }

  // 6 health cases
  const HEALTH_DESCRIPTIONS = ["obat", "dokter", "apotek", "vitamin", "klinik", "rumah sakit"];
  for (const desc of HEALTH_DESCRIPTIONS) {
    test(`Kesehatan description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Kesehatan"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Kesehatan");
      expect(msg).toContain("💊");
    });
  }

  // 6 entertainment cases
  const HIBURAN_DESCRIPTIONS = ["nonton", "bioskop", "game", "netflix", "spotify", "youtube"];
  for (const desc of HIBURAN_DESCRIPTIONS) {
    test(`Hiburan description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Hiburan"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Hiburan");
      expect(msg).toContain("🎮");
    });
  }

  // 5 education cases
  const PENDIDIKAN_DESCRIPTIONS = ["buku", "kursus", "les", "spp", "fotocopy"];
  for (const desc of PENDIDIKAN_DESCRIPTIONS) {
    test(`Pendidikan description "${desc}" — response contains category`, () => {
      const r = { ...makeExpenseResult("Pendidikan"), description: desc };
      const msg = formatExpenseSuccess(r);
      expect(msg).toContain("Pendidikan");
      expect(msg).toContain("📚");
    });
  }
});

// ─── Income Responses — all 7 canonical categories ───────────────────────────

const INCOME_CATEGORIES: Array<{ cat: string; icon: string }> = [
  { cat: "Gaji", icon: "💰" },
  { cat: "Bonus", icon: "🎁" },
  { cat: "Freelance", icon: "💼" },
  { cat: "Bisnis", icon: "🏪" },
  { cat: "Investasi", icon: "📈" },
  { cat: "Hadiah", icon: "🎁" },
  { cat: "Pemasukan Lain", icon: "💵" },
];

describe("formatIncomeSuccess", () => {
  for (const { cat, icon } of INCOME_CATEGORIES) {
    test(`category: ${cat}`, () => {
      const r = makeIncomeResult(cat);
      const msg = formatIncomeSuccess(r);

      expect(msg).toContain("Pemasukan berhasil dicatat");
      expect(msg).toContain(cat);
      expect(msg).toContain("Rp5.000.000");
      expect(msg).toContain("BCA");
      expect(msg).toContain("Saldo BCA");
      expect(msg).toContain(icon);
    });
  }

  test("null categoryName falls back to Pemasukan Lain", () => {
    const r = makeIncomeResult("Pemasukan Lain");
    r.categoryName = null as unknown as string;
    const msg = formatIncomeSuccess(r);
    expect(msg).toContain("Pemasukan Lain");
  });
});

// ─── Transfer ─────────────────────────────────────────────────────────────────

describe("formatTransferSuccess", () => {
  test("contains all required fields", () => {
    const msg = formatTransferSuccess({
      fromAccountName: "BCA",
      toAccountName: "GoPay",
      amount: 100000,
      fromAccountBalance: 900000,
    });
    expect(msg).toContain("🔄");
    expect(msg).toContain("Transfer berhasil");
    expect(msg).toContain("BCA");
    expect(msg).toContain("GoPay");
    expect(msg).toContain("Rp100.000");
    expect(msg).toContain("Saldo BCA");
    expect(msg).toContain("Rp900.000");
  });
});

describe("formatTransferDestinationNotFound", () => {
  test("includes account hint", () => {
    const msg = formatTransferDestinationNotFound("Mandiri");
    expect(msg).toContain("⚠️");
    expect(msg).toContain("Mandiri");
    expect(msg).toContain("tidak ditemukan");
  });
});

describe("formatTransferSameAccount", () => {
  test("explains same account error", () => {
    const msg = formatTransferSameAccount();
    expect(msg).toContain("⚠️");
    expect(msg).toContain("tidak boleh sama");
  });
});

describe("formatTransferInsufficientBalance", () => {
  test("shows both balance and transfer amount", () => {
    const msg = formatTransferInsufficientBalance("BCA", 50000, 100000);
    expect(msg).toContain("⚠️");
    expect(msg).toContain("BCA");
    expect(msg).toContain("Rp50.000");
    expect(msg).toContain("Rp100.000");
    expect(msg).toContain("tidak mencukupi");
  });
});

// ─── Multi-action Batch ───────────────────────────────────────────────────────

describe("formatBatchSuccess", () => {
  test("multiple expenses — shows total and list", () => {
    const msg = formatBatchSuccess({
      items: [
        { type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 25000, description: "makan" },
        { type: "EXPENSE", categoryName: "Transportasi", amount: 20000, description: "bensin" },
        { type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 15000, description: "kopi" },
      ],
      accountName: "BCA",
      accountBalance: 940000,
    });
    expect(msg).toContain("✅ Semua transaksi berhasil dicatat");
    expect(msg).toContain("Rp25.000");
    expect(msg).toContain("Rp20.000");
    expect(msg).toContain("Rp15.000");
    expect(msg).toContain("Total pengeluaran: Rp60.000");
    expect(msg).toContain("Saldo: Rp940.000");
    expect(msg).not.toContain("Total pemasukan");
  });

  test("mixed income + expense — shows both totals", () => {
    const msg = formatBatchSuccess({
      items: [
        { type: "INCOME", categoryName: "Gaji", amount: 5000000, description: "gaji" },
        { type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 25000, description: "makan" },
        { type: "EXPENSE", categoryName: "Transportasi", amount: 20000, description: "bensin" },
      ],
    });
    expect(msg).toContain("Total pemasukan: Rp5.000.000");
    expect(msg).toContain("Total pengeluaran: Rp45.000");
  });

  test("numbered list 1-indexed", () => {
    const msg = formatBatchSuccess({
      items: [
        { type: "EXPENSE", categoryName: "Belanja", amount: 10000, description: "test" },
        { type: "EXPENSE", categoryName: "Hiburan", amount: 20000, description: "test2" },
      ],
    });
    expect(msg).toMatch(/1\./);
    expect(msg).toMatch(/2\./);
  });
});

// ─── Confirmation Prompts ─────────────────────────────────────────────────────

describe("formatConfirmation", () => {
  // ── Expense ────────────────────────────────────────────────────────────────

  test("expense: header is '📝 Konfirmasi Pengeluaran'", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Konfirmasi Pengeluaran");
    expect(msg).not.toContain("Konfirmasi transaksi");
  });

  test("expense: Nominal field shows Rp amount (no space after Rp)", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Nominal: Rp5.000");
  });

  test("expense: categoryName shown as Kategori (not description)", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Kategori: Makanan & Minuman");
    // description is different from categoryName — both must appear
    expect(msg).toContain("Keterangan: makan");
  });

  test("expense: accountName shown in Akun field", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Transportasi",
      amount: 10000,
      description: "bensin",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Akun: Kas");
  });

  test("expense: footer contains YA and BATAL", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("YA");
    expect(msg).toContain("BATAL");
  });

  test("expense: null categoryName falls back to 'Lainnya'", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: null,
      amount: 5000,
      description: "lain-lain",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Kategori: Lainnya");
  });

  // Required example from spec: makan 5k
  test("REQUIRED EXAMPLE: makan 5k — Makanan & Minuman / makan / Kas / Rp5.000 / YA / BATAL", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Makanan & Minuman");
    expect(msg).toContain("makan");
    expect(msg).toContain("Kas");
    expect(msg).toContain("Rp5.000");
    expect(msg).toContain("YA");
    expect(msg).toContain("BATAL");
  });

  // ── Income ─────────────────────────────────────────────────────────────────

  test("income: header is '📝 Konfirmasi Pemasukan'", () => {
    const msg = formatConfirmation([{
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Konfirmasi Pemasukan");
    expect(msg).not.toContain("Konfirmasi transaksi");
  });

  test("income: Nominal, Kategori, Keterangan, Akun all present", () => {
    const msg = formatConfirmation([{
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Nominal: Rp5.000.000");
    expect(msg).toContain("Kategori: Gaji");
    expect(msg).toContain("Keterangan: gaji");
    expect(msg).toContain("Akun: Kas");
  });

  test("income: null categoryName falls back to 'Pemasukan Lain'", () => {
    const msg = formatConfirmation([{
      type: "INCOME",
      categoryName: null,
      amount: 100000,
      description: "hadiah",
      accountName: "BCA",
    }]);
    expect(msg).toContain("Kategori: Pemasukan Lain");
  });

  // ── Transfer ───────────────────────────────────────────────────────────────

  test("transfer: header is '📝 Konfirmasi Transfer'", () => {
    const msg = formatConfirmation([{
      type: "TRANSFER",
      categoryName: null,
      amount: 100000,
      description: "Transfer BCA ke GoPay",
      fromAccountName: "Kas",
      toAccountName: "BCA",
    }]);
    expect(msg).toContain("Konfirmasi Transfer");
    expect(msg).not.toContain("Konfirmasi transaksi");
  });

  test("transfer: shows Nominal, Dari, Ke", () => {
    const msg = formatConfirmation([{
      type: "TRANSFER",
      categoryName: null,
      amount: 100000,
      description: "Transfer",
      fromAccountName: "Kas",
      toAccountName: "BCA",
    }]);
    expect(msg).toContain("Nominal: Rp100.000");
    expect(msg).toContain("Dari: Kas");
    expect(msg).toContain("Ke: BCA");
  });

  test("transfer: footer contains YA and BATAL", () => {
    const msg = formatConfirmation([{
      type: "TRANSFER",
      categoryName: null,
      amount: 50000,
      description: "Transfer",
      fromAccountName: "BCA",
      toAccountName: "GoPay",
    }]);
    expect(msg).toContain("YA");
    expect(msg).toContain("BATAL");
  });

  // ── Encoding ───────────────────────────────────────────────────────────────

  test("bullet character is U+2022 (•) not HTML entity or mojibake", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 25000,
      description: "makan siang",
      accountName: "BCA",
    }]);
    expect(msg).toContain("\u2022"); // literal •
    expect(msg).not.toContain("&bull;");
    expect(msg).not.toContain("â€¢");
    expect(msg).not.toContain("&#8226;");
  });

  test("no mojibake sequences in any confirmation type", () => {
    const MOJIBAKE = ["â€¢", "âœ…", "Ã", "\u00e2\u0080"];
    const cases = [
      formatConfirmation([{ type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 5000, description: "makan", accountName: "Kas" }]),
      formatConfirmation([{ type: "INCOME", categoryName: "Gaji", amount: 5000000, description: "gaji", accountName: "BCA" }]),
      formatConfirmation([{ type: "TRANSFER", categoryName: null, amount: 100000, description: "tf", fromAccountName: "BCA", toAccountName: "GoPay" }]),
    ];
    for (const msg of cases) {
      for (const mj of MOJIBAKE) {
        expect(msg).not.toContain(mj);
      }
    }
  });

  // ── Rupiah format ──────────────────────────────────────────────────────────

  test("amount: Rp5.000 (no space after Rp, dot thousands)", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    expect(msg).toContain("Rp5.000");
    expect(msg).not.toMatch(/Rp\s\d/);
    expect(msg).not.toContain("IDR");
  });

  test("amount: Rp5.000.000 for large values", () => {
    const msg = formatConfirmation([{
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji",
      accountName: "BCA",
    }]);
    expect(msg).toContain("Rp5.000.000");
  });

  // ── Multi-action (regression) ──────────────────────────────────────────────

  test("multi-action: shows count and total", () => {
    const msg = formatConfirmation([
      { type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 25000, description: "makan" },
      { type: "EXPENSE", categoryName: "Transportasi", amount: 20000, description: "bensin" },
    ]);
    expect(msg).toContain("2 transaksi");
    expect(msg).toContain("Total pengeluaran: Rp45.000");
    expect(msg).toContain("*YA*");
    expect(msg).toContain("*BATAL*");
  });

  test("multi-action: header is 'Konfirmasi transaksi' (not type-specific)", () => {
    const msg = formatConfirmation([
      { type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 25000, description: "makan" },
      { type: "INCOME", categoryName: "Gaji", amount: 5000000, description: "gaji" },
    ]);
    expect(msg).toContain("Konfirmasi transaksi");
  });

  // ── New format regression: old free-form sentence must never appear ─────────

  test("REGRESSION: old free-form sentence format is NOT produced for expense", () => {
    const msg = formatConfirmation([{
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 5000,
      description: "makan",
      accountName: "Kas",
    }]);
    // Old format: "Konfirmasi pengeluaran Rp... untuk \"...\" dari akun ...?"
    expect(msg).not.toMatch(/Konfirmasi pengeluaran Rp.*untuk ".*" dari akun/);
    expect(msg).not.toMatch(/Balas "ya" untuk konfirmasi atau "batal"/);
  });

  test("REGRESSION: old free-form sentence format is NOT produced for income", () => {
    const msg = formatConfirmation([{
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji",
      accountName: "BCA",
    }]);
    // Old format: "Konfirmasi pemasukan Rp... untuk \"...\" ke akun ...?"
    expect(msg).not.toMatch(/Konfirmasi pemasukan Rp.*untuk ".*" ke akun/);
    expect(msg).not.toMatch(/Balas "ya" untuk konfirmasi atau "batal"/);
  });

  test("REGRESSION: old budget free-form sentence is NOT produced", () => {
    const msg = formatConfirmation([{
      type: "BUDGET_ALLOCATION",
      categoryName: "Makanan & Minuman",
      amount: 600000,
      description: "Budget Makanan & Minuman",
    }]);
    // Old format: "Konfirmasi alokasi budget untuk ... sebesar Rp...?"
    expect(msg).not.toMatch(/Konfirmasi alokasi budget untuk.*sebesar/);
    expect(msg).not.toMatch(/Balas "ya" untuk konfirmasi atau "batal"/);
  });

  // ── BUDGET_ALLOCATION structured format ────────────────────────────────────

  test("budget: header is '📝 Konfirmasi Budget'", () => {
    const msg = formatConfirmation([{
      type: "BUDGET_ALLOCATION",
      categoryName: "Transportasi",
      amount: 300000,
      description: "Budget Transportasi",
    }]);
    expect(msg).toContain("Konfirmasi Budget");
    expect(msg).not.toContain("Konfirmasi transaksi");
  });

  test("budget: Nominal and Kategori fields present", () => {
    const msg = formatConfirmation([{
      type: "BUDGET_ALLOCATION",
      categoryName: "Kesehatan",
      amount: 500000,
      description: "Budget Kesehatan",
    }]);
    expect(msg).toContain("Nominal: Rp500.000");
    expect(msg).toContain("Kategori: Kesehatan");
    expect(msg).toContain("YA");
    expect(msg).toContain("BATAL");
  });

  // ── Arbitrary categories, accounts, amounts ────────────────────────────────

  test.each([
    ["Transportasi", 20000, "bensin", "GoPay"],
    ["Belanja", 150000, "supermarket", "OVO"],
    ["Kesehatan", 75000, "obat", "Mandiri"],
    ["Hiburan", 50000, "netflix", "BCA"],
    ["Pendidikan", 200000, "kursus online", "Dana"],
    ["Tagihan & Utilitas", 350000, "listrik", "Jenius"],
  ])(
    "expense structured format: %s / %i / %s / %s",
    (category, amount, description, account) => {
      const msg = formatConfirmation([{
        type: "EXPENSE",
        categoryName: category,
        amount,
        description,
        accountName: account,
      }]);
      expect(msg).toContain("Konfirmasi Pengeluaran");
      expect(msg).toContain(`Nominal: Rp${amount.toLocaleString("id-ID")}`);
      expect(msg).toContain(`Kategori: ${category}`);
      expect(msg).toContain(`Keterangan: ${description}`);
      expect(msg).toContain(`Akun: ${account}`);
      expect(msg).toContain("YA");
      expect(msg).toContain("BATAL");
    }
  );

  test.each([
    ["Gaji", 5000000, "gaji bulan ini", "BCA"],
    ["Freelance", 2500000, "project web", "GoPay"],
    ["Bonus", 1000000, "bonus kinerja", "Mandiri"],
    ["Bisnis", 3000000, "jualan online", "OVO"],
    ["Investasi", 500000, "dividen", "Dana"],
  ])(
    "income structured format: %s / %i / %s / %s",
    (category, amount, description, account) => {
      const msg = formatConfirmation([{
        type: "INCOME",
        categoryName: category,
        amount,
        description,
        accountName: account,
      }]);
      expect(msg).toContain("Konfirmasi Pemasukan");
      expect(msg).toContain(`Kategori: ${category}`);
      expect(msg).toContain(`Keterangan: ${description}`);
      expect(msg).toContain(`Akun: ${account}`);
      expect(msg).toContain("YA");
      expect(msg).toContain("BATAL");
    }
  );

  test.each([
    [100000, "BCA", "GoPay"],
    [500000, "OVO", "Mandiri"],
    [50000, "Dana", "BCA"],
  ])(
    "transfer structured format: Rp%i / dari %s ke %s",
    (amount, from, to) => {
      const msg = formatConfirmation([{
        type: "TRANSFER",
        categoryName: null,
        amount,
        description: `Transfer ${from} ke ${to}`,
        fromAccountName: from,
        toAccountName: to,
      }]);
      expect(msg).toContain("Konfirmasi Transfer");
      expect(msg).toContain(`Dari: ${from}`);
      expect(msg).toContain(`Ke: ${to}`);
      expect(msg).toContain("YA");
      expect(msg).toContain("BATAL");
    }
  );
});

// ─── YA Success ──────────────────────────────────────────────────────────────

describe("formatConfirmationSuccess", () => {
  test("single expense success", () => {
    const msg = formatConfirmationSuccess({
      count: 1,
      totalExpense: 25000,
      totalIncome: 0,
      accountName: "BCA",
      accountBalance: 975000,
    });
    expect(msg).toContain("✅");
    expect(msg).toContain("1 transaksi");
    expect(msg).toContain("Rp25.000");
  });

  test("multi-action success shows count", () => {
    const msg = formatConfirmationSuccess({
      count: 3,
      totalExpense: 60000,
      totalIncome: 0,
    });
    expect(msg).toContain("3 transaksi");
    expect(msg).toContain("Rp60.000");
  });

  test("mixed income and expense — both totals shown", () => {
    const msg = formatConfirmationSuccess({
      count: 2,
      totalExpense: 45000,
      totalIncome: 5000000,
    });
    expect(msg).toContain("Rp45.000");
    expect(msg).toContain("Rp5.000.000");
  });
});

// ─── BATAL ────────────────────────────────────────────────────────────────────

describe("formatCancellation", () => {
  test("shows cancellation message", () => {
    const msg = formatCancellation();
    expect(msg).toContain("❌ Transaksi dibatalkan");
    expect(msg).toContain("Tidak ada transaksi yang disimpan");
  });

  test("does NOT say sebagian berhasil (atomicity)", () => {
    const msg = formatCancellation();
    expect(msg).not.toContain("berhasil");
  });
});

describe("formatNoPendingAction", () => {
  test("guides user to send a new message", () => {
    const msg = formatNoPendingAction();
    expect(msg).toContain("makan 25k");
  });
});

// ─── Balance Query ────────────────────────────────────────────────────────────

describe("formatBalance", () => {
  test("single account shows balance and account name", () => {
    const accs: BalanceAccount[] = [{ name: "BCA", balance: 1500000 }];
    const msg = formatBalance(accs);
    expect(msg).toContain("💰");
    expect(msg).toContain("Rp1.500.000");
    expect(msg).toContain("BCA");
  });

  test("multiple accounts shows each + total", () => {
    const accs: BalanceAccount[] = [
      { name: "BCA", balance: 1000000 },
      { name: "GoPay", balance: 500000 },
      { name: "OVO", balance: 250000 },
    ];
    const msg = formatBalance(accs);
    expect(msg).toContain("BCA: Rp1.000.000");
    expect(msg).toContain("GoPay: Rp500.000");
    expect(msg).toContain("OVO: Rp250.000");
    expect(msg).toContain("Total saldo: Rp1.750.000");
  });

  test("empty accounts shows informative message", () => {
    const msg = formatBalance([]);
    expect(msg).not.toMatch(/undefined|null|NaN/);
  });
});

// ─── Transaction List ─────────────────────────────────────────────────────────

describe("formatTransactionList", () => {
  const sample: TransactionListItem[] = [
    {
      type: "EXPENSE",
      categoryName: "Makanan & Minuman",
      amount: 25000,
      description: "makan siang",
      transactionDate: new Date("2026-10-01"),
    },
    {
      type: "INCOME",
      categoryName: "Gaji",
      amount: 5000000,
      description: "gaji bulan ini",
      transactionDate: new Date("2026-10-02"),
    },
  ];

  test("contains transaction descriptions and amounts", () => {
    const msg = formatTransactionList(sample, "Bulan Ini");
    expect(msg).toContain("makan siang");
    expect(msg).toContain("Rp25.000");
    expect(msg).toContain("gaji bulan ini");
    expect(msg).toContain("Rp5.000.000");
  });

  test("empty list returns informative message", () => {
    const msg = formatTransactionList([], "Hari Ini");
    expect(msg).toContain("Tidak ada transaksi");
    expect(msg).not.toMatch(/undefined|null/);
  });

  test("income shows + prefix, expense shows - prefix", () => {
    const msg = formatTransactionList(sample, "Test");
    expect(msg).toContain("+Rp5.000.000");
    expect(msg).toContain("-Rp25.000");
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe("formatDeleteConfirmation", () => {
  test("shows transaction details and confirmation prompt", () => {
    const msg = formatDeleteConfirmation({
      description: "makan siang",
      categoryName: "Makanan & Minuman",
      amount: 25000,
      transactionDate: new Date("2026-10-01"),
    });
    expect(msg).toContain("🗑️");
    expect(msg).toContain("makan siang");
    expect(msg).toContain("Makanan & Minuman");
    expect(msg).toContain("Rp25.000");
    expect(msg).toContain("*YA*");
    expect(msg).toContain("*BATAL*");
  });
});

describe("formatDeleteSuccess", () => {
  test("shows deleted transaction summary and updated balance", () => {
    const msg = formatDeleteSuccess({
      description: "makan siang",
      amount: 25000,
      accountName: "BCA",
      accountBalance: 975000,
    });
    expect(msg).toContain("✅ Transaksi berhasil dihapus");
    expect(msg).toContain("makan siang");
    expect(msg).toContain("Rp25.000");
    expect(msg).toContain("Saldo BCA: Rp975.000");
  });
});

describe("formatDeleteCancellation", () => {
  test("explains nothing was deleted", () => {
    const msg = formatDeleteCancellation();
    expect(msg).toContain("❌");
    expect(msg).toContain("tetap tersimpan");
  });
});

// ─── Error States ─────────────────────────────────────────────────────────────

describe("formatMissingAmount", () => {
  test("shows helpful examples", () => {
    const msg = formatMissingAmount();
    expect(msg).toContain("⚠️");
    expect(msg).toContain("Jumlah belum ditemukan");
    expect(msg).toContain("makan 25k");
    expect(msg).toContain("bensin 20k");
  });
});

describe("formatMissingDescription", () => {
  test("includes the found amount in response", () => {
    const msg = formatMissingDescription(25000);
    expect(msg).toContain("⚠️");
    expect(msg).toContain("Rp25.000");
    expect(msg).toContain("makan 25k");
  });
});

describe("formatUnknownMessage", () => {
  test("shows example formats", () => {
    const msg = formatUnknownMessage();
    expect(msg).toContain("🤔");
    expect(msg).toContain("makan 25k");
    expect(msg).toContain("berapa saldo saya");
    expect(msg).toContain("transaksi terakhir");
  });
});

describe("formatSystemError", () => {
  test("does NOT expose SQL/stack trace", () => {
    const msg = formatSystemError();
    expect(msg).not.toContain("SQL");
    expect(msg).not.toContain("Error:");
    expect(msg).not.toContain("postgres");
    expect(msg).not.toContain("stack");
    expect(msg).toContain("⚠️");
    expect(msg).toContain("kendala");
  });

  test("does NOT positively claim success", () => {
    const msg = formatSystemError();
    // The word 'berhasil' appears only in negative context ("belum berhasil", "belum dikonfirmasi")
    expect(msg).not.toMatch(/^berhasil/im);
    expect(msg).not.toContain("berhasil disimpan!");
    expect(msg).not.toContain("berhasil dicatat");
  });
});

// ─── Encoding / No Mojibake ───────────────────────────────────────────────────

describe("Encoding — no mojibake", () => {
  const MOJIBAKE_PATTERNS = [
    "â€¢",   // corrupted •
    "âœ…",   // corrupted ✅
    "âŒ",    // corrupted ❌
    "â—",    // corrupted ◗
    "Ã",      // corrupted multi-byte
    "\u00e2", // raw 0xE2 byte from UTF-8 sequence
  ];

  const allMessages = [
    formatExpenseSuccess(makeExpenseResult("Makanan & Minuman")),
    formatIncomeSuccess(makeIncomeResult("Gaji")),
    formatTransferSuccess({ fromAccountName: "BCA", toAccountName: "GoPay", amount: 100000, fromAccountBalance: 900000 }),
    formatBatchSuccess({ items: [{ type: "EXPENSE", categoryName: "Belanja", amount: 10000, description: "test" }] }),
    formatConfirmation([{ type: "EXPENSE", categoryName: "Makanan & Minuman", amount: 25000, description: "makan" }]),
    formatCancellation(),
    formatBalance([{ name: "BCA", balance: 1000000 }]),
    formatMissingAmount(),
    formatMissingDescription(25000),
    formatUnknownMessage(),
    formatSystemError(),
    formatDeleteCancellation(),
  ];

  for (const pattern of MOJIBAKE_PATTERNS) {
    test(`no "${pattern}" in any response`, () => {
      for (const msg of allMessages) {
        expect(msg).not.toContain(pattern);
      }
    });
  }

  test("bullet character is U+2022, not HTML entity", () => {
    const msg = formatExpenseSuccess(makeExpenseResult("Makanan & Minuman"));
    expect(msg).toContain("\u2022");
    expect(msg).not.toContain("&bull;");
    expect(msg).not.toContain("&#8226;");
  });
});
