import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  ParsedFinancialBatch,
  ParsedFinancialIntent,
  financialBatchSchema,
} from "./schemas";
import { FinancialParserInput, FinancialParserProvider } from "./provider";

/**
 * Gemini AI Provider for Natural Language Financial Parsing
 * 
 * Uses Google Gemini 2.0 Flash for intelligent intent detection
 * with support for:
 * - Natural, conversational language
 * - Typos and abbreviations
 * - Context-aware interpretation
 * - Multi-language support (Indonesian + English)
 */
export class GeminiAIProvider implements FinancialParserProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is required for GeminiAIProvider");
    }
    
    this.genAI = new GoogleGenerativeAI(key);
    // Use gemini-2.5-flash (available for this API key) for best performance/cost ratio
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent financial parsing
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });
  }

  async parseFinancialMessage(input: FinancialParserInput): Promise<ParsedFinancialBatch> {
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
    } catch (error: any) {
      console.error("[GeminiAIProvider] Parse error:", error.message);
      
      // Fallback to UNKNOWN intent
      return {
        actions: [{
          intent: "UNKNOWN",
          reason: "AI_PARSE_ERROR",
          clarificationQuestion: "Maaf, saya belum dapat memahami pesan Anda. Coba tulis seperti: 'Beli kopi 25 ribu' atau 'Gajian 5 juta'.",
        }],
      };
    }
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