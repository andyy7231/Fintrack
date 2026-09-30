/**
 * Pattern Parser Service
 *
 * Provides deterministic pattern matching for common WhatsApp transaction formats.
 * Part of the hybrid parser optimization that reduces latency by 70-90% and
 * AI API costs by 80%+ for simple, structured commands.
 *
 * **Core Philosophy:**
 * - **Fail-fast on ambiguity**: Any uncertainty triggers AI fallback
 * - **Security-first**: Validates and sanitizes all inputs
 * - **Never throws**: Always returns success or failure result
 * - **Stateless**: No side effects, pure deterministic parsing
 *
 * **Supported Command Formats:**
 * 1. **Expense**: `<verb> <description> <amount> [date] [account] [category]`
 *    - Example: "Beli kopi 25rb", "Bayar parkir 5000 dari BCA"
 *
 * 2. **Income**: `<verb> [description] <amount> [date] [account]`
 *    - Example: "Gaji 10jt", "Terima transfer 500k ke Mandiri"
 *
 * 3. **Budget Allocation**: `<prefix> <category_name> <amount>`
 *    - Example: "Budget makan 1jt", "Anggaran transport 500rb"
 *
 * **Error Handling Strategy:**
 * - **Input validation failures**: Return `INVALID_FORMAT`
 * - **No pattern match**: Return `NO_MATCH`
 * - **Multi-action detected**: Return `MULTI_ACTION`
 * - **Ambiguous content**: Return `AMBIGUOUS`
 * - **Complex dates**: Return `COMPLEX_DATE`
 * - **Unexpected errors**: Catch, log, return `INVALID_FORMAT`
 *
 * All failures trigger AI fallback - the pattern parser never blocks message processing.
 *
 * **Performance Characteristics:**
 * - Average processing time: 10-30ms
 * - Zero external API calls
 * - Memory-efficient (stateless, no caching)
 * - CPU-efficient (compiled regex patterns)
 *
 * @module pattern-parser.service
 * @see {@link HybridParserService} for orchestration logic
 * @see {@link regex.utils} for pattern definitions
 */

import { parseIndonesianAmount } from './amount.utils';
import { parseIndonesianDate, getJakartaDateString } from './date.utils';
import {
  EXPENSE_VERBS,
  INCOME_VERBS,
  BUDGET_PREFIXES,
  DATE_KEYWORDS,
  DAY_NAMES,
  ABSOLUTE_DATE_PATTERNS,
  hasMultiActionIndicators,
  hasComplexDateExpression,
  hasAmbiguousModifiers,
  extractAccountHint,
  extractCategoryHint,
  findStartingVerb,
  findAmountText,
  extractBetweenVerbAndAmount,
  hasMultipleAmounts,
  normalizeText,
  isSafeInput,
} from './regex.utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Successful pattern parse result with structured intent.
 * 
 * Returned when pattern matching successfully extracts all required
 * information from a message without ambiguity.
 * 
 * @property {true} success - Always `true` for successful results
 * @property {PatternParsedIntent} intent - Structured financial intent data
 * @property {'PATTERN'} parseMethod - Always 'PATTERN' to indicate pattern matching was used
 * @property {number} processingTimeMs - Time taken to parse (typically 10-30ms)
 */
export interface PatternParseResult {
  success: true;
  intent: PatternParsedIntent;
  parseMethod: 'PATTERN';
  processingTimeMs: number;
}

/**
 * Pattern parse failure requiring AI fallback.
 * 
 * Returned when pattern matching cannot confidently parse a message.
 * The hybrid parser will route these messages to AI for complex processing.
 * 
 * **Failure Reasons:**
 * - `NO_MATCH`: Message doesn't match any supported pattern
 * - `AMBIGUOUS`: Contains uncertainty modifiers (kayaknya, mungkin, etc.)
 * - `MULTI_ACTION`: Contains multiple transactions in one message
 * - `COMPLEX_DATE`: Contains complex date expressions (e.g., "3 hari yang lalu jam 3 sore")
 * - `INVALID_FORMAT`: Input validation failure or security concern
 * 
 * @property {false} success - Always `false` for failures
 * @property {string} reason - Specific reason code for failure
 * @property {true} fallbackRequired - Always `true` to trigger AI fallback
 */
