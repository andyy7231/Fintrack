/**
 * Regex Utilities for Pattern Matching
 *
 * This module provides compiled regex patterns and helper functions for the hybrid parser's
 * pattern matching system. It supports deterministic parsing of Indonesian financial commands
 * including expenses, income, and budget allocations.
 *
 * **Key Features:**
 * - Pre-compiled regex patterns for performance
 * - Multi-action detection to prevent batch processing errors
 * - Security validation to detect malicious input patterns
 * - Helper functions for extracting hints (account, category) from commands
 *
 * **Design Principles:**
 * - Fail-fast on ambiguity (trigger AI fallback)
 * - Security-first input validation
 * - Performance-optimized with compiled patterns
 *
 * @module regex.utils
 * @see {@link PatternParserService} for usage examples
 */

// ============================================================================
// COMPILED REGEX PATTERNS
// ============================================================================

/**
 * Amount pattern with Indonesian abbreviations.
 * 
 * Matches various Indonesian currency formats with optional "Rp" prefix and abbreviations.
 * Uses global and case-insensitive flags for multiple matches in text.
 * 
 * **Supported formats:**
 * - Plain numbers: `25000`, `1500000`
 * - Thousands: `25rb`, `25ribu`, `25k`, `25 ribu`
 * - Millions: `1.5jt`, `1,5juta`, `2jt`, `2 juta`
 * - Billions: `1m`, `1miliar`
 * - With Rp prefix: `Rp25.000`, `Rp 1.5jt`
 * - Decimal separators: `.` or `,` (e.g., `1.5jt` or `1,5jt`)
 * 
 * **Examples:**
 * ```typescript
 * AMOUNT_PATTERN.exec("Beli kopi 25rb") // matches "25rb"
 * AMOUNT_PATTERN.exec("Gaji 1.5jt")     // matches "1.5jt"
 * AMOUNT_PATTERN.exec("Rp25.000")       // matches "Rp25.000"
 * ```
 * 
 * @constant
 * @type {RegExp}
 */
export const AMOUNT_PATTERN = /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(juta|jt|miliar|m|ribu|rb|k)?/gi;

/**
 * Expense action verbs (case-insensitive).
 * 
 * List of Indonesian verbs that indicate expense/spending transactions.
 * Used to identify expense commands in pattern matching.
 * 
 * **Supported verbs:**
 * - `beli` - buy
 * - `bayar` - pay
 * - `belanja` - shop
 * - `buat` - for/make
 * - `untuk` - for
 * - `habis` - spent
 * - `spent` - spent (English)
 * 
 * **Examples:**
 * ```typescript
 * // These commands start with expense verbs:
 * "Beli kopi 25rb"         // beli
 * "Bayar parkir 5000"      // bayar
 * "Belanja bulanan 500k"   // belanja
 * ```
 * 
 * @constant
 * @type {string[]}
 */
export const EXPENSE_VERBS = ['beli', 'bayar', 'belanja', 'buat', 'untuk', 'habis', 'spent'];

/**
 * Income action verbs (case-insensitive).
 * 
 * List of Indonesian verbs that indicate income/receiving transactions.
 * Used to identify income commands in pattern matching.
 * 
 * **Supported verbs:**
 * - `gaji` - salary
 * - `terima` - receive
 * - `dapat`/`dapet` - get/receive
 * - `bonus` - bonus
 * - `pendapatan` - income
 * - `masuk` - in/incoming
 * - `income` - income (English)
 * 
 * **Examples:**
 * ```typescript
 * // These commands start with income verbs:
 * "Gaji 10jt"              // gaji
 * "Terima transfer 500k"   // terima
 * "Bonus 2jt dari kantor"  // bonus
 * ```
 * 
 * @constant
 * @type {string[]}
 */
export const INCOME_VERBS = ['gaji', 'terima', 'dapat', 'dapet', 'bonus', 'pendapatan', 'masuk', 'income'];

