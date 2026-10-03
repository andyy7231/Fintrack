import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import {
  ParsedFinancialBatch,

  financialBatchSchema,
} from "./schemas";
import { FinancialParserInput, FinancialParserProvider } from "./provider";

/**
 * Gemini AI Provider for Natural Language Financial Parsing
 * 
 * Uses Google Gemini Flash for intelligent intent detection
 * with support for:
 * - Natural, conversational language
 * - Typos and abbreviations
 * - Context-aware interpretation
 * - Multi-language support (Indonesian + English)
 * - Automatic retry with exponential backoff for transient failures
 */
export class GeminiAIProvider implements FinancialParserProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly MAX_RETRIES = 2;
  private readonly INITIAL_RETRY_DELAY = 500; // ms

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is required for GeminiAIProvider");
    }
    
    this.genAI = new GoogleGenerativeAI(key);
    // Use gemini-flash-latest (generic alias, supports generateContent)
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent financial parsing
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });
  }

  async parseFinancialMessage(input: FinancialParserInput): Promise<ParsedFinancialBatch> {
    return this.parseWithRetry(input, 0);
  }

  private async parseWithRetry(
    input: FinancialParserInput,
    attemptNumber: number
  ): Promise<ParsedFinancialBatch> {
    const systemPrompt = this.buildSystemPrompt(input);
    const userMessage = input.text;

    try {
      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: `User message: "${userMessage}"` },
      ]);

      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to extract JSON from Gemini response");
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);
      
      // Validate with Zod schema
      return financialBatchSchema.parse(parsed);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is503 = errorMessage.includes("503") || errorMessage.includes("Service Unavailable");
      const is429 = errorMessage.includes("429") || errorMessage.includes("Too Many Requests");
      const isTransient = is503 || is429;

      console.error(`[GeminiAIProvider] Attempt ${attemptNumber + 1} failed:`, errorMessage);

      // Retry logic for transient errors
      if (isTransient && attemptNumber < this.MAX_RETRIES) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attemptNumber);
        console.log(`[GeminiAIProvider] Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return this.parseWithRetry(input, attemptNumber + 1);
      }

      // All retries exhausted or non-retryable error
      let clarificationMessage = "Maaf, saya belum dapat memahami pesan Anda. Coba tulis seperti: 'Beli kopi 25 ribu' atau 'Gajian 5 juta'.";
      
      if (is503) {
        clarificationMessage = "? AI assistant sedang sibuk (high demand). Coba lagi dalam beberapa saat atau gunakan format: 'Beli kopi 25 ribu'.";
      } else if (is429) {
        clarificationMessage = "? Terlalu banyak request. Tunggu sebentar dan coba lagi.";
      }

      return {
        actions: [{
          intent: "UNKNOWN",
          reason: "AI_PARSE_ERROR",
          clarificationQuestion: clarificationMessage,
        }],
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildSystemPrompt(input: FinancialParserInput): string {
    const { currentDate, timezone, context } = input;
    
    return `You are a financial transaction parser for an Indonesian personal finance app called FinTrack.

**Your Task:** Parse user messages into structured financial intents.

**Current Context:**
- Date: ${currentDate} (${timezone})
- User's Accounts: ${context?.userAccounts?.join(", ") || "None"}
- User's Categories: ${context?.userCategories?.join(", ") || "None"}

**Supported Intents:**
1. **EXPENSE**: User spent money (e.g., "beli kopi 25rb", "bayar parkir 5000")
2. **INCOME**: User received money (e.g., "gajian 5jt", "dapat uang freelance 2 juta")
3. **TRANSFER**: Money moved between accounts (e.g., "transfer 500k dari BCA ke GoPay")
4. **BUDGET_ALLOCATION**: Set budget limit (e.g., "budget makan 1jt", "alokasi transport 500k")
5. **BALANCE_QUERY**: Check current balance (e.g., "saldo saya berapa", "cek uang")
6. **UNKNOWN**: Cannot understand (ask for clarification)

**Output Format (JSON):**
\`\`\`json
{
  "actions": [
    {
      "intent": "EXPENSE",
      "amount": 25000,
      "description": "Beli kopi",
      "categoryHint": "Makanan & Minuman",
      "accountHint": null,
      "transactionDate": "${currentDate}"
    }
  ]
}
\`\`\`

**Important Rules:**
1. **Amount Parsing:**
   - "25rb", "25ribu", "25k" ? 25000
   - "2.5jt", "2,5juta", "2.5m" ? 2500000
   - "500", "500000" ? exact number

2. **Category Matching:**
   - Match to user's existing categories when possible
   - Use Indonesian category names (Makanan & Minuman, Transportasi, etc.)
   - For budget/expense, use EXPENSE categories only

3. **Natural Language:**
   - Handle typos: "makn" ? "makan", "transpot" ? "transport"
   - Handle conversational: "tadi beli kopi 25k" ? EXPENSE
   - Handle shorthand: "makan 50k" ? EXPENSE for Makanan & Minuman

4. **Multi-action Support:**
   - "Gaji 5jt untuk makan 2jt transport 1jt" ? [INCOME, BUDGET_ALLOCATION, BUDGET_ALLOCATION]

5. **Balance Query:**
   - "saldo", "uang saya", "cek saldo" ? BALANCE_QUERY
   - "uang free", "free cash" ? BALANCE_QUERY (will show free cash)

6. **Unknown Handling:**
   - If unclear, return UNKNOWN with clarificationQuestion
   - Ask specific questions to help user

**Examples:**

Input: "beli kopi di cafe 25rb"
Output: \`\`\`json
{"actions": [{"intent": "EXPENSE", "amount": 25000, "description": "Beli kopi di cafe", "categoryHint": "Makanan & Minuman", "accountHint": null, "transactionDate": "${currentDate}"}]}
\`\`\`

Input: "budget nabung 500k"
Output: \`\`\`json
{"actions": [{"intent": "BUDGET_ALLOCATION", "amount": 500000, "categoryName": "nabung"}]}
\`\`\`

Input: "uang free saya berapa"
Output: \`\`\`json
{"actions": [{"intent": "BALANCE_QUERY", "accountHint": null}]}
\`\`\`

Now parse the user's message. Return ONLY valid JSON, no explanation.`;
  }
}