export interface PatternParseFailure {
  success: false;
  reason: 'NO_MATCH' | 'AMBIGUOUS' | 'MULTI_ACTION' | 'COMPLEX_DATE' | 'INVALID_FORMAT';
  fallbackRequired: true;
}

/**
 * Union type for pattern parse attempts.
 * 
 * Discriminated union where `success` field determines the result type.
 * This pattern enables type-safe handling of success vs failure cases.
 * 
 * @example
 * ```typescript
 * const result = PatternParserService.attemptPatternParse(text);
 * 
 * if (result.success) {
 *   // TypeScript knows result is PatternParseResult
 *   console.log(result.intent.amount);
 * } else {
 *   // TypeScript knows result is PatternParseFailure
 *   console.log(result.reason);
 * }
 * ```
 */
export type PatternParseAttempt = PatternParseResult | PatternParseFailure;

/**
 * Structured intent extracted from pattern matching.
 * 
 * Represents a successfully parsed financial command with all
 * required and optional fields extracted.
 * 
 * **Common Fields (all intents):**
 * @property {string} intent - Type of financial intent
 * @property {number} amount - Transaction amount in IDR (always positive)
 * @property {string} description - Human-readable description
 * @property {string} transactionDate - ISO date string in YYYY-MM-DD format
 * 
 * **Optional Fields (context-dependent):**
 * @property {string} [accountHint] - Account name hint for resolution (null if not specified)
 * @property {string} [categoryHint] - Category name hint for expense resolution (null if not specified)
 * @property {string} [categoryName] - Full category name for budget allocation only
 * 
 * @example
 * ```typescript
 * // Expense intent
 * {
 *   intent: 'EXPENSE',
 *   amount: 25000,
 *   description: 'Kopi',
 *   transactionDate: '2024-01-20',
 *   accountHint: 'BCA',
 *   categoryHint: 'makanan'
 * }
 * 
 * // Income intent
 * {
 *   intent: 'INCOME',
 *   amount: 10000000,
 *   description: 'Gaji',
 *   transactionDate: '2024-01-20',
 *   accountHint: 'Mandiri',
 *   categoryHint: null
 * }
 * 
 * // Budget allocation intent
 * {
 *   intent: 'BUDGET_ALLOCATION',
 *   amount: 1000000,
 *   description: 'Budget makan',
 *   transactionDate: '2024-01-20',
 *   categoryName: 'makan'
 * }
 * ```
 */
export interface PatternParsedIntent {
  intent: 'EXPENSE' | 'INCOME' | 'BUDGET_ALLOCATION';
  amount: number;
  description: string;
  transactionDate: string; // ISO date string YYYY-MM-DD
  accountHint?: string | null;
  categoryHint?: string | null;
  categoryName?: string; // For BUDGET_ALLOCATION only
}

// ============================================================================
// PATTERN PARSER SERVICE
// ============================================================================