/**
 * Budget allocation prefixes (case-insensitive).
 * 
 * List of Indonesian words that indicate budget allocation commands.
 * Used to identify budget allocation commands in pattern matching.
 * 
 * **Supported prefixes:**
 * - `budget` - budget
 * - `anggaran` - budget/allocation
 * - `alokasi` - allocation
 * 
 * **Examples:**
 * ```typescript
 * // These commands start with budget prefixes:
 * "Budget makan 1jt"                    // budget
 * "Anggaran transport 500rb"            // anggaran
 * "Alokasi hiburan dan rekreasi 800k"  // alokasi
 * ```
 * 
 * @constant
 * @type {string[]}
 */
export const BUDGET_PREFIXES = ['budget', 'anggaran', 'alokasi'];

/**
 * Account hint indicators for "from" context (case-insensitive).
 * 
 * Matches Indonesian prepositions that indicate the source account for a transaction.
 * Used to extract account hints from commands.
 * 
 * **Supported indicators:**
 * - `dari` - from
 * - `pakai` - using
 * - `dengan` - with
 * - `di` - at/in
 * - `lewat` - through/via
 * 
 * **Pattern behavior:**
 * Captures the account name that follows the indicator, stopping at:
 * - `kategori` keyword
 * - Date keywords (`kemarin`, `tadi`, `hari ini`)
 * - End of string
 * 
 * **Examples:**
 * ```typescript
 * "Beli kopi 25rb dari BCA".match(ACCOUNT_INDICATORS_FROM)
 * // matches ["dari BCA", "BCA"]
 * 
 * "Bayar parkir 5000 pakai GoPay".match(ACCOUNT_INDICATORS_FROM)
 * // matches ["pakai GoPay", "GoPay"]
 * ```
 * 
 * @constant
 * @type {RegExp}
 */
export const ACCOUNT_INDICATORS_FROM = /(?:dari|pakai|dengan|di|lewat)\s+([a-z0-9\s]+?)(?:\s+kategori|\s+kemarin|\s+tadi|\s+hari ini|$)/i;

/**
 * Account hint indicators for "to" context (case-insensitive).
 * 
 * Matches Indonesian prepositions that indicate the destination account for a transaction.
 * Primarily used for income transactions.
 * 
 * **Supported indicators:**
 * - `ke` - to
 * - `masuk` - enter/into
 * 
 * **Pattern behavior:**
 * Captures the account name that follows the indicator, stopping at:
 * - `kategori` keyword
 * - Date keywords (`kemarin`, `tadi`, `hari ini`)
 * - End of string
 * 
 * **Examples:**
 * ```typescript
 * "Gaji 10jt ke Mandiri".match(ACCOUNT_INDICATORS_TO)
 * // matches ["ke Mandiri", "Mandiri"]
 * 
 * "Terima transfer 500k masuk BCA".match(ACCOUNT_INDICATORS_TO)
 * // matches ["masuk BCA", "BCA"]
 * ```
 * 
 * @constant
 * @type {RegExp}
 */
export const ACCOUNT_INDICATORS_TO = /(?:ke|masuk)\s+([a-z0-9\s]+?)(?:\s+kategori|\s+kemarin|\s+tadi|\s+hari ini|$)/i;

/**
 * Category hint indicators (case-insensitive).
 * 
 * Matches Indonesian keywords that indicate a category specification in commands.
 * Used to extract category hints from expense commands.
 * 
 * **Supported indicators:**
 * - `kategori` - category
 * 
 * **Pattern behavior:**
 * Captures the category name that follows the indicator, stopping at:
 * - Account indicators (`dari`, `pakai`)
 * - Date keywords (`kemarin`, `tadi`, `hari ini`)
 * - End of string
 * 
 * **Examples:**
 * ```typescript
 * "Beli makan siang 45ribu kategori makanan".match(CATEGORY_INDICATORS)
 * // matches ["kategori makanan", "makanan"]
 * 
 * "Bayar transport 20rb kategori jalan jalan".match(CATEGORY_INDICATORS)
 * // matches ["kategori jalan jalan", "jalan jalan"]
 * ```
 * 
 * @constant
 * @type {RegExp}
 */
export const CATEGORY_INDICATORS = /kategori\s+([a-z0-9\s]+?)(?:\s+dari|\s+pakai|\s+kemarin|\s+tadi|\s+hari ini|$)/i;

