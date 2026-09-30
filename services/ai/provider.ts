import {
  ParsedFinancialBatch,
  ParsedFinancialIntent,
  financialBatchSchema,
} from "./schemas";
import { parseIndonesianAmount } from "./amount.utils";

export interface FinancialParserInput {
  text: string;
  currentDate: string; // YYYY-MM-DD in Asia/Jakarta
  timezone: string; // 'Asia/Jakarta'
  context?: {
    userAccounts?: string[];
    userCategories?: string[];
  };
}

export interface FinancialParserProvider {
  parseFinancialMessage(input: FinancialParserInput): Promise<ParsedFinancialBatch>;
}

// ─────────────────────────────────────────────────────────────
// Category / account hint helpers (shared by MockAIProvider)
// ─────────────────────────────────────────────────────────────

function inferCategoryHint(lower: string): string {
  if (
    lower.includes("sayur") || lower.includes("ikan") || lower.includes("daging") ||
    lower.includes("ayam") || lower.includes("beras") || lower.includes("telur") ||
    lower.includes("buah") || lower.includes("kue") || lower.includes("roti") ||
    lower.includes("mie") || lower.includes("bakso") || lower.includes("sate") ||
    lower.includes("snack") || lower.includes("jajan") || lower.includes("kopi") ||
    lower.includes("makan") || lower.includes("minum") || lower.includes("resto") ||
    lower.includes("nasi") || lower.includes("warteg") || lower.includes("sarapan")
  ) return "Makanan & Minuman";

  if (
    lower.includes("bensin") || lower.includes("pertalite") || lower.includes("pertamax") ||
    lower.includes("solar") || lower.includes("ojek") || lower.includes("grab") ||
    lower.includes("gojek") || lower.includes("maxim") || lower.includes("tol") ||
    lower.includes("parkir") || lower.includes("tambal ban") || lower.includes("servis")
  ) return "Transportasi";

  if (
    lower.includes("paketan") || lower.includes("paket data") || lower.includes("kuota") ||
    lower.includes("pulsa") || lower.includes("listrik") || lower.includes("token") ||
    lower.includes("pdam") || lower.includes("wifi") || lower.includes("indihome") ||
    lower.includes("internet") || lower.includes("bpjs") || lower.includes("iuran")
  ) return "Tagihan & Utilitas";

  if (
    lower.includes("belanja") || lower.includes("shopee") || lower.includes("tokopedia") ||
    lower.includes("tiktok shop") || lower.includes("baju") || lower.includes("celana") ||
    lower.includes("sepatu") || lower.includes("sabun") || lower.includes("odol") ||
    lower.includes("indomaret") || lower.includes("alfamart")
  ) return "Belanja";

  if (
    lower.includes("obat") || lower.includes("dokter") || lower.includes("apotek") ||
    lower.includes("vitamin") || lower.includes("klinik") || lower.includes("paracetamol")
  ) return "Kesehatan";

  if (
    lower.includes("nonton") || lower.includes("bioskop") || lower.includes("game") ||
    lower.includes("steam") || lower.includes("netflix") || lower.includes("spotify")
  ) return "Hiburan";

  if (
    lower.includes("buku") || lower.includes("fotocopy") || lower.includes("kursus") ||
    lower.includes("les") || lower.includes("spp")
  ) return "Pendidikan";

  return "Lainnya";
}

export function inferAccountHint(lower: string): string | null {
  if (lower.includes("bca")) return "BCA";
  if (lower.includes("mandiri")) return "Mandiri";
  if (lower.includes("bri")) return "BRI";
  if (lower.includes("bni")) return "BNI";
  if (lower.includes("cash") || lower.includes("tunai") || lower.includes("kas")) return "Cash";
  if (lower.includes("gopay")) return "GoPay";
  if (lower.includes("ovo")) return "OVO";
  if (lower.includes("dana")) return "DANA";
  return null;
}

// ─────────────────────────────────────────────────────────────
// Balance query keyword detection
// ─────────────────────────────────────────────────────────────

export function isBalanceQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.includes("budget") || lower.includes("anggaran")) {
    return false;
  }
  const hasSaldoWord = lower.includes("saldo");
  const hasUangQuery =
    lower.includes("sisa uang") ||
    lower.includes("sisa duit") ||
    lower.includes("uang saya") ||
    lower.includes("duit saya") ||
    lower.includes("uang ku") ||
    lower.includes("duit ku") ||
    lower.includes("cek uang") ||
    lower.includes("uang tinggal") ||
    lower.includes("duit tinggal") ||
    lower.includes("punya uang") ||
    lower.includes("punya duit") ||
    lower.includes("berapa uang") ||
    lower.includes("uang sekarang") ||
    lower.includes("uang ada berapa") ||
    lower.includes("uang free") ||
    lower.includes("free cash") ||
    lower.includes("uang bebas") ||
    lower.includes("kas free");

  if (hasSaldoWord || hasUangQuery) {
    if (
      !lower.startsWith("beli") &&
      !lower.startsWith("transfer") &&
      !lower.startsWith("kirim") &&
      !lower.startsWith("bayar")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if user is asking for free cash (unallocated money) vs total balance
 */
export function isFreeCashQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes("uang free") ||
    lower.includes("free cash") ||
    lower.includes("uang bebas") ||
    lower.includes("kas free") ||
    lower.includes("uang tersedia") ||
    lower.includes("uang bisa dipakai") ||
    lower.includes("uang yang bisa") ||
    (lower.includes("sisa") && lower.includes("free")) ||
    (lower.includes("berapa") && lower.includes("free"))
  );
}

