# Bugfix Requirements Document

## Introduction

This document validates the existing WhatsApp Natural Language Transaction Parser implementation against the comprehensive master specification defined in `.kiro/steering/whatsapp-nlp-parser-master-spec.md`. 

The parser is already implemented and consists of:
- **Pattern Parser** (`pattern-parser.service.ts`): Deterministic rule-based parser
- **AI Parser** (`parser.service.ts` + `gemini-provider.ts`): LLM fallback for complex cases
- **Hybrid Parser** (`hybrid-parser.service.ts`): Orchestrates pattern-first, AI-fallback strategy
- **Amount Normalization** (`amount.utils.ts`): Handles k/rb/jt/juta format parsing
- **Date Parsing** (`date.utils.ts`): Handles Indonesian date expressions
- **Entity Resolution** (`resolver.service.ts`): Maps hints to actual user accounts/categories
- **Zod Validation** (`schemas.ts`): Validates all parser outputs

Current status: 200/200 tests passing, 0 TypeScript errors, 0 lint errors, build successful.

This validation exercise identifies any gaps between the implemented system and the master specification requirements, focusing on actual defects rather than stylistic differences.

## Bug Analysis

### Current Behavior (Defect)

#### 1. Parser Architecture & Security Validation

1.1 WHEN validating the parser pipeline architecture THEN verify it follows: WhatsApp → Webhook → User ID → Raw Message Storage → Normalization → Deterministic Parser → LLM Fallback → Zod Validation → Business Validation → Confidence Check → Confirmation → Database

1.2 WHEN validating LLM output security THEN verify that LLM output never directly performs database mutations and always passes through Zod + business validation

1.3 WHEN validating user isolation THEN verify that parser cannot determine user_id from message content and that all entity resolution validates against authenticated user's resources only

1.4 WHEN validating duplicate protection THEN verify that WhatsApp webhook uses external_message_id to prevent duplicate transaction creation

#### 2. Intent Detection Coverage

2.1 WHEN receiving messages like "makan siang 25k" THEN verify EXPENSE intent is correctly detected with amount 25000 and category Food

2.2 WHEN receiving messages like "gajian 7,5 juta" THEN verify INCOME intent is correctly detected with amount 7500000 and category Salary

2.3 WHEN receiving messages like "transfer BCA ke GoPay 100k" THEN verify TRANSFER intent is correctly detected with fromAccount=BCA, toAccount=GoPay, amount=100000

2.4 WHEN receiving messages like "halo" or "apa kabar" THEN verify UNKNOWN intent is returned without attempting transaction creation

2.5 WHEN receiving ambiguous messages like "keluar 100k" or "masuk 500k" THEN verify needsConfirmation=true or UNKNOWN intent is returned

#### 3. Amount Normalization Validation

3.1 WHEN parsing amount "25k", "25K", "25rb", "25RB", "25 ribu", "25ribu", "25000", "25.000", "Rp25.000" THEN verify all normalize to 25000

3.2 WHEN parsing amount "1jt", "1JT", "1 juta", "1juta", "1000000", "1.000.000" THEN verify all normalize to 1000000

3.3 WHEN parsing amount "1,5jt", "1.5jt", "1,5 juta", "1.500.000" THEN verify all normalize to 1500000

3.4 WHEN parsing amount "7,5 juta" THEN verify it normalizes to 7500000

3.5 WHEN parsing amount "1,25jt" THEN verify it normalizes to 1250000

#### 4. Amount Safety Validation

4.1 WHEN validating parsed amounts THEN verify they are numeric, > 0, valid (not NaN), not Infinity, not negative

4.2 WHEN storing EXPENSE transactions THEN verify amount is stored as positive value with type=EXPENSE (not as negative amount)

4.3 WHEN validating database amount storage THEN verify PostgreSQL uses NUMERIC/DECIMAL type for authoritative amounts

#### 5. Category Detection Validation