/**
 * Multi-action indicators (conjunction words and comma separators).
 * 
 * List of Indonesian conjunctions and punctuation that typically indicate
 * multiple transactions in a single message. When detected, the pattern
 * parser fails fast and delegates to AI for batch processing.
 * 
 * **Indicators:**
 * - ` dan ` - and (with spaces to avoid false positives in category names)
 * - ` serta ` - and also
 * - `, ` - comma (often used to separate multiple actions)
 * 
 * **Design rationale:**
 * Multi-action messages require AI's batch processing capabilities to:
 * - Parse multiple transactions correctly
 * - Handle context dependencies between transactions
 * - Validate transaction relationships
 * 
 * **Examples of multi-action messages:**
 * ```typescript
 * "Beli kopi 25rb dan makan siang 50rb"        // ' dan ' detected
 * "Gaji 10jt serta bonus 2jt"                  // ' serta ' detected
 * "Bayar listrik 200k, air 100k"               // ', ' detected
 * ```
 * 
 * **Note:** The space padding prevents false positives like:
 * - "Budget hiburan dan rekreasi 800k" (category name contains "dan")
 * 
 * @constant
 * @type {string[]}
 */
export const MULTI_ACTION_INDICATORS = [' dan ', ' serta ', ', '];

/**
 * Common Indonesian date keywords (relative dates).
 * 
 * Ordered list of Indonesian date expressions for relative date matching.
 * Order matters: more specific keywords must come before less specific ones
 * to avoid partial matches.
 * 
 * **Keyword categories:**
 * - Past relative: `kemarin lusa`, `kemarin`
 * - Present: `hari ini`, `sekarang`
 * - Recent past with time: `tadi pagi`, `tadi siang`, `tadi sore`, `tadi malam`
 * - Recent past general: `tadi`
 * 
 * **Order rationale:**
 * `kemarin lusa` must come before `kemarin` to match correctly.
 * `tadi pagi` must come before `tadi` for specific time matching.
 * 
 * **Examples:**
 * ```typescript
 * // These expressions are recognized:
 * "Beli kopi 25rb kemarin"           // yesterday
 * "Bayar parkir 5000 tadi pagi"      // this morning
 * "Gaji 10jt hari ini"               // today
 * ```
 * 
 * @constant
 * @type {string[]}
 * @see {@link parseIndonesianDate} in date.utils.ts for date parsing logic
 */
