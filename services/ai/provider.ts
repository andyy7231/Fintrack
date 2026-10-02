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

export function inferCategoryHint(lower: string): string {
  // Pendidikan - expanded from 5 to 18 keywords (MOVED BEFORE Makanan to fix "fotokopi" false positive)
  if (
    lower.includes("buku") || lower.includes("fotocopy") || lower.includes("kursus") ||
    lower.includes("les ") || lower.includes("spp") ||
    lower.includes("kuliah") || lower.includes("kampus") || lower.includes("semester") ||
    lower.includes("uang gedung") || lower.includes("seragam") ||
    lower.includes("alat tulis") || lower.includes("atk") ||
    lower.includes("printer") || lower.includes("print ") || lower.includes("cetak") ||
    lower.includes("jilid") || lower.includes("skripsi") || lower.includes("fotokopi")
  ) return "Pendidikan";

  // Makanan & Minuman - expanded from 22 to 42 keywords
  if (
    lower.includes("sayur") || lower.includes("ikan") || lower.includes("daging") ||
    lower.includes("ayam") || lower.includes("beras") || lower.includes("telur") ||
    lower.includes("buah") || lower.includes("kue") || lower.includes("roti") ||
    lower.includes("mie") || lower.includes("bakso") || lower.includes("sate") ||
    lower.includes("snack") || lower.includes("jajan") || lower.includes("kopi") ||
    lower.includes("makan") || lower.includes("minum") || lower.includes("resto") ||
    lower.includes("nasi") || lower.includes("warteg") || lower.includes("sarapan") ||
    lower.includes("teh") || lower.includes(" es ") || lower.includes("gorengan") ||
    lower.includes("martabak") || lower.includes("soto") || lower.includes("gado-gado") ||
    lower.includes("gado gado") || lower.includes("rendang") || lower.includes("pecel") ||
    lower.includes("ngemil") || lower.includes("cemilan") || lower.includes("kantin") ||
    lower.includes("catering") || lower.includes("delivery makanan") || 
    lower.includes("pesan makanan") || lower.includes("pesan makan") || 
    lower.includes("gofood") || lower.includes("go food") || lower.includes("grabfood") ||
    lower.includes("makan siang") || lower.includes("makan malam")
  ) return "Makanan & Minuman";

  // Tempat Tinggal - NEW CATEGORY
  if (
    lower.includes("kos ") || lower.includes("kost ") || lower.includes(" kos") || lower.includes(" kost") ||
    lower.includes("bayar kos") || lower.includes("bayar kost") ||
    lower.includes("kontrakan") || lower.includes("sewa rumah") ||
    lower.includes("sewa kos") || lower.includes("sewa kost") ||
    lower.includes("rumah kontrakan")
  ) return "Tempat Tinggal";

  // Transportasi - expanded from 12 to 27 keywords
  if (
    lower.includes("bensin") || lower.includes("pertalite") || lower.includes("pertamax") ||
    lower.includes("solar") || lower.includes("ojek") || lower.includes("grab") ||
    lower.includes("gojek") || lower.includes("maxim") || lower.includes("tol") ||
    lower.includes("parkir") || lower.includes("tambal ban") || lower.includes("servis") ||
    lower.includes(" motor") || lower.includes("motor ") ||
    lower.includes(" mobil") || lower.includes("mobil ") ||
    lower.includes(" bus") || lower.includes("bus ") ||
    lower.includes("kereta") || lower.includes("mrt") || lower.includes("krl") ||
    lower.includes("angkot") || lower.includes("taksi") || lower.includes("taxi") ||
    lower.includes("uber") || lower.includes("cuci motor") || lower.includes("cuci mobil") ||
    lower.includes("isi angin") || lower.includes("servis motor") || lower.includes("servis mobil")
  ) return "Transportasi";

  // Tagihan & Utilitas - expanded from 12 to 22 phrases
  if (
    lower.includes("paketan") || lower.includes("paket data") || lower.includes("kuota") ||
    lower.includes("pulsa") || lower.includes("listrik") || lower.includes("token") ||
    lower.includes("pdam") || lower.includes("wifi") || lower.includes("indihome") ||
    lower.includes("internet") || lower.includes("bpjs") || lower.includes("iuran") ||
    lower.includes("bayar air") || lower.includes("tagihan air") || 
    lower.includes("air pdam") || lower.includes("galon") ||
    lower.includes("gas lpg") || lower.includes("beli gas") || lower.includes("isi gas") ||
    lower.includes("telepon") || lower.includes("pln") ||
    lower.includes("tagihan listrik") || lower.includes("bayar listrik") ||
    lower.includes("bayar wifi") || lower.includes("bayar internet") || lower.includes("bayar pulsa")
  ) return "Tagihan & Utilitas";

  // Belanja - expanded from 11 to 28 keywords
  if (
    lower.includes("belanja") || lower.includes("shopee") || lower.includes("tokopedia") ||
    lower.includes("tiktok shop") || lower.includes("baju") || lower.includes("celana") ||
    lower.includes("sepatu") || lower.includes("sabun") || lower.includes("odol") ||
    lower.includes("indomaret") || lower.includes("alfamart") ||
    lower.includes("lazada") || lower.includes("blibli") || lower.includes("bukalapak") ||
    lower.includes("jd.id") || lower.includes(" tas") || lower.includes("tas ") ||
    lower.includes("jam tangan") || lower.includes("kaos kaki") ||
    lower.includes("sampo") || lower.includes("shampoo") || lower.includes("deterjen") ||
    lower.includes("detergen") || lower.includes("tisu") || lower.includes("tissue") ||
    lower.includes("supermarket") || lower.includes("superindo") || lower.includes("giant") ||
    lower.includes("carrefour") || lower.includes("minimarket")
  ) return "Belanja";

  // Kesehatan - expanded from 6 to 16 keywords
  if (
    lower.includes("obat") || lower.includes("dokter") || lower.includes("apotek") ||
    lower.includes("vitamin") || lower.includes("klinik") || lower.includes("paracetamol") ||
    lower.includes("rumah sakit") || lower.includes(" rs ") || lower.includes("puskesmas") ||
    lower.includes("cek lab") || lower.includes("laboratorium") ||
    lower.includes("rontgen") || lower.includes("tes kesehatan") || lower.includes("tes covid") ||
    lower.includes("imunisasi") || lower.includes("susu formula") || lower.includes("popok")
  ) return "Kesehatan";

  // Hiburan - expanded from 6 to 18 keywords
  if (
    lower.includes("nonton") || lower.includes("bioskop") || lower.includes("game") ||
    lower.includes("steam") || lower.includes("netflix") || lower.includes("spotify") ||
    lower.includes("youtube premium") || lower.includes("disney+") || lower.includes("disney plus") ||
    lower.includes("hbo") || lower.includes("hbo max") || lower.includes("viu") ||
    lower.includes("playstation") || lower.includes("ps5") || lower.includes("ps4") ||
    lower.includes("nintendo") || lower.includes("switch") || lower.includes("xbox") ||
    lower.includes("console") || lower.includes("tiket konser") || lower.includes("konser") ||
    lower.includes("wisata") || lower.includes("liburan") || lower.includes("karaoke")
  ) return "Hiburan";

  // FIXED: Fallback to "Pengeluaran Lain" instead of "Lainnya"
  return "Pengeluaran Lain";
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
  
  // Explicit Free Cash keywords
  if (
    lower.includes("uang free") ||
    lower.includes("free cash") ||
    lower.includes("uang bebas") ||
    lower.includes("kas free") ||
    lower.includes("uang tersedia") ||
    lower.includes("uang bisa dipakai") ||
    lower.includes("uang yang bisa") ||
    (lower.includes("sisa") && lower.includes("free")) ||
    (lower.includes("berapa") && lower.includes("free"))
  ) {
    return true;
  }
  
  // DEFAULT: "sisa uang" queries return Free Cash (unallocated money)
  // Per spec requirement: "berapa sisa uang saya" should return Free Cash, not Actual Balance
  if (
    lower.includes("sisa uang") ||
    lower.includes("sisa duit") ||
    lower.includes("uang sisa")
  ) {
    return true;
  }
  
  // Only return Total Balance if user explicitly asks for "total" or "keseluruhan"
  if (
    lower.includes("total") ||
    lower.includes("keseluruhan") ||
    lower.includes("semua saldo") ||
    lower.includes("jumlah seluruh")
  ) {
    return false;
  }
  
  // Default balance queries return Free Cash (safer default for budgeting)
  return true;
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
      if (lower.includes("freelance")) categoryHint = "Freelance";
      else if (lower.includes("bonus")) categoryHint = "Bonus";
      else if (lower.includes("penjualan") || lower.includes("jualan") || lower.includes("bisnis")) categoryHint = "Bisnis";
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