5.1 WHEN parsing messages with "makan", "makanan", "sarapan", "makan siang", "ngopi", "kopi", "jajan" keywords THEN verify Food category is inferred

5.2 WHEN parsing messages with "grab", "gojek", "ojek", "bensin", "parkir", "tol", "KRL", "MRT" keywords THEN verify Transportation category is inferred

5.3 WHEN parsing messages with "kos", "kontrakan", "sewa rumah" keywords THEN verify Housing category is inferred

5.4 WHEN parsing messages with unclear category THEN verify "Other Expense" is used or needsConfirmation=true

#### 6. Transfer Detection Priority

6.1 WHEN parsing messages like "transfer BCA ke GoPay 100k" THEN verify TRANSFER intent has highest priority (not classified as EXPENSE)

6.2 WHEN parsing messages like "top up GoPay dari BCA 100k" THEN verify it's classified as TRANSFER (not EXPENSE)

6.3 WHEN parsing messages like "isi saldo DANA dari BCA 100k" THEN verify it's classified as TRANSFER (not EXPENSE)

#### 7. Transfer Validation

7.1 WHEN parsing TRANSFER with missing source or destination account THEN verify needsConfirmation=true

7.2 WHEN parsing "transfer 100k" (no accounts specified) THEN verify needsConfirmation=true with request for account information

7.3 WHEN resolving TRANSFER THEN verify fromAccount and toAccount are different (same account transfer is rejected)

#### 8. Account Recognition

8.1 WHEN parsing "makan 25k pakai BCA" THEN verify account=BCA is extracted

8.2 WHEN parsing "gajian 7,5jt masuk BCA" THEN verify account=BCA is extracted

8.3 WHEN parsing "transfer BCA ke GoPay 100k" THEN verify fromAccount=BCA and toAccount=GoPay are extracted

8.4 WHEN validating account names THEN verify case-insensitive matching ("bca" → BCA, "go pay" → GoPay)

8.5 WHEN account is not found in user's accounts THEN verify needsConfirmation=true is returned

#### 9. Description Extraction

9.1 WHEN parsing "makan siang sama Andi 35k" THEN verify description="makan siang sama Andi" and amount=35000 (amount not included in description)

9.2 WHEN parsing "grab ke kantor 25k" THEN verify description="grab ke kantor" (full context preserved)

#### 10. Date Parsing

10.1 WHEN parsing "makan 25k kemarin" THEN verify transactionDate = yesterday (current date - 1 day)

10.2 WHEN parsing "makan 25k hari ini" THEN verify transactionDate = today

10.3 WHEN parsing "makan 25k tadi" THEN verify transactionDate = today

10.4 WHEN parsing dates THEN verify timezone is Asia/Jakarta

10.5 WHEN date is ambiguous THEN verify needsConfirmation=true

#### 11. Natural Language Variation

11.1 WHEN parsing "tadi pagi beli kopi 18k", "barusan makan siang 25rb", "habis 50k buat bensin" THEN verify all are correctly parsed

11.2 WHEN parsing "aku baru bayar kos 1.2jt" THEN verify amount=1200000 is correctly extracted

11.3 WHEN parsing "gaji bulan ini masuk 7,5jt" THEN verify INCOME intent with amount=7500000

#### 12. Word Order Independence

12.1 WHEN parsing "makan siang 25k", "25k makan siang", "tadi makan siang 25k", "tadi 25k buat makan siang", "makan siang tadi habis 25 ribu" THEN verify all produce EXPENSE, Food, 25000

#### 13. Ambiguous Input Handling

13.1 WHEN parsing "tadi makan" (no amount) THEN verify needsConfirmation=true or UNKNOWN

13.2 WHEN parsing "bayar sesuatu 50k" (unclear category) THEN verify needsConfirmation=true or default category used

13.3 WHEN parsing "keluar 100k" (EXPENSE or unclear?) THEN verify needsConfirmation=true