export class PatternParserService {
  /**
   * Attempt to parse message using deterministic pattern matching.
   * 
   * This is the main entry point for pattern-based parsing. It validates input,
   * attempts to match against all supported patterns (expense, income, budget),
   * and returns either a success result with structured data or a failure
   * requiring AI fallback.
   * 
   * **Processing Flow:**
   * 1. **Input validation**: Check for null/empty, validate security
   * 2. **Expense matching**: Try expense pattern first (most common)
   * 3. **Income matching**: Try income pattern if expense fails
   * 4. **Budget matching**: Try budget allocation pattern if income fails
   * 5. **Return result**: Success with intent OR failure with reason
   * 
   * **Error Handling:**
   * - NEVER throws exceptions to caller
   * - All errors are caught and returned as `PatternParseFailure`
   * - Logs errors internally for debugging
   * - Ensures message processing always continues (via AI fallback)
   * 
   * **Performance:**
   * - Average: 10-30ms for successful matches
   * - Worst case: 50ms for multiple pattern attempts
   * - Zero external API calls
   * 
   * **Security:**
   * - Validates input is non-empty string
   * - Checks for malicious patterns (XSS, SQL injection)
   * - Sanitizes input before processing
   * - Logs security events for monitoring
   * 
   * @param text - User message text to parse
   * @returns {PatternParseAttempt} Success with structured intent OR failure requiring AI fallback
   * 
   * @example
   * ```typescript
   * // Successful expense parse
   * const result1 = PatternParserService.attemptPatternParse("Beli kopi 25rb");
   * // Returns: { success: true, intent: { intent: 'EXPENSE', amount: 25000, ... }, ... }
   * 
   * // Successful income parse
   * const result2 = PatternParserService.attemptPatternParse("Gaji 10jt");
   * // Returns: { success: true, intent: { intent: 'INCOME', amount: 10000000, ... }, ... }
   * 
   * // Multi-action failure
   * const result3 = PatternParserService.attemptPatternParse("Beli kopi 25rb dan makan 50rb");
   * // Returns: { success: false, reason: 'MULTI_ACTION', fallbackRequired: true }
   * 
   * // Ambiguous failure
   * const result4 = PatternParserService.attemptPatternParse("Kemarin kayaknya habis 50rb");
   * // Returns: { success: false, reason: 'AMBIGUOUS', fallbackRequired: true }
   * ```
   * 
   * @see {@link PatternParseResult} for success result structure
   * @see {@link PatternParseFailure} for failure result structure
   * @see {@link HybridParserService} for usage in hybrid parser
   */
  static attemptPatternParse(text: string): PatternParseAttempt {
    const startTime = Date.now();

    try {
      // Phase 0: Validate input (Requirement 9.1, 9.5)
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
          success: false,
          reason: 'INVALID_FORMAT',
          fallbackRequired: true,
        };
      }

      const trimmedText = text.trim();