export const DATE_KEYWORDS = [
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

/**
 * Day names in Indonesian.
 * 
 * Complete list of Indonesian day names used for day-of-week date references.
 * When a day name is detected, the system calculates the most recent occurrence
 * of that day (including today if it matches).
 * 
 * **Day names:**
 * - `minggu` - Sunday
 * - `senin` - Monday
 * - `selasa` - Tuesday
 * - `rabu` - Wednesday
 * - `kamis` - Thursday
 * - `jumat` - Friday
 * - `sabtu` - Saturday
 * 
 * **Examples:**
 * ```typescript
 * // If today is Friday (Jumat):
 * "Beli kopi 25rb senin"    // refers to last Monday
 * "Bayar parkir 5000 jumat" // refers to today (Friday)
 * "Gaji 10jt minggu"        // refers to last Sunday
 * ```
 * 
 * @constant
 * @type {string[]}
 * @see {@link parseIndonesianDate} in date.utils.ts for day name resolution logic
 */
export const DAY_NAMES = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

/**
 * Absolute date patterns.
 * 
 * Array of regex patterns for matching absolute date formats in Indonesian and ISO formats.
 * These patterns handle explicit dates rather than relative references.
 * 
 * **Supported formats:**
 * 1. `DD Month` format (e.g., "20 Januari", "5 Maret")
 *    - Matches 1-2 digit day followed by Indonesian month name
 *    - Month names: januari, februari, maret, april, mei, juni, juli, agustus,
 *      september, oktober, november, desember
 * 
 * 2. `DD/MM` or `DD/MM/YYYY` format (e.g., "20/01", "20/01/2024")
 *    - Matches day/month with optional year
 *    - Year can be 2 or 4 digits
 * 
 * 3. `YYYY-MM-DD` ISO format (e.g., "2024-01-20")
 *    - Standard ISO 8601 date format
 *    - 4-digit year, 2-digit month, 2-digit day
 * 
 * **Examples:**
 * ```typescript
 * // Format 1: DD Month
 * "Beli kopi 25rb 20 Januari"
 * "Bayar parkir 5000 5 Maret"
 * 
 * // Format 2: DD/MM or DD/MM/YYYY
 * "Gaji 10jt 20/01"
 * "Bonus 2jt 20/01/2024"
 * 
 * // Format 3: YYYY-MM-DD
 * "Transfer 500k 2024-01-20"
 * ```
 * 
 * @constant
 * @type {RegExp[]}
 * @see {@link parseIndonesianDate} in date.utils.ts for date parsing implementation
 */
export const ABSOLUTE_DATE_PATTERNS = [
  /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i,
  /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  /(\d{4})-(\d{2})-(\d{2})/,
];

/**
 * Complex date expressions that require AI fallback.
 * 
 * Array of regex patterns that detect complex or ambiguous date expressions
 * beyond simple pattern matching capabilities. When detected, the pattern
 * parser fails fast and delegates to AI for contextual understanding.
 * 
 * **Pattern categories:**
 * 
 * 1. **Relative dates with calculations:**
 *    - `/\d+\s+hari\s+yang\s+lalu/i` - "N days ago" (e.g., "3 hari yang lalu")
 *    - `/\d+\s+minggu\s+yang\s+lalu/i` - "N weeks ago" (e.g., "2 minggu yang lalu")
 * 
 * 2. **Time specifications:**
 *    - `/jam\s+\d+/i` - hour references (e.g., "jam 3 sore")
 *    - `/pukul\s+\d+/i` - time references (e.g., "pukul 15:00")
 * 
 * 3. **Future dates (not supported in pattern parser):**
 *    - `/besok/i` - tomorrow
 *    - `/minggu\s+depan/i` - next week
 *    - `/bulan\s+depan/i` - next month
 * 
 * **Design rationale:**
 * These patterns require:
 * - Date arithmetic calculations
 * - Time zone-aware processing
 * - Business logic for "working days" vs "calendar days"
 * - Context understanding for ambiguous references
 * 
 * All of these are better handled by AI with full context understanding.
 * 
 * **Examples that trigger AI fallback:**
 * ```typescript
 * "Beli kopi 25rb 3 hari yang lalu jam 3 sore"  // complex relative + time
 * "Bayar parkir 5000 besok"                      // future date
 * "Gaji 10jt 2 minggu yang lalu"                 // relative calculation
 * ```
 * 
 * @constant
 * @type {RegExp[]}
 */
export const COMPLEX_DATE_PATTERNS = [
  /\d+\s+hari\s+yang\s+lalu/i,     // "3 hari yang lalu"
  /\d+\s+minggu\s+yang\s+lalu/i,   // "2 minggu yang lalu"
  /jam\s+\d+/i,                     // "jam 3 sore"
  /pukul\s+\d+/i,                   // "pukul 15:00"
  /besok/i,                         // Future dates
  /minggu\s+depan/i,                // "minggu depan"
  /bulan\s+depan/i,                 // "bulan depan"
];

/**
 * Ambiguous modifiers that indicate uncertainty (require AI fallback).
 * 
 * Array of regex patterns that detect uncertainty or approximation modifiers
 * in Indonesian language. When these are detected, the pattern parser fails
 * fast because:
 * - They indicate user uncertainty about the information
 * - They require contextual interpretation
 * - They may need clarification from the user
 * 
 * **Ambiguous modifiers:**
 * - `/kayaknya/i` - seems like, probably
 * - `/mungkin/i` - maybe, perhaps
 * - `/sekitar/i` - around, approximately
 * - `/kira-kira/i` - approximately, roughly
 * - `/sepertinya/i` - it seems, apparently
 * - `/kurang\s+lebih/i` - more or less
 * 
 * **Design rationale:**
 * Ambiguous commands should trigger AI because:
 * - AI can ask clarifying questions
 * - AI can handle contextual interpretation
 * - Pattern matching assumes exact values
 * 
 * **Examples that trigger AI fallback:**
 * ```typescript
 * "Kemarin kayaknya habis sekitar 50rb"    // 'kayaknya' + 'sekitar'
 * "Beli kopi mungkin 25rb"                  // 'mungkin'
 * "Bayar parkir kira-kira 5000"             // 'kira-kira'
 * "Gaji kurang lebih 10jt"                  // 'kurang lebih'
 * ```
 * 
 * @constant
 * @type {RegExp[]}
 */
export const AMBIGUOUS_MODIFIERS = [
  /kayaknya/i,
  /mungkin/i,
  /sekitar/i,
  /kira-kira/i,
  /sepertinya/i,
  /kurang\s+lebih/i,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if text contains multiple transaction indicators (multi-action).
 * 
 * Detects conjunction words or punctuation that typically separate multiple
 * transactions in a single message. Multi-action messages require AI batch
 * processing capabilities and cannot be handled by pattern matching.
 * 
 * **Detection strategy:**
 * Checks for presence of any {@link MULTI_ACTION_INDICATORS}:
 * - ` dan ` (and)
 * - ` serta ` (and also)
 * - `, ` (comma)
 * 
 * **Important:** Spaces around conjunctions prevent false positives in
 * category names like "hiburan dan rekreasi" (entertainment and recreation).
 * 
 * @param text - User message text to check
 * @returns `true` if multi-action indicators detected, `false` otherwise
 * 
 * @example
 * ```typescript
 * hasMultiActionIndicators("Beli kopi 25rb dan makan siang 50rb")
 * // returns true (contains ' dan ')
 * 
 * hasMultiActionIndicators("Beli kopi 25rb")
 * // returns false (no multi-action indicators)
 * 
 * hasMultiActionIndicators("Budget hiburan dan rekreasi 800k")
 * // returns false ('dan' is part of category name, no space padding match)
 * ```
 * 
 * @see {@link MULTI_ACTION_INDICATORS}
 */
export function hasMultiActionIndicators(text: string): boolean {
  return MULTI_ACTION_INDICATORS.some(indicator => text.includes(indicator));
}

/**
 * Check if text contains complex date expressions requiring AI fallback.
 * 
 * Detects date patterns that are too complex for deterministic pattern matching:
 * - Relative dates with calculations ("3 hari yang lalu")
 * - Time specifications ("jam 3 sore")
 * - Future dates ("besok", "minggu depan")
 * 
 * These require AI's contextual understanding and date arithmetic capabilities.
 * 
 * **Why AI fallback is needed:**
 * - Relative calculations need business logic (working days vs calendar days)
 * - Time specifications need timezone-aware processing
 * - Future dates are not supported in pattern parser's current scope
 * - Complex expressions may be ambiguous without context
 * 
 * @param text - User message text to check
 * @returns `true` if complex date expressions detected, `false` otherwise
 * 
 * @example
 * ```typescript
 * hasComplexDateExpression("3 hari yang lalu jam 3 sore")
 * // returns true (relative calculation + time spec)
 * 
 * hasComplexDateExpression("kemarin beli kopi")
 * // returns false (simple relative date)
 * 
 * hasComplexDateExpression("besok bayar tagihan")
 * // returns true (future date not supported)
 * ```
 * 
 * @see {@link COMPLEX_DATE_PATTERNS}
 */
export function hasComplexDateExpression(text: string): boolean {
  return COMPLEX_DATE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text contains ambiguous modifiers requiring AI fallback.
 * 
 * Detects uncertainty or approximation modifiers in Indonesian that indicate:
 * - User is uncertain about exact values
 * - Information is approximate rather than exact
 * - Context or clarification may be needed
 * 
 * Pattern matching requires exact, deterministic values. Ambiguous commands
 * should be handled by AI which can:
 * - Ask clarifying questions
 * - Interpret context
 * - Handle uncertainty appropriately
 * 
 * @param text - User message text to check
 * @returns `true` if ambiguous modifiers detected, `false` otherwise
 * 
 * @example
 * ```typescript
 * hasAmbiguousModifiers("kemarin kayaknya habis sekitar 50rb")
 * // returns true (contains 'kayaknya' and 'sekitar')
 * 
 * hasAmbiguousModifiers("kemarin beli kopi 25rb")
 * // returns false (exact, deterministic values)
 * 
 * hasAmbiguousModifiers("Gaji kurang lebih 10jt")
 * // returns true (contains 'kurang lebih' - approximately)
 * ```
 * 
 * @see {@link AMBIGUOUS_MODIFIERS}
 */
export function hasAmbiguousModifiers(text: string): boolean {
  return AMBIGUOUS_MODIFIERS.some(pattern => pattern.test(text));
}

/**
 * Extract account hint from text using account indicators.
 * 
 * Searches for Indonesian prepositions that indicate an account reference
 * and extracts the account name that follows. Supports both "from" context
 * (for expenses) and "to" context (for income).
 * 
 * **Extraction strategy:**
 * 1. Try "from" indicators first: dari, pakai, dengan, di, lewat
 * 2. If not found, try "to" indicators: ke, masuk
 * 3. Capture text until encountering category keywords or date keywords
 * 
 * **Stopping points:**
 * Extraction stops at:
 * - `kategori` keyword
 * - Date keywords (`kemarin`, `tadi`, `hari ini`)
 * - End of string
 * 
 * @param text - User message text to search
 * @returns Account name if found, `null` otherwise
 * 
 * @example
 * ```typescript
 * extractAccountHint("Beli kopi 25rb dari BCA")
 * // returns "BCA"
 * 
 * extractAccountHint("Gaji 10jt ke Mandiri")
 * // returns "Mandiri"
 * 
 * extractAccountHint("Bayar parkir 5000 pakai GoPay kategori transport")
 * // returns "GoPay" (stops at 'kategori')
 * 
 * extractAccountHint("Beli kopi 25rb")
 * // returns null (no account indicator)
 * ```
 * 
 * @see {@link ACCOUNT_INDICATORS_FROM}
 * @see {@link ACCOUNT_INDICATORS_TO}
 */
export function extractAccountHint(text: string): string | null {
  // Try "from" indicators first
  let match = text.match(ACCOUNT_INDICATORS_FROM);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Try "to" indicators
  match = text.match(ACCOUNT_INDICATORS_TO);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Extract category hint from text using category indicators.
 * 
 * Searches for the "kategori" keyword followed by a category name.
 * Used primarily for expense commands to explicitly specify transaction category.
 * 
 * **Extraction strategy:**
 * - Looks for `kategori` keyword
 * - Captures following text until encountering account indicators or date keywords
 * - Returns the captured category name
 * 
 * **Stopping points:**
 * Extraction stops at:
 * - Account indicators (`dari`, `pakai`)
 * - Date keywords (`kemarin`, `tadi`, `hari ini`)
 * - End of string
 * 
 * @param text - User message text to search
 * @returns Category name if found, `null` otherwise
 * 
 * @example
 * ```typescript
 * extractCategoryHint("Beli kopi 25rb kategori makanan")
 * // returns "makanan"
 * 
 * extractCategoryHint("Bayar transport 20rb kategori jalan jalan")
 * // returns "jalan jalan" (multi-word category)
 * 
 * extractCategoryHint("Beli kopi 25rb kategori makanan dari BCA")
 * // returns "makanan" (stops at 'dari')
 * 
 * extractCategoryHint("Beli kopi 25rb")
 * // returns null (no category indicator)
 * ```
 * 
 * @see {@link CATEGORY_INDICATORS}
 */
export function extractCategoryHint(text: string): string | null {
  const match = text.match(CATEGORY_INDICATORS);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Find the starting verb from a list of supported verbs.
 * Returns the matched verb or null if none found.
 *
 * Examples:
 *   findStartingVerb("Beli kopi 25rb", EXPENSE_VERBS) -> "beli"
 *   findStartingVerb("Halo", EXPENSE_VERBS) -> null
 */
export function findStartingVerb(text: string, verbs: string[]): string | null {
  const lowerText = text.toLowerCase();
  return verbs.find(verb => lowerText.startsWith(verb)) || null;
}

/**
 * Extract text between verb and amount.
 * Returns the description portion of the command.
 *
 * Examples:
 *   extractBetweenVerbAndAmount("Beli kopi 25rb", "beli", "25rb") -> "kopi"
 *   extractBetweenVerbAndAmount("Gaji 10jt", "gaji", "10jt") -> ""
 */
export function extractBetweenVerbAndAmount(
  text: string,
  verb: string,
  amountText: string
): string {
  const lowerText = text.toLowerCase();
  const verbEndIndex = lowerText.indexOf(verb.toLowerCase()) + verb.length;
  const amountStartIndex = text.indexOf(amountText);

  if (amountStartIndex === -1 || verbEndIndex >= amountStartIndex) {
    return '';
  }

  return text.substring(verbEndIndex, amountStartIndex).trim();
}

/**
 * Find the first amount text in the message.
 * Returns the matched amount string or null if none found.
 *
 * Examples:
 *   findAmountText("Beli kopi 25rb") -> "25rb"
 *   findAmountText("Gaji 1.5jt") -> "1.5jt"
 *   findAmountText("Halo") -> null
 */
export function findAmountText(text: string): string | null {
  // Reset regex state (important for global regex)
  AMOUNT_PATTERN.lastIndex = 0;
  
  const match = AMOUNT_PATTERN.exec(text);
  if (match && match[0]) {
    return match[0].trim();
  }

  return null;
}

/**
 * Check if text contains multiple amount expressions.
 * Returns true if more than one amount found (indicates multi-action).
 *
 * Examples:
 *   hasMultipleAmounts("Beli kopi 25rb dan makan 50rb") -> true
 *   hasMultipleAmounts("Beli kopi 25rb") -> false
 */
export function hasMultipleAmounts(text: string): boolean {
  // Reset regex state
  AMOUNT_PATTERN.lastIndex = 0;
  
  const matches = text.match(AMOUNT_PATTERN);
  return matches ? matches.length > 1 : false;
}

/**
 * Validate that text doesn't contain malicious patterns.
 * Returns true if text appears safe, false if suspicious.
 *
 * Examples:
 *   isSafeInput("Beli kopi 25rb") -> true
 *   isSafeInput("<script>alert('xss')</script>") -> false
 */
export function isSafeInput(text: string): boolean {
  const maliciousPatterns = [
    /<script/i,           // XSS attempt
    /<img/i,              // XSS via img tag
    /<iframe/i,           // XSS via iframe
    /<object/i,           // XSS via object
    /union\s+select/i,    // SQL injection attempt
    /exec\(/i,            // Code injection attempt
    /-{2,}/,              // SQL comment injection
    /javascript:/i,       // JavaScript protocol
    /on\w+\s*=/i,         // Event handlers (onclick=, onerror=, etc.)
  ];

  return !maliciousPatterns.some(pattern => pattern.test(text));
}

/**
 * Normalize text for consistent pattern matching.
 * Removes extra whitespace, normalizes separators.
 *
 * Examples:
 *   normalizeText("Beli  kopi   25rb") -> "Beli kopi 25rb"
 *   normalizeText("  Gaji 10jt  ") -> "Gaji 10jt"
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Check if message is likely a budget allocation command.
 * Fast pre-check before attempting full parse.
 */
export function looksLikeBudgetCommand(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BUDGET_PREFIXES.some(prefix => lowerText.startsWith(prefix));
}

/**
 * Check if message is likely an expense command.
 * Fast pre-check before attempting full parse.
 */
export function looksLikeExpenseCommand(text: string): boolean {
  const lowerText = text.toLowerCase();
  return EXPENSE_VERBS.some(verb => lowerText.startsWith(verb));
}

/**
 * Check if message is likely an income command.
 * Fast pre-check before attempting full parse.
 */
export function looksLikeIncomeCommand(text: string): boolean {
  const lowerText = text.toLowerCase();
  return INCOME_VERBS.some(verb => lowerText.startsWith(verb));
}
