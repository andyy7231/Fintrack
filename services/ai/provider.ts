import {
  ParsedFinancialIntent,
  financialIntentSchema,
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
  parseFinancialMessage(input: FinancialParserInput): Promise<ParsedFinancialIntent>;
}

/**
 * Mock AI Provider for Automated Testing & Deterministic Fallback
 * Provides 100% testable, fast, offline, and zero-cost intent parsing.
 */
export class MockAIProvider implements FinancialParserProvider {
  // Option to force failure for testing error handling
  public shouldFail = false;
  public mockResponse: ParsedFinancialIntent | null = null;

  async parseFinancialMessage(
    input: FinancialParserInput
  ): Promise<ParsedFinancialIntent> {
    if (this.shouldFail) {
      throw new Error("Simulated AI Provider API Error (Timeout / Rate Limit)");
    }

    if (this.mockResponse) {
      return this.mockResponse;
    }

    const text = input.text.trim();
    const lower = text.toLowerCase();

    // 1. Missing amount check (e.g. "tadi beli kopi", "beli kopi", "makan siang")
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
        clarificationQuestion: "Maaf, saya belum memahami pesan Anda. Coba tulis seperti: 'Beli kopi 25 ribu'.",
      };
    }

    // 2. Ambiguous intent check (e.g. "bayar 50 ribu" with no description, "BCA 500 ribu")
    if (/^(?:bayar|keluar)\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower)) {
      return {
        intent: "UNKNOWN",
        reason: "AMBIGUOUS_EXPENSE",
        clarificationQuestion: "Mau mencatat pengeluaran untuk apa?",
      };
    }

    if (/^[a-z]+\s+\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?$/i.test(lower) && !lower.includes("beli") && !lower.includes("gaji") && !lower.includes("makan") && !lower.includes("transfer")) {
      // e.g. "BCA 500 ribu"
      return {
        intent: "UNKNOWN",
        reason: "AMBIGUOUS_INTENT",
        clarificationQuestion: "Apakah ini transfer, pengeluaran, atau pemasukan?",
      };
    }

    // 3. Transfer Intent
    // e.g. "Transfer 500 ribu dari BCA ke BNI", "Pindah 200rb dari BCA ke GoPay", "Transfer 500rb ke BCA"
    if (lower.startsWith("transfer") || lower.startsWith("pindah") || lower.includes("dari ") && lower.includes(" ke ")) {
      // Extract amount
      const amountMatch = lower.match(/(?:transfer|pindah)?\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d+)/i);
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[1]) : null;

      if (!amount) {
        return {
          intent: "UNKNOWN",
          reason: "MISSING_AMOUNT",
          clarificationQuestion: "Berapa nominal transfernya?",
        };
      }

      // Extract from / to accounts
      const fromMatch = lower.match(/dari\s+([a-z0-9_\-\s]+?)(?:\s+ke\s+|$)/i);
      const toMatch = lower.match(/ke\s+([a-z0-9_\-\s]+?)(?:\s+dari\s+|$)/i);

      const fromAccountHint = fromMatch ? fromMatch[1].trim() : null;
      const toAccountHint = toMatch ? toMatch[1].trim() : null;

      return {
        intent: "TRANSFER",
        amount,
        description: text,
        transferDate: input.currentDate,
        fromAccountHint,
        toAccountHint,
        confidence: 0.95,
      };
    }

    // 4. Income Intent
    // e.g. "Gajian 7,5 juta", "Dapat uang freelance 1 juta", "Bonus 500rb", "Gaji masuk 5000000"
    if (
      lower.includes("gaji") ||
      lower.includes("gajian") ||
      lower.includes("dapat uang") ||
      lower.includes("freelance") ||
      lower.includes("bonus") ||
      lower.includes("penjualan") ||
      lower.includes("terima uang")
    ) {
      // Find amount inside string
      const amountMatch = lower.match(/(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d+)/i);
      const amount = amountMatch ? parseIndonesianAmount(amountMatch[0]) : null;

      if (!amount) {
        return {
          intent: "UNKNOWN",
          reason: "MISSING_AMOUNT",
          clarificationQuestion: "Berapa nominal pemasukan yang diterima?",
        };
      }

      // Check category hint
      let categoryHint = "Gaji";
      if (lower.includes("freelance")) categoryHint = "Freelance / Side Job";
      else if (lower.includes("bonus")) categoryHint = "Bonus & Hadiah";
      else if (lower.includes("penjualan")) categoryHint = "Penjualan";

      return {
        intent: "INCOME",
        amount,
        description: text.replace(/^(?:dapat\s+uang\s+|gajian\s+|gaji\s+)/i, "").trim() || "Pemasukan",
        transactionDate: input.currentDate,
        categoryHint,
        confidence: 0.95,
      };
    }

    // 5. Expense Intent
    // e.g. "Beli kopi 25 ribu", "Tadi makan siang 35rb", "Kemarin beli bensin 50 ribu", "Bayar listrik 300 ribu"
    // Find amount
    const amountMatches = text.match(/(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:ribu|rb|k|juta|jt)?|\d{4,})/gi);
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

    // Extract description by removing amount and common filler words
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

    // Category inference based on keywords
    let categoryHint: string | null = null;
    if (lower.includes("kopi") || lower.includes("makan") || lower.includes("minum") || lower.includes("resto") || lower.includes("nasi")) {
      categoryHint = "Makanan & Minuman";
    } else if (lower.includes("bensin") || lower.includes("ojek") || lower.includes("grab") || lower.includes("gojek") || lower.includes("tol")) {
      categoryHint = "Transportasi";
    } else if (lower.includes("listrik") || lower.includes("air") || lower.includes("pulsa") || lower.includes("wifi") || lower.includes("internet")) {
      categoryHint = "Tagihan & Utilitas";
    } else if (lower.includes("belanja") || lower.includes("shopee") || lower.includes("tokopedia")) {
      categoryHint = "Belanja";
    }

    // Account hint
    let accountHint: string | null = null;
    if (lower.includes("bca")) accountHint = "BCA";
    else if (lower.includes("cash") || lower.includes("tunai")) accountHint = "Cash";
    else if (lower.includes("gopay")) accountHint = "GoPay";
    else if (lower.includes("ovo")) accountHint = "OVO";
    else if (lower.includes("dana")) accountHint = "DANA";

    return {
      intent: "EXPENSE",
      amount,
      description: desc,
      transactionDate: input.currentDate,
      categoryHint,
      accountHint,
      confidence: 0.94,
    };
  }
}

