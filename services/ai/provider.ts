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
// Helpers
// ─────────────────────────────────────────────────────────────

function inferCategoryHint(lower: string): string {
  if (
    lower.includes("sayur") ||
    lower.includes("ikan") ||
    lower.includes("daging") ||
    lower.includes("ayam") ||
    lower.includes("beras") ||
    lower.includes("telur") ||
    lower.includes("buah") ||
    lower.includes("kue") ||
    lower.includes("roti") ||
    lower.includes("mie") ||
    lower.includes("bakso") ||
    lower.includes("sate") ||
    lower.includes("snack") ||
    lower.includes("jajan") ||
    lower.includes("kopi") ||
    lower.includes("makan") ||
    lower.includes("minum") ||
    lower.includes("resto") ||
    lower.includes("nasi") ||
    lower.includes("warteg") ||
    lower.includes("sarapan")
  ) {
    return "Makanan & Minuman";
  } else if (
    lower.includes("bensin") ||
    lower.includes("pertalite") ||
    lower.includes("pertamax") ||
    lower.includes("solar") ||
    lower.includes("ojek") ||
    lower.includes("grab") ||
    lower.includes("gojek") ||
    lower.includes("maxim") ||
    lower.includes("tol") ||
    lower.includes("parkir") ||
    lower.includes("tambal ban") ||
    lower.includes("servis")
  ) {
    return "Transportasi";
  } else if (
    lower.includes("paketan") ||
    lower.includes("paket data") ||
    lower.includes("kuota") ||
    lower.includes("pulsa") ||
    lower.includes("listrik") ||
    lower.includes("token") ||
    lower.includes("air") ||
    lower.includes("pdam") ||
    lower.includes("wifi") ||
    lower.includes("indihome") ||
    lower.includes("internet") ||
    lower.includes("bpjs") ||
    lower.includes("iuran")
  ) {
    return "Tagihan & Utilitas";
  } else if (
    lower.includes("belanja") ||
    lower.includes("shopee") ||
    lower.includes("tokopedia") ||
    lower.includes("tiktok shop") ||
    lower.includes("baju") ||
    lower.includes("celana") ||
    lower.includes("sepatu") ||
    lower.includes("sabun") ||
    lower.includes("odol") ||
    lower.includes("indomaret") ||
    lower.includes("alfamart")
  ) {
    return "Belanja";
  } else if (
    lower.includes("obat") ||
    lower.includes("dokter") ||
    lower.includes("apotek") ||
    lower.includes("vitamin") ||
    lower.includes("klinik") ||
    lower.includes("paracetamol")
  ) {
    return "Kesehatan";
  } else if (
    lower.includes("nonton") ||
    lower.includes("bioskop") ||
    lower.includes("game") ||
    lower.includes("steam") ||
    lower.includes("netflix") ||
    lower.includes("spotify")
  ) {
    return "Hiburan";
  } else if (
    lower.includes("buku") ||
    lower.includes("fotocopy") ||
    lower.includes("kursus") ||
    lower.includes("les") ||
    lower.includes("spp")
  ) {
    return "Pendidikan";
  }
  return "Lainnya";
}

function inferAccountHint(lower: string): string | null {
  if (lower.includes("bca")) return "BCA";
  if (lower.includes("cash") || lower.includes("tunai")) return "Cash";
  if (lower.includes("gopay")) return "GoPay";
  if (lower.includes("ovo")) return "OVO";
  if (lower.includes("dana")) return "DANA";
  return null;
}

// ─────────────────────────────────────────────────────────────
// Mock AI Provider — deterministic, zero-cost, fully offline
// ─────────────────────────────────────────────────────────────