// ─────────────────────────────────────────────────────────────
// Budget allocation keyword detection
// ─────────────────────────────────────────────────────────────

const BUDGET_ALLOC_KEYWORDS = ["budget ", "anggaran ", "alokasi ", "jatah "];

// Detects budget allocation keywords anywhere in the text (inline or at start)
// Keywords have trailing space to avoid false positives (e.g., "prebudget" won't match "budget ")
// Additional check: must not have expense verbs like "beli", "bayar", "biaya" before the keyword
export function isBudgetAllocationLine(lower: string): boolean {
  // Check if any budget keyword exists
  const hasBudgetKeyword = BUDGET_ALLOC_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasBudgetKeyword) return false;
  
  // Check if expense verbs appear before budget keyword
  // If so, this is likely an expense where "budget" is part of the item description
  const expenseVerbs = ["beli ", "bayar ", "biaya ", "buat ", "pesan "];
  for (const verb of expenseVerbs) {
    if (lower.startsWith(verb)) {
      // Expense verb at start - likely "beli budget plan book 50k"
      return false;
    }
  }
  
  return true;
}

// ─────────────────────────────────────────────────────────────
// Mock AI Provider — deterministic, offline, zero-cost
// ─────────────────────────────────────────────────────────────

export class MockAIProvider implements FinancialParserProvider {
  public shouldFail = false;
  public mockResponse: ParsedFinancialBatch | null = null;

  async parseFinancialMessage(
    input: FinancialParserInput
  ): Promise<ParsedFinancialBatch> {
    if (this.shouldFail) {
      throw new Error("Simulated AI Provider API Error (Timeout / Rate Limit)");
    }
    if (this.mockResponse) {
      return this.mockResponse;
    }

    const text = input.text.trim();
    const lower = text.toLowerCase();

    // BALANCE_QUERY — read-only, no mutations
    if (isBalanceQuery(lower)) {
      return { actions: [{ intent: "BALANCE_QUERY", accountHint: inferAccountHint(lower) }] };
    }

    // Check if multi-line message (multi-action batch)
    const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (rawLines.length > 1) {
      const actions: ParsedFinancialIntent[] = [];
      for (const line of rawLines) {
        const lineLower = line.toLowerCase();
        // Skip header lines without amounts or balance queries, e.g. "Gaji dibagi untuk:" without amount or "Rincian:"
        if (!/\d/.test(line) && !isBalanceQuery(lineLower)) {
          continue;
        }
        actions.push(this._parseSingleIntent(line, lineLower, input.currentDate));
      }
      if (actions.length > 0) {
        return { actions };
      }
    }

    // Single-action parse
    const single = this._parseSingleIntent(text, lower, input.currentDate);
    return { actions: [single] };
  }

  private _parseSingleIntent(
    text: string,
    lower: string,
    currentDate: string
  ): ParsedFinancialIntent {
    // 1. Budget allocation
    if (isBudgetAllocationLine(lower)) {
      const amountMatches = text.match(
        /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d{4,})/gi
      );
      let amount: number | null = null;
      for (const m of amountMatches || []) {
        const parsed = parseIndonesianAmount(m);
        if (parsed && parsed > 0) { amount = parsed; break; }
      }
      if (!amount) {
        return { intent: "UNKNOWN", reason: "MISSING_AMOUNT", clarificationQuestion: "Berapa nominal budgetnya?" };
      }
      
      // Extract category name after the budget keyword (handles keywords at any position)
      let textWithoutKeyword = lower;
      for (const kw of ["budget ", "anggaran ", "alokasi ", "jatah "]) {
        if (textWithoutKeyword.includes(kw)) {
          // Split on the keyword and take the part after it
          const parts = textWithoutKeyword.split(kw);
          textWithoutKeyword = parts[parts.length - 1] || "";
          break;
        }
      }
      
      const categoryName = textWithoutKeyword
        .replace(/[0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?/gi, "")
        .replace(/\s+/g, " ")
        .trim() || "Lainnya";
      
      return { intent: "BUDGET_ALLOCATION", amount, categoryName };
    }

    // 2. Missing amount check
    const hasAnyDigits = /\d/.test(text);
    if (!hasAnyDigits) {
      if (lower.includes("beli") || lower.includes("makan") || lower.includes("bayar")) {
        return { intent: "UNKNOWN", reason: "MISSING_AMOUNT", clarificationQuestion: "Berapa nominal transaksi yang ingin dicatat?" };
      }
      return { intent: "UNKNOWN", reason: "UNCLEAR_INTENT", clarificationQuestion: "[DEBUG: MOCK AI PROVIDER - KEYWORD BASED] Maaf, saya belum memahami pesan Anda. Coba tulis seperti: 'Beli kopi 25 ribu'." };
    }

    // 3. Ambiguous expense
    if (/^(?:bayar|keluar)\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower)) {
      return { intent: "UNKNOWN", reason: "AMBIGUOUS_EXPENSE", clarificationQuestion: "Mau mencatat pengeluaran untuk apa?" };
    }