13.4 WHEN parsing "masuk 500k" (INCOME or TRANSFER?) THEN verify needsConfirmation=true

13.5 WHEN parsing "transfer 100k" (no accounts) THEN verify needsConfirmation=true

#### 14. Non-Financial Message Handling

14.1 WHEN parsing "halo", "pagi", "apa kabar", "oke", "makasih", "wkwk", "iya" THEN verify UNKNOWN intent (no transaction created)

14.2 WHEN UNKNOWN intent is returned THEN verify needsConfirmation=false (no further action needed)

#### 15. Confidence Scoring

15.1 WHEN parser produces result THEN verify confidence score is included (0.0 to 1.0)

15.2 WHEN confidence >= 0.90 and all required fields present THEN verify transaction can proceed to confirmation

15.3 WHEN confidence < 0.70 THEN verify confirmation or UNKNOWN is returned

#### 16. Zod Schema Validation

16.1 WHEN parser produces structured output THEN verify it passes through TransactionIntentSchema or ParserResultSchema

16.2 WHEN LLM produces output THEN verify it is validated by Zod before any business logic

16.3 WHEN Zod validation fails THEN verify transaction is rejected (not silently accepted)

### Expected Behavior (Correct)

#### 1. Parser Architecture & Security

2.1 WHEN validating the parser pipeline THEN the system SHALL follow the complete validated pipeline from webhook to database with no shortcuts

2.2 WHEN LLM produces output THEN the system SHALL validate it through Zod schemas and business validation before any database mutation

2.3 WHEN resolving entities THEN the system SHALL verify all accounts and categories belong to the authenticated user

2.4 WHEN processing WhatsApp messages THEN the system SHALL use external_message_id to prevent duplicate transactions

#### 2. Intent Detection

2.5 WHEN messages match EXPENSE patterns THEN the system SHALL correctly detect EXPENSE intent with proper amount and category

2.6 WHEN messages match INCOME patterns THEN the system SHALL correctly detect INCOME intent with proper amount and category

2.7 WHEN messages match TRANSFER patterns THEN the system SHALL correctly detect TRANSFER intent with proper accounts and amount

2.8 WHEN messages are non-financial THEN the system SHALL return UNKNOWN without transaction creation

2.9 WHEN messages are ambiguous THEN the system SHALL request confirmation or return UNKNOWN

#### 3. Amount Normalization

2.10 WHEN parsing Indonesian amount formats THEN the system SHALL normalize all variations (k/rb/ribu/jt/juta) correctly to numeric values

2.11 WHEN parsing decimal amounts THEN the system SHALL handle both comma and dot decimal separators (Indonesian format)

#### 4. Amount Safety

2.12 WHEN validating amounts THEN the system SHALL ensure they are numeric, positive, valid (not NaN/Infinity), and non-ambiguous

2.13 WHEN storing amounts THEN the system SHALL use PostgreSQL NUMERIC/DECIMAL type and store EXPENSE as positive with intent type

#### 5. Category Detection

2.14 WHEN category keywords are present THEN the system SHALL infer appropriate category (Food, Transportation, Housing, etc.)

2.15 WHEN category is unclear THEN the system SHALL use default category or request confirmation

#### 6. Transfer Detection

2.16 WHEN transfer patterns are detected THEN the system SHALL prioritize TRANSFER intent over EXPENSE or INCOME

2.17 WHEN top-up patterns are detected THEN the system SHALL classify as TRANSFER not EXPENSE

#### 7. Transfer Validation

2.18 WHEN TRANSFER is missing accounts THEN the system SHALL set needsConfirmation=true and request missing information

2.19 WHEN TRANSFER has same source and destination THEN the system SHALL reject the transaction

#### 8. Account Recognition

2.20 WHEN account hints are present THEN the system SHALL extract and resolve them case-insensitively against user's accounts