/**
 * MockAIProvider now returns a ParsedFinancialBatch (array wrapper).
 * The mock deterministically handles single-action messages.
 * Multi-action messages from real usage are handled by GeminiAIProvider.
 */
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

    const singleIntent = this._parseSingleIntent(text, lower, input.currentDate);
    return { actions: [singleIntent] };
  }

  private _parseSingleIntent(
    text: string,
    lower: string,
    currentDate: string
  ): ParsedFinancialIntent {
    // 1. Missing amount check
    const hasAnyDigits = /\d/.test(text);
    if (!hasAnyDigits) {
      if (lower.includes("beli") || lower.includes("makan") || lower.includes("bayar")) {
        return {
          intent: "UNKNOWN",
          reason: "MISSING_AMOUNT",
          clarificationQuestion: "Berapa nominal transaksi yang ingin dicatat?",
        };
      }
      return {
        intent: "UNKNOWN",
        reason: "UNCLEAR_INTENT",
        clarificationQuestion:
          "Maaf, saya belum memahami pesan Anda. Coba tulis seperti: 'Beli kopi 25 ribu'.",
      };
    }

    // 2. Ambiguous intent check
    if (/^(?:bayar|keluar)\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower)) {
      return {
        intent: "UNKNOWN",
        reason: "AMBIGUOUS_EXPENSE",
        clarificationQuestion: "Mau mencatat pengeluaran untuk apa?",
      };
    }

    if (
      /^[a-z]+\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower) &&
      !lower.includes("beli") &&
      !lower.includes("gaji") &&
      !lower.includes("makan") &&
      !lower.includes("transfer")
    ) {
      return {
        intent: "UNKNOWN",
        reason: "AMBIGUOUS_INTENT",
        clarificationQuestion: "Apakah ini transfer, pengeluaran, atau pemasukan?",
      };
    }

    // 3. Transfer Intent
    if (
      lower.startsWith("transfer") ||
      lower.startsWith("pindah") ||
      (lower.includes("dari ") && lower.includes(" ke "))
    ) {
      const amountMatch = lower.match(
        /(?:transfer|pindah)?\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d+)/i
      );
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[1]) : null;

      if (!amount) {
        return {
          intent: "UNKNOWN",
          reason: "MISSING_AMOUNT",
          clarificationQuestion: "Berapa nominal transfernya?",
        };
      }

      const fromMatch = lower.match(/dari\s+([a-z0-9_\-\s]+?)(?:\s+ke\s+|$)/i);
      const toMatch = lower.match(/ke\s+([a-z0-9_\-\s]+?)(?:\s+dari\s+|$)/i);

      return {
        intent: "TRANSFER",
        amount,
        description: text,
        transferDate: currentDate,
        fromAccountHint: fromMatch ? fromMatch[1].trim() : null,
        toAccountHint: toMatch ? toMatch[1].trim() : null,
        confidence: 0.95,
      };
    }

    // 4. Income Intent
    if (
      lower.includes("gaji") ||
      lower.includes("gajian") ||
      lower.includes("dapat uang") ||
      lower.includes("freelance") ||
      lower.includes("bonus") ||
      lower.includes("penjualan") ||
      lower.includes("terima uang")
    ) {
      const amountMatch = lower.match(
        /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d+)/i
      );
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[0]) : null;

      if (!amount) {
        return {
          intent: "UNKNOWN",
          reason: "MISSING_AMOUNT",
          clarificationQuestion: "Berapa nominal pemasukan yang diterima?",
        };
      }

      let categoryHint = "Gaji";
      if (lower.includes("freelance")) categoryHint = "Freelance / Side Job";
      else if (lower.includes("bonus")) categoryHint = "Bonus & Hadiah";
      else if (lower.includes("penjualan")) categoryHint = "Penjualan";

      return {
        intent: "INCOME",
        amount,
        description:
          text.replace(/^(?:dapat\s+uang\s+|gajian\s+|gaji\s+)/i, "").trim() || "Pemasukan",
        transactionDate: currentDate,
        categoryHint,
        confidence: 0.95,
      };
    }

    // 5. Expense Intent
    const amountMatches = text.match(
      /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d{4,})/gi
    );
    let amount: number | null = null;
    let amountRawStr = "";

    if (amountMatches) {
      for (const m of amountMatches) {
        const parsed = parseIndonesianAmount(m);
        if (parsed && parsed > 0) {
          amount = parsed;
          amountRawStr = m;
          break;
        }
      }
    }

    if (!amount) {
      return {
        intent: "UNKNOWN",
        reason: "MISSING_AMOUNT",
        clarificationQuestion: "Berapa nominal pengeluaran yang ingin dicatat?",
      };
    }

    let desc = text;
    if (amountRawStr) {
      desc = desc.replace(amountRawStr, "");
    }
    desc = desc
      .replace(/\b(?:tadi|kemarin|hari ini|pagi|siang|sore|malam)\b/gi, "")
      .replace(/\b(?:beli|bayar|pesan|buat|untuk)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!desc || desc.length < 2) {
      desc = "Pengeluaran";
    }

    return {
      intent: "EXPENSE",
      amount,
      description: desc,
      transactionDate: currentDate,
      categoryHint: inferCategoryHint(lower),
      accountHint: inferAccountHint(lower),
      confidence: 0.94,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Gemini AI Provider — production natural language parsing
// ─────────────────────────────────────────────────────────────

/**
 * GeminiAIProvider now requests a JSON array of actions from Gemini,
 * enabling true multi-action parsing from a single WhatsApp message.
 */
export class GeminiAIProvider implements FinancialParserProvider {
  private apiKey: string;

  constructor(apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "") {
    this.apiKey = apiKey;
  }

  async parseFinancialMessage(
    input: FinancialParserInput
  ): Promise<ParsedFinancialBatch> {
    if (!this.apiKey) {
      const mock = new MockAIProvider();
      return mock.parseFinancialMessage(input);
    }

    try {
      const accountList = input.context?.userAccounts?.length
        ? `User's accounts: ${input.context.userAccounts.join(", ")}`
        : "";
      const categoryList = input.context?.userCategories?.length
        ? `User's categories: ${input.context.userCategories.join(", ")}`
        : "";

      const systemPrompt = `You are a financial transaction natural-language parser for an Indonesian personal finance app.
Given a user's WhatsApp message, extract ALL financial intents and return them as a JSON array.
Business timezone is Asia/Jakarta (UTC+7). Today's date is: ${input.currentDate}.
${accountList}
${categoryList}

CRITICAL RULES:
1. A single message may contain MULTIPLE financial actions. Parse ALL of them.
   Example: "beli kopi 25k sama beli bensin 50rb" → 2 EXPENSE actions.
   Example: "gaji 5jt beli makan 30rb beli bensin 50k" → 1 INCOME + 2 EXPENSE actions.
2. Return a JSON object with this exact structure:
   { "actions": [ ...intentObjects ] }
3. Each intent object must match ONE of these schemas:
   - EXPENSE:  { "intent": "EXPENSE",  "amount": number, "description": string, "transactionDate": string, "accountHint": string|null, "categoryHint": string|null, "confidence": number }
   - INCOME:   { "intent": "INCOME",   "amount": number, "description": string, "transactionDate": string, "accountHint": string|null, "categoryHint": string|null, "confidence": number }
   - TRANSFER: { "intent": "TRANSFER", "amount": number, "description": string|null, "transferDate": string, "fromAccountHint": string|null, "toAccountHint": string|null, "confidence": number }
   - UNKNOWN:  { "intent": "UNKNOWN",  "reason": string, "clarificationQuestion": string }
4. Category Mapping (Indonesian context):
   - "sayur", "lauk", "ikan", "ayam", "makan", "kopi", "nasi", "makanan", "sarapan", "jajan", "warung" → "Makanan & Minuman"
   - "paketan", "paket data", "kuota", "pulsa", "listrik", "wifi", "token", "pdam", "bpjs" → "Tagihan & Utilitas"
   - "bensin", "ojek", "grab", "gojek", "parkir", "tol", "bis", "busway" → "Transportasi"
   - "belanja", "shopee", "tokopedia", "baju", "barang", "indomaret", "alfamart" → "Belanja"
   - "obat", "dokter", "apotek", "vitamin", "klinik" → "Kesehatan"
   - "nonton", "bioskop", "game", "top up", "netflix", "spotify" → "Hiburan"
   - If unclear → "Lainnya"
5. Indonesian number formats: 15k=15000, 25rb=25000, 25 ribu=25000, 1,5 juta=1500000, 5jt=5000000.
6. amount must always be a positive number.
7. Do NOT invent database IDs, user IDs, or account IDs.
8. If amount is missing or intent is ambiguous, return { "intent": "UNKNOWN", ... }.
9. transactionDate / transferDate must be YYYY-MM-DD. Use today's date if not specified.
10. Maximum 10 actions per message.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser message: "${input.text}"` }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API HTTP ${response.status}`);
      }

      const resData = await response.json();
      const rawJson = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error("Empty response from Gemini API");
      }

      const parsed = JSON.parse(rawJson);

      // Handle both legacy single-intent and new batch format
      // Legacy: { intent: "EXPENSE", ... } → wrap in batch
      if (parsed.intent && typeof parsed.intent === "string") {
        return financialBatchSchema.parse({ actions: [parsed] });
      }

      // New batch format: { actions: [...] }
      return financialBatchSchema.parse(parsed);
    } catch {
      // Fallback to deterministic mock parser on any failure
      const mock = new MockAIProvider();
      return mock.parseFinancialMessage(input);
    }
  }
}