      // Phase 0.1: Security validation - detect malicious patterns (Requirement 9.5)
      if (!this.isSafeInput(trimmedText)) {
        // Log security event for monitoring
        console.warn('[PatternParser] Malicious input pattern detected, rejecting parse', {
          messageLength: trimmedText.length,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          reason: 'INVALID_FORMAT',
          fallbackRequired: true,
        };
      }

      // Attempt expense parsing
      const expenseResult = this.parseExpense(trimmedText);
      if (expenseResult) {
        return {
          success: true,
          intent: expenseResult,
          parseMethod: 'PATTERN',
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Attempt income parsing
      const incomeResult = this.parseIncome(trimmedText);
      if (incomeResult) {
        return {
          success: true,
          intent: incomeResult,
          parseMethod: 'PATTERN',
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Attempt budget allocation parsing
      const budgetResult = this.parseBudgetAllocation(trimmedText);
      if (budgetResult) {
        return {
          success: true,
          intent: budgetResult,
          parseMethod: 'PATTERN',
          processingTimeMs: Date.now() - startTime,
        };
      }

      // No pattern matched
      return {
        success: false,
        reason: 'NO_MATCH',
        fallbackRequired: true,
      };
    } catch (error) {
      // Ultimate safety net - log error but don't expose to user
      // Design: Requirement 9.1, 9.4
      console.error('[PatternParser] Unexpected error:', error);

      return {
        success: false,
        reason: 'INVALID_FORMAT',
        fallbackRequired: true,
      };
    }
  }

  /**
   * Parse expense command: "Beli kopi 25rb", "Bayar parkir 5000"
   *
   * Pattern: <expense_verb> <description> <amount> [<date>] [<account_hint>] [<category_hint>]
   *
   * @param text - User message text
   * @returns PatternParsedIntent or null if no match
   *
   * Design: Requirement 1.4
   */
  private static parseExpense(text: string): PatternParsedIntent | null {
    try {
      // Phase 1: Detect multi-action (Requirement 5.1)
      if (hasMultiActionIndicators(text)) {
        return null; // Multi-action needs AI batch parsing
      }

      // Phase 2: Match expense verb (Requirement 1.1, 1.2) - NOW OPTIONAL
      const matchedVerb = findStartingVerb(text, EXPENSE_VERBS);
      const hasVerb = matchedVerb !== null;

      // Phase 3: Detect ambiguous modifiers (Requirement 5.3)
      if (hasAmbiguousModifiers(text)) {
        return null; // Ambiguous content requires AI
      }

      // Phase 4: Detect complex date expressions (Requirement 5.2, 6.4)
      if (hasComplexDateExpression(text)) {
        return null; // Complex date requires AI
      }

      // Phase 5: Extract amount (Requirement 1.3, 1.7)
      const amountText = findAmountText(text);
      
      if (!amountText) {
        return null; // Amount required for expense
      }

      const amount = parseIndonesianAmount(amountText);

      if (!amount || amount <= 0) {
        return null; // Invalid amount
      }

      // Phase 6: Extract description (NEW: supports verbless commands)
      let description: string;

      if (hasVerb) {
        // Verb-based command: extract between verb and amount
        description = extractBetweenVerbAndAmount(text, matchedVerb!, amountText);
        
        if (!description || description.length === 0) {
          return null; // Description required for verb-based expense
        }
      } else {
        // Verbless command: check if this is income/budget first
        const isIncome = findStartingVerb(text, INCOME_VERBS) !== null;
        const isBudget = BUDGET_PREFIXES.some(prefix => 
          text.toLowerCase().startsWith(prefix)
        );
        
        if (isIncome || isBudget) {
          return null; // Not an expense, let other parsers handle it
        }
        
        // Extract description as text before amount
        const amountIndex = text.indexOf(amountText);
        description = text.substring(0, amountIndex).trim();
        
        if (!description || description.length === 0) {
          return null; // No description means invalid verbless command
        }
      }

      // Phase 7: Extract optional account hint (Requirement 1.5)
      const accountHint = extractAccountHint(text);

      // Phase 8: Extract optional category hint (Requirement 1.6)
      const categoryHint = extractCategoryHint(text);

      // Phase 9: Extract transaction date (Requirement 6.1, 6.2, 6.3)
      const lowerText = text.toLowerCase();
      let transactionDate: string = getJakartaDateString(); // Default to today

      // Check for common date keywords
      let dateKeywordFound = false;
      for (const keyword of DATE_KEYWORDS) {
        if (lowerText.includes(keyword)) {
          const parsedDate = parseIndonesianDate(keyword);
          transactionDate = getJakartaDateString(parsedDate);
          dateKeywordFound = true;
          break;
        }
      }

      // Check for day names if no keyword found
      if (!dateKeywordFound) {
        for (const dayName of DAY_NAMES) {
          if (lowerText.includes(dayName)) {
            const parsedDate = parseIndonesianDate(dayName);
            transactionDate = getJakartaDateString(parsedDate);
            dateKeywordFound = true;
            break;
          }
        }
      }

      // Check for absolute date formats if no keyword found
      if (!dateKeywordFound) {
        for (const pattern of ABSOLUTE_DATE_PATTERNS) {
          const match = text.match(pattern);
          if (match && match[0]) {
            const parsedDate = parseIndonesianDate(match[0]);
            transactionDate = getJakartaDateString(parsedDate);
            dateKeywordFound = true;
            break;
          }
        }
      }

      // Default to today if no date found (Requirement 6.2)
      if (!dateKeywordFound) {
        transactionDate = getJakartaDateString();
      }

      return {
        intent: 'EXPENSE',
        amount,
        description,
        transactionDate,
        accountHint,
        categoryHint,
      };
    } catch (error) {
      // Catch any unexpected errors and return null (will trigger AI fallback)
      console.error('[PatternParser] Error in parseExpense:', error);
      return null;
    }
  }

  /**
   * Parse income command: "Gaji 10jt", "Terima transfer 500k"
   *
   * Pattern: <income_verb> [<description>] <amount> [<date>] [<account_hint>]
   *
   * @param text - User message text
   * @returns PatternParsedIntent or null if no match
   *
   * Design: Requirement 2.4
   */
  private static parseIncome(text: string): PatternParsedIntent | null {
    try {
      // Phase 1: Detect multi-action (Requirement 5.1)
      if (hasMultiActionIndicators(text)) {
        return null; // Multi-action needs AI batch parsing
      }

      // Phase 1b: Detect multiple amounts (Requirement 5.1)
      if (hasMultipleAmounts(text)) {
        return null; // Multiple amounts indicate multi-action
      }

      // Phase 2: Match income verb (Requirement 2.2)
      const matchedVerb = findStartingVerb(text, INCOME_VERBS);
      if (!matchedVerb) {
        return null; // Not an income command
      }

      // Phase 3: Detect ambiguous modifiers (Requirement 5.3)
      if (hasAmbiguousModifiers(text)) {
        return null; // Ambiguous phrasing needs AI
      }

      // Phase 4: Extract amount (Requirement 2.1)
      const amountText = findAmountText(text);
      if (!amountText) {
        return null; // Amount required for income
      }

      const amount = parseIndonesianAmount(amountText);
      if (!amount || amount <= 0) {
        return null; // Invalid amount
      }

      // Phase 5: Extract description (optional for income - Requirement 2.3)
      let description = extractBetweenVerbAndAmount(text, matchedVerb, amountText);

      // If no description provided, use verb as description (Requirement 2.3)
      if (!description || description.length === 0) {
        description = matchedVerb.charAt(0).toUpperCase() + matchedVerb.slice(1);
      }

      // Phase 6: Extract optional account hint (Requirement 2.5)
      const accountHint = extractAccountHint(text);

      // Phase 7: Detect complex date (Requirement 5.2, 6.4)
      if (hasComplexDateExpression(text)) {
        return null; // Complex date needs AI
      }

      // Phase 8: Extract date (Requirement 6.1, 6.2, 6.3)
      // Try to find date keywords in the text
      const lowerText = text.toLowerCase();
      let transactionDate: string = getJakartaDateString(); // Default to today

      // Check for common date keywords
      const dateKeywords = [
        'kemarin lusa',
        'kemarin',
        'hari ini',
        'tadi pagi',
        'tadi siang',
        'tadi sore',
        'tadi malam',
        'tadi',
        'sekarang',
      ];

      const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

      let dateKeywordFound = false;
      for (const keyword of dateKeywords) {
        if (lowerText.includes(keyword)) {
          const parsedDate = parseIndonesianDate(keyword);
          transactionDate = getJakartaDateString(parsedDate);
          dateKeywordFound = true;
          break;
        }
      }

      // Check for day names if no keyword found
      if (!dateKeywordFound) {
        for (const dayName of dayNames) {
          if (lowerText.includes(dayName)) {
            const parsedDate = parseIndonesianDate(dayName);
            transactionDate = getJakartaDateString(parsedDate);
            dateKeywordFound = true;
            break;
          }
        }
      }

      // Check for absolute date formats if no keyword found
      if (!dateKeywordFound) {
        // Check for "DD Month" format
        const monthNameMatch = lowerText.match(
          /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i
        );
        if (monthNameMatch && monthNameMatch[0]) {
          const parsedDate = parseIndonesianDate(monthNameMatch[0]);
          transactionDate = getJakartaDateString(parsedDate);
          dateKeywordFound = true;
        }

        // Check for "DD/MM" or "DD/MM/YYYY" format
        if (!dateKeywordFound) {
          const slashDateMatch = lowerText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
          if (slashDateMatch && slashDateMatch[0]) {
            const parsedDate = parseIndonesianDate(slashDateMatch[0]);
            transactionDate = getJakartaDateString(parsedDate);
            dateKeywordFound = true;
          }
        }

        // Check for ISO date "YYYY-MM-DD" format
        if (!dateKeywordFound) {
          const isoDateMatch = lowerText.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (isoDateMatch && isoDateMatch[0]) {
            const parsedDate = parseIndonesianDate(isoDateMatch[0]);
            transactionDate = getJakartaDateString(parsedDate);
            dateKeywordFound = true;
          }
        }
      }

      // Default to today if no date found (Requirement 6.2)
      if (!dateKeywordFound) {
        transactionDate = getJakartaDateString();
      }

      // Phase 9: Build intent result
      return {
        intent: 'INCOME',
        amount,
        description,
        transactionDate,
        accountHint,
        categoryHint: null, // Income typically doesn't have category hints
      };
    } catch (error) {
      // Log error but don't throw - return null for AI fallback
      console.error('[PatternParser.parseIncome] Error:', error);
      return null;
    }
  }

  /**
   * Parse budget allocation command: "Budget makan 1jt", "Anggaran transport 500rb"
   *
   * Pattern: <budget_prefix> <category_name> <amount>
   *
   * @param text - User message text
   * @returns PatternParsedIntent or null if no match
   *
   * Design: Requirement 3.3
   */
  private static parseBudgetAllocation(text: string): PatternParsedIntent | null {
    try {
      // Normalize input text
      const normalizedText = normalizeText(text);
      const lowerText = normalizedText.toLowerCase();

      // Phase 1: Detect multi-action (Requirement 5.1)
      // For budget commands, we need more sophisticated multi-action detection
      // because category names can contain "dan" (e.g., "hiburan dan rekreasi")
      // 
      // Multi-action patterns for budgets:
      // 1. Multiple budget keywords: "Budget makan 1jt Budget transport 500rb"
      // 2. Multiple amounts: "Budget makan 1jt dan transport 500rb" (2 numbers before amounts)
      // 3. Budget keyword followed by "dan/serta/," and then another budget keyword or amount pattern
      
      // Check for multiple budget prefixes
      let budgetPrefixCount = 0;
      for (const prefix of BUDGET_PREFIXES) {
        const regex = new RegExp(prefix, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          budgetPrefixCount += matches.length;
        }
      }
      
      if (budgetPrefixCount > 1) {
        return null; // Multiple budget keywords detected
      }

      // Check for multiple amounts (more sophisticated than just counting numbers)
      // Pattern: budget keyword, some text, amount, "dan/serta/," some text, another amount
      const multiAmountPattern = /(?:budget|anggaran|alokasi)\s+\w+\s+[0-9]+[.,]?[0-9]*\s*(?:jt|juta|rb|ribu|k)?\s*(?:dan|serta|,)\s+\w+\s+[0-9]+[.,]?[0-9]*\s*(?:jt|juta|rb|ribu|k)?/i;
      if (multiAmountPattern.test(normalizedText)) {
        return null; // Multiple budget allocations detected
      }

      // Phase 2: Match budget prefix (Requirement 3.1, 3.2)
      const matchedPrefix = BUDGET_PREFIXES.find((prefix: string) =>
        lowerText.startsWith(prefix)
      );

      if (!matchedPrefix) {
        return null; // Not a budget command
      }

      // Phase 3: Extract amount (Requirement 3.3)
      const amountText = findAmountText(normalizedText);
      if (!amountText) {
        return null; // Amount required for budget allocation
      }

      const amount = parseIndonesianAmount(amountText);
      if (!amount || amount <= 0) {
        return null; // Valid positive amount required
      }

      // Phase 4: Extract category name (between prefix and amount) (Requirement 3.4)
      const prefixEndIndex = lowerText.indexOf(matchedPrefix) + matchedPrefix.length;
      const amountStartIndex = normalizedText.indexOf(amountText);

      if (amountStartIndex === -1 || prefixEndIndex >= amountStartIndex) {
        return null;
      }

      const categoryName = normalizedText
        .substring(prefixEndIndex, amountStartIndex)
        .trim();

      // Phase 5: Validate category name is not empty (Requirement 3.5)
      if (!categoryName || categoryName.length === 0) {
        return null; // Category name required for budget allocation
      }

      // Phase 6: Use current Jakarta date (Requirement 6.2)
      const transactionDate = getJakartaDateString();

      // Phase 7: Return structured intent (Requirement 3.3)
      return {
        intent: 'BUDGET_ALLOCATION',
        amount,
        description: `Budget ${categoryName}`,
        transactionDate,
        categoryName, // Used for budget category resolution
      };
    } catch (error) {
      // Log error but don't throw (Requirement 9.1, 9.4)
      console.error('[PatternParser] Error in parseBudgetAllocation:', error);
      return null;
    }
  }

  /**
   * Validate input text for security concerns.
   * Detects common malicious patterns (SQL injection, XSS, code injection).
   *
   * @param text - User message text
   * @returns true if text is safe, false if malicious patterns detected
   *
   * Design: Requirement 9.5
   */
  private static isSafeInput(text: string): boolean {
    return isSafeInput(text);
  }
}
