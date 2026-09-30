# Requirements Document

## Introduction

The WhatsApp bot currently routes ALL user messages through an AI-based parser (Gemini API) to interpret financial commands. While this provides flexibility for complex and ambiguous inputs, it introduces unnecessary latency, API costs, and reliability issues for simple, structured commands that follow predictable patterns.

This feature introduces a hybrid parsing approach that uses fast, deterministic pattern matching for common transaction formats, and only falls back to AI parsing for genuinely complex or ambiguous inputs. This optimization will reduce response time by 70-90% for common commands, eliminate API costs for 80%+ of messages, and improve system reliability by removing dependency on external AI service availability for routine operations.

## Glossary

- **Hybrid_Parser**: The orchestration service that attempts pattern-based parsing first, then falls back to AI parsing if pattern matching fails.
- **Pattern_Parser**: A deterministic parser that uses regular expressions and string matching to extract structured data from common command formats.
- **AI_Parser**: The existing FinancialParserService that uses Gemini API for natural language understanding (already implemented as `services/ai/parser.service.ts`).
- **Message_Service**: The WhatsApp message orchestration service that receives inbound messages and routes them through parsing services (already implemented as `services/whatsapp/message.service.ts`).
- **Structured_Command**: A message following a predictable format that can be parsed deterministically (e.g., "Beli kopi 25rb").
- **Unstructured_Command**: A message with ambiguity, complex multi-part logic, or non-standard phrasing requiring AI interpretation.
- **Indonesian_Amount**: Numeric amount with Indonesian abbreviations (rb/ribu for thousands, jt/juta for millions, k for thousands).
- **Transaction_Date**: Date expression in Indonesian format (e.g., "kemarin", "tadi pagi", "20 Januari", or "20/01").
- **Account_Hint**: Optional account name mention in command (e.g., "dari BCA", "pakai GoPay").
- **Category_Hint**: Optional category name mention in command (e.g., "kategori makanan", "untuk transport").

## Requirements

### Requirement 1: Pattern Parser for Simple Expense Transactions

**User Story:** As a user sending common expense commands like "Beli kopi 25rb", I want instant confirmation without AI processing delays, so that I can record transactions faster.

#### Acceptance Criteria

1. WHEN a message matches the pattern `<action_verb> <description> <amount>` (e.g., "Beli kopi 25rb", "Bayar parkir 5000"), THE Pattern_Parser SHALL extract intent type EXPENSE, description, and amount
2. THE Pattern_Parser SHALL recognize Indonesian action verbs indicating expenses: "beli", "bayar", "belanja", "buat", "untuk", "habis"
3. WHEN amount contains Indonesian abbreviations ("rb", "ribu", "k", "jt", "juta"), THE Pattern_Parser SHALL normalize to numeric value (25rb → 25000, 1.5jt → 1500000)
4. WHEN pattern parsing succeeds for expense format, THE Pattern_Parser SHALL return structured intent without invoking AI_Parser
5. WHEN message includes optional account hint (e.g., "Beli kopi 25rb dari BCA"), THE Pattern_Parser SHALL extract account hint for resolution
6. WHEN message includes optional category hint (e.g., "Beli kopi 25rb kategori makanan"), THE Pattern_Parser SHALL extract category hint for resolution
7. WHEN amount is missing or unparseable, THE Pattern_Parser SHALL return parse failure to trigger AI fallback

### Requirement 2: Pattern Parser for Simple Income Transactions

**User Story:** As a user recording income like "Gaji 10jt", I want deterministic parsing without AI overhead, so that salary and income entries are processed reliably.

#### Acceptance Criteria

1. WHEN a message matches the pattern `<income_verb> <amount>` with optional description (e.g., "Gaji 10jt", "Terima transfer 500k", "Bonus 2jt dari kantor"), THE Pattern_Parser SHALL extract intent type INCOME, amount, and description
2. THE Pattern_Parser SHALL recognize Indonesian income verbs: "gaji", "terima", "dapat", "dapet", "bonus", "pendapatan", "masuk"
3. WHEN income command omits description, THE Pattern_Parser SHALL default description to the income verb (e.g., "Gaji 10jt" → description "Gaji")
4. WHEN pattern parsing succeeds for income format, THE Pattern_Parser SHALL return structured intent without invoking AI_Parser
5. WHEN message includes optional account hint (e.g., "Gaji 10jt ke BCA"), THE Pattern_Parser SHALL extract account hint for resolution

### Requirement 3: Pattern Parser for Budget Allocation Commands

**User Story:** As a user setting budgets like "Budget makan 1jt", I want consistent parsing without AI variability, so that budget allocations are recorded exactly as stated.