/**
 * Gemini AI Provider implementation for production natural language parsing.
 * Uses system prompt and structured JSON outputs.
 */
export class GeminiAIProvider implements FinancialParserProvider {
  private apiKey: string;

  constructor(apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "") {
    this.apiKey = apiKey;
  }

  async parseFinancialMessage(
    input: FinancialParserInput
  ): Promise<ParsedFinancialIntent> {
    if (!this.apiKey) {
      // Fallback to deterministic mock provider if API key is not configured
      const mock = new MockAIProvider();
      return mock.parseFinancialMessage(input);
    }

    try {
      const systemPrompt = `You are a financial transaction natural-language parser for an Indonesian personal finance app.
Given a user's text message, extract the structured financial intent.
Business timezone is Asia/Jakarta (UTC+7). Today's date is: ${input.currentDate}.

Rules:
1. Return JSON strictly matching the schema:
   - For expense: { "intent": "EXPENSE", "amount": number, "description": string, "transactionDate": string, "accountHint": string|null, "categoryHint": string|null, "confidence": number }
   - For income: { "intent": "INCOME", "amount": number, "description": string, "transactionDate": string, "accountHint": string|null, "categoryHint": string|null, "confidence": number }
   - For transfer: { "intent": "TRANSFER", "amount": number, "description": string|null, "transferDate": string, "fromAccountHint": string|null, "toAccountHint": string|null, "confidence": number }
   - For unclear/missing: { "intent": "UNKNOWN", "reason": string, "clarificationQuestion": string }
2. Understand Indonesian numbers: 25 ribu = 25000, 1,5 juta = 1500000, 7,5 juta = 7500000.
3. Amount must be positive.
4. Do not invent facts or database IDs.
5. If amount is missing or intent is ambiguous, return intent UNKNOWN.`;

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
      return financialIntentSchema.parse(parsed);
    } catch {
      // Fallback to deterministic parser on network or API failure
      const mock = new MockAIProvider();
      return mock.parseFinancialMessage(input);
    }
  }
}