    if (
      /^[a-z]+\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower) &&
      !lower.includes("beli") && !lower.includes("gaji") &&
      !lower.includes("makan") && !lower.includes("transfer")
    ) {
      return { intent: "UNKNOWN", reason: "AMBIGUOUS_INTENT", clarificationQuestion: "Apakah ini transfer, pengeluaran, atau pemasukan?" };
    }

    // 4. Transfer intent
    if (
      lower.startsWith("transfer") || lower.startsWith("pindah") ||
      (lower.includes("dari ") && lower.includes(" ke "))
    ) {
      const amountMatch = lower.match(
        /(?:transfer|pindah)?\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d+)/i
      );
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[1]) : null;
      if (!amount) return { intent: "UNKNOWN", reason: "MISSING_AMOUNT", clarificationQuestion: "Berapa nominal transfernya?" };
      const fromMatch = lower.match(/dari\s+([a-z0-9_\-\s]+?)(?:\s+ke\s+|$)/i);
      const toMatch = lower.match(/ke\s+([a-z0-9_\-\s]+?)(?:\s+dari\s+|$)/i);
      return {
        intent: "TRANSFER", amount, description: text, transferDate: currentDate,
        fromAccountHint: fromMatch ? fromMatch[1].trim() : null,
        toAccountHint: toMatch ? toMatch[1].trim() : null,
        confidence: 0.95,
      };
    }

    // 5. Income intent
    if (
      lower.includes("gaji") || lower.includes("gajian") || lower.includes("dapat uang") ||
      lower.includes("freelance") || lower.includes("bonus") || lower.includes("penjualan") ||
      lower.includes("terima uang")
    ) {
      const amountMatch = lower.match(/(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d+)/i);
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[0]) : null;
      if (!amount) return { intent: "UNKNOWN", reason: "MISSING_AMOUNT", clarificationQuestion: "Berapa nominal pemasukan yang diterima?" };
      let categoryHint = "Gaji";
      if (lower.includes("freelance")) categoryHint = "Freelance / Side Job";
      else if (lower.includes("bonus")) categoryHint = "Bonus & Hadiah";
      else if (lower.includes("penjualan")) categoryHint = "Penjualan";
      let desc = text;
      if (amountMatch) desc = desc.replace(amountMatch[0], "");
      desc = desc
        .replace(/^(?:dapat\s+uang\s+|gajian\s+|gaji\s+)/i, "")
        .replace(/\b(?:dibagi\s+untuk|dibagi|alokasi):?\s*$/i, "")
        .replace(/[:]/g, "")
        .trim();
      if (!desc || desc.length < 2) desc = "Gaji";

      return {
        intent: "INCOME", amount,
        description: desc,
        transactionDate: currentDate, categoryHint, confidence: 0.95,
      };
    }

    // 6. Expense intent (default)
    const amountMatches = text.match(
      /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d{4,})/gi
    );
    let amount: number | null = null;
    let amountRawStr = "";
    for (const m of amountMatches || []) {
      const parsed = parseIndonesianAmount(m);
      if (parsed && parsed > 0) { amount = parsed; amountRawStr = m; break; }
    }
    if (!amount) return { intent: "UNKNOWN", reason: "MISSING_AMOUNT", clarificationQuestion: "Berapa nominal pengeluaran yang ingin dicatat?" };

    let desc = text;
    if (amountRawStr) desc = desc.replace(amountRawStr, "");
    desc = desc
      .replace(/\b(?:tadi|kemarin|hari ini|pagi|siang|sore|malam)\b/gi, "")
      .replace(/\b(?:beli|bayar|pesan|buat|untuk|biaya)\b/gi, "")
      .replace(/\s+/g, " ").trim();
    if (!desc || desc.length < 2) desc = "Pengeluaran";

    return {
      intent: "EXPENSE", amount, description: desc,
      transactionDate: currentDate,
      categoryHint: inferCategoryHint(lower),
      accountHint: inferAccountHint(lower),
      confidence: 0.94,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Gemini AI Provider — production NLU
// ─────────────────────────────────────────────────────────────
// Gemini AI Provider (Phase 5.3: Natural Language Understanding)
// ─────────────────────────────────────────────────────────────
export { GeminiAIProvider } from './gemini-provider';