#### Acceptance Criteria

1. WHEN a message matches the pattern `budget <category_name> <amount>` (e.g., "Budget makan 1jt", "Budget transport 500rb"), THE Pattern_Parser SHALL extract intent type BUDGET_ALLOCATION, category name, and amount
2. THE Pattern_Parser SHALL recognize budget command prefixes: "budget", "anggaran", "alokasi"
3. WHEN pattern parsing succeeds for budget allocation format, THE Pattern_Parser SHALL return structured intent without invoking AI_Parser
4. WHEN category name contains multiple words (e.g., "Budget hiburan dan rekreasi 800k"), THE Pattern_Parser SHALL extract full category name between prefix and amount
5. WHEN budget command format is invalid or category cannot be extracted, THE Pattern_Parser SHALL return parse failure to trigger AI fallback

### Requirement 4: Hybrid Parser Orchestration

**User Story:** As the system, I want to route messages through pattern matching first and AI parsing only when needed, so that processing is optimized for speed and cost.

#### Acceptance Criteria

1. WHEN Message_Service receives a verified user message (not greeting, not confirmation, not deletion command), THE Hybrid_Parser SHALL be invoked before AI_Parser
2. THE Hybrid_Parser SHALL attempt Pattern_Parser extraction for all supported formats (expense, income, budget allocation)
3. WHEN Pattern_Parser returns successful parse result, THE Hybrid_Parser SHALL skip AI_Parser invocation and proceed to entity resolution
4. WHEN Pattern_Parser returns parse failure (no pattern match), THE Hybrid_Parser SHALL invoke AI_Parser as fallback
5. THE Hybrid_Parser SHALL preserve the same ParseWorkflowResult interface that AI_Parser currently returns, ensuring Message_Service integration remains unchanged
6. WHEN both Pattern_Parser and AI_Parser fail, THE Hybrid_Parser SHALL return NEEDS_CLARIFICATION status with appropriate error message

### Requirement 5: Pattern Parser Negative Cases and Boundaries

**User Story:** As the system, I want pattern matching to fail gracefully for edge cases, so that complex commands correctly fall back to AI parsing.

#### Acceptance Criteria

1. WHEN a message contains multiple transactions (e.g., "Beli kopi 25rb dan makan siang 50rb"), THE Pattern_Parser SHALL return parse failure to trigger AI batch parsing
2. WHEN a message contains complex date references beyond simple keywords (e.g., "Beli kopi 25rb tiga hari yang lalu jam 3 sore"), THE Pattern_Parser SHALL return parse failure
3. WHEN a message contains conditional or ambiguous phrasing (e.g., "Kemarin kayaknya habis sekitar 50rb untuk kopi"), THE Pattern_Parser SHALL return parse failure
4. WHEN a message mixes English and Indonesian in non-standard ways, THE Pattern_Parser SHALL return parse failure
5. WHEN amount contains decimal separators inconsistent with Indonesian format (e.g., "25,000.50"), THE Pattern_Parser SHALL attempt to normalize or return parse failure if ambiguous

### Requirement 6: Pattern Parser Date Extraction

**User Story:** As a user specifying transaction dates like "kemarin beli kopi 25rb", I want pattern matching to handle common date expressions, so that date parsing doesn't require AI fallback.

#### Acceptance Criteria

1. WHEN message contains common Indonesian date keywords ("hari ini", "kemarin", "tadi", "pagi ini", "siang ini", "sore ini", "malam ini"), THE Pattern_Parser SHALL extract transaction date relative to current Jakarta time
2. WHEN message omits date reference, THE Pattern_Parser SHALL default transaction date to current Jakarta date
3. WHEN message contains absolute date (e.g., "20 Januari", "20/01", "2024-01-20"), THE Pattern_Parser SHALL extract specific date
4. WHEN date expression is complex or ambiguous (e.g., "tiga hari yang lalu sore"), THE Pattern_Parser SHALL return parse failure to trigger AI fallback
5. THE Pattern_Parser SHALL use the same date parsing utilities already implemented in `services/ai/date.utils.ts` for consistency

### Requirement 7: Pattern Parser Amount Normalization

**User Story:** As a user writing amounts in various Indonesian formats, I want consistent interpretation across pattern and AI parsing, so that amounts are recorded accurately.

#### Acceptance Criteria