2.21 WHEN account is not found THEN the system SHALL request clarification

#### 9. Description Extraction

2.22 WHEN extracting descriptions THEN the system SHALL separate description from amount and metadata correctly

#### 10. Date Parsing

2.23 WHEN Indonesian date expressions are used THEN the system SHALL parse them correctly in Asia/Jakarta timezone

2.24 WHEN date is ambiguous THEN the system SHALL request clarification

#### 11. Natural Language Variation

2.25 WHEN various Indonesian natural language patterns are used THEN the system SHALL understand and parse them correctly

#### 12. Word Order Independence

2.26 WHEN word order varies THEN the system SHALL extract the same intent, amount, and category regardless of order

#### 13. Ambiguous Input Handling

2.27 WHEN required information is missing or ambiguous THEN the system SHALL request confirmation rather than guessing

#### 14. Non-Financial Message Handling

2.28 WHEN non-financial messages are received THEN the system SHALL return UNKNOWN without creating transactions

#### 15. Confidence Scoring

2.29 WHEN producing parse results THEN the system SHALL include confidence scores to guide confirmation decisions

#### 16. Zod Schema Validation

2.30 WHEN any structured data is produced THEN the system SHALL validate it through appropriate Zod schemas

### Unchanged Behavior (Regression Prevention)

#### 3.1 Existing Test Suite

3.1.1 WHEN running the existing 200/200 tests THEN the system SHALL CONTINUE TO pass all tests without regression

#### 3.2 TypeScript & Lint

3.1.2 WHEN running TypeScript compilation THEN the system SHALL CONTINUE TO have 0 TypeScript errors

3.1.3 WHEN running ESLint THEN the system SHALL CONTINUE TO have 0 lint errors/warnings

#### 3.3 Build Process

3.1.4 WHEN running npm run build THEN the system SHALL CONTINUE TO build successfully

#### 3.4 Pattern Parser Behavior

3.1.5 WHEN deterministic patterns are recognized THEN the system SHALL CONTINUE TO use pattern parser (not LLM) for fast path

3.1.6 WHEN pattern parser succeeds THEN the system SHALL CONTINUE TO skip LLM fallback

#### 3.5 Hybrid Parser Orchestration

3.1.7 WHEN Hybrid Parser is enabled THEN the system SHALL CONTINUE TO try pattern parser first, then AI fallback on failure

3.1.8 WHEN pattern matching fails gracefully THEN the system SHALL CONTINUE TO route to AI parser without blocking

#### 3.6 Entity Resolution

3.1.9 WHEN accounts or categories are referenced THEN the system SHALL CONTINUE TO resolve them against authenticated user's data only

3.1.10 WHEN ambiguous entities are found THEN the system SHALL CONTINUE TO request clarification

#### 3.7 Confirmation Flow

3.1.11 WHEN transactions are ready THEN the system SHALL CONTINUE TO require YA/BATAL confirmation before database mutation

3.1.12 WHEN multiple actions are pending THEN the system SHALL CONTINUE TO execute all atomically on YA confirmation

#### 3.8 WhatsApp Integration

3.1.13 WHEN WhatsApp webhooks are received THEN the system SHALL CONTINUE TO verify, extract, and process messages correctly

3.1.14 WHEN responses are sent THEN the system SHALL CONTINUE TO format them appropriately for WhatsApp display

#### 3.9 Security & Ownership

3.1.15 WHEN processing any financial action THEN the system SHALL CONTINUE TO validate ownership and authorization

3.1.16 WHEN LLM output is received THEN the system SHALL CONTINUE TO never trust it directly for database mutations

#### 3.10 Metrics & Observability

3.1.17 WHEN parsing occurs THEN the system SHALL CONTINUE TO collect metrics (method, timing, success rates)

3.1.18 WHEN errors occur THEN the system SHALL CONTINUE TO handle them gracefully without exposing internal details