1. THE Pattern_Parser SHALL recognize Indonesian thousand separators: "rb", "ribu", "k" (e.g., "25rb" → 25000, "25ribu" → 25000, "25k" → 25000)
2. THE Pattern_Parser SHALL recognize Indonesian million separators: "jt", "juta" (e.g., "1.5jt" → 1500000, "1,5juta" → 1500000, "2jt" → 2000000)
3. WHEN amount contains decimal point or comma before abbreviation (e.g., "1.5jt", "1,5jt"), THE Pattern_Parser SHALL treat as decimal multiplier (1.5 × 1000000 = 1500000)
4. WHEN amount is pure numeric without abbreviation (e.g., "25000"), THE Pattern_Parser SHALL accept as exact amount
5. THE Pattern_Parser SHALL use the same amount parsing utilities already implemented in `services/ai/amount.utils.ts` for consistency
6. WHEN amount format is ambiguous or contains multiple abbreviations, THE Pattern_Parser SHALL return parse failure

### Requirement 8: Observability and Metrics

**User Story:** As a developer, I want to measure pattern matching vs AI parsing usage, so that I can validate optimization impact and identify new patterns to support.

#### Acceptance Criteria

1. WHEN Pattern_Parser successfully parses a message, THE Hybrid_Parser SHALL log parse method "PATTERN" with intent type and processing time
2. WHEN Pattern_Parser fails and AI_Parser is invoked, THE Hybrid_Parser SHALL log parse method "AI_FALLBACK" with processing time
3. WHEN existing specialized services handle a message before Hybrid_Parser (greeting, deletion, budget query, etc.), THE Message_Service SHALL log parse method "SPECIALIZED" for tracking
4. THE Hybrid_Parser SHALL expose metrics for pattern match success rate, AI fallback rate, and average processing time per method
5. WHEN logging parsing events, THE system SHALL include user_id, phone_number, message_length, and parse_method for analysis

### Requirement 9: Error Handling and Resilience

**User Story:** As the system, I want graceful degradation when pattern matching encounters errors, so that users always receive a response even if optimization fails.

#### Acceptance Criteria

1. WHEN Pattern_Parser throws an unexpected error during parsing, THE Hybrid_Parser SHALL catch the error, log it, and proceed to AI_Parser fallback
2. WHEN AI_Parser is unavailable (503 error, timeout, missing API key) after Pattern_Parser fails, THE Hybrid_Parser SHALL return NEEDS_CLARIFICATION with user-friendly message
3. WHEN Pattern_Parser successfully extracts structured data but entity resolution fails (account/category not found), THE system SHALL return NEEDS_CLARIFICATION requesting missing information
4. THE Hybrid_Parser SHALL NOT throw unhandled exceptions that would mark whatsapp_messages status as FAILED
5. WHEN pattern matching detects potential SQL injection or malicious input patterns, THE Pattern_Parser SHALL sanitize or return parse failure

### Requirement 10: Backward Compatibility and Migration

**User Story:** As a developer, I want seamless integration of Hybrid_Parser into the existing message processing pipeline, so that deployment doesn't break current functionality.

#### Acceptance Criteria

1. THE Hybrid_Parser SHALL implement the same interface contract as AI_Parser (accept text and userId, return ParseWorkflowResult)
2. WHEN Message_Service invokes Hybrid_Parser, THE response format SHALL be identical to AI_Parser response (READY_FOR_CONFIRMATION, BALANCE_QUERY, NEEDS_CLARIFICATION, ERROR)
3. THE existing AI_Parser (FinancialParserService) SHALL remain unchanged and continue to be invoked by Hybrid_Parser as fallback
4. THE existing specialized services (GreetingService, TransactionDeletionService, BudgetQueryService, SalaryAllocationService, TransactionQueryService) SHALL continue to execute before Hybrid_Parser for their respective patterns
5. WHEN Hybrid_Parser is deployed, THE system SHALL support gradual rollout via feature flag or environment variable (ENABLE_PATTERN_PARSER=true/false)

### Requirement 11: Pattern Parser Test Coverage

**User Story:** As a developer, I want comprehensive test coverage for pattern matching logic, so that deterministic parsing is reliable and regression-free.

#### Acceptance Criteria

1. THE Pattern_Parser SHALL have property-based tests for amount normalization covering all valid Indonesian formats (rb, ribu, k, jt, juta, decimals, pure numbers)
2. THE Pattern_Parser SHALL have property-based tests for date extraction covering common Indonesian date expressions and edge cases
3. THE Pattern_Parser SHALL have example-based tests for all supported command formats (expense, income, budget allocation) with variations
4. THE Pattern_Parser SHALL have tests for negative cases ensuring complex commands correctly return parse failure
5. FOR ALL valid structured commands parsed by Pattern_Parser, round-trip property SHALL hold: format(parse(command)) produces semantically equivalent command

