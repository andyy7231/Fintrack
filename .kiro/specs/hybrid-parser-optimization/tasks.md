# Implementation Plan: Hybrid Parser Optimization

## Overview

This implementation plan breaks down the Hybrid Parser Optimization feature into discrete, testable tasks. The feature introduces a two-tier parsing architecture with deterministic pattern matching for common commands (80%+ of messages) and AI fallback for complex cases, resulting in 70-90% latency reduction and 80%+ cost reduction.

**Implementation Strategy:**
- Build utility functions and core pattern parser first
- Implement hybrid orchestrator with routing logic
- Integrate into existing message service with feature flag
- Add comprehensive testing (property-based + example-based)
- Add observability and metrics collection

## Tasks

- [x] 1. Create utility functions and base infrastructure
  - [x] 1.1 Create regex utilities module for pattern matching
    - Create `services/ai/regex.utils.ts` with compiled regex patterns for expense, income, and budget commands
    - Implement helper functions for multi-action detection, complex date detection, and hint extraction
    - Export all regex patterns and helper functions for reuse
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 5.1, 5.2, 5.3_
  
  - [x] 1.2 Extend amount normalization utilities
    - Review existing `services/ai/amount.utils.ts` to confirm it handles all Indonesian formats (rb, ribu, k, jt, juta)
    - Add tests for decimal amount parsing (1.5jt, 1,5juta)
    - Ensure parseIndonesianAmount() handles edge cases (multiple separators, ambiguous formats)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [x] 1.3 Extend date extraction utilities
    - Review existing `services/ai/date.utils.ts` to confirm support for common Indonesian date keywords
    - Add support for absolute date formats (DD Month, DD/MM, YYYY-MM-DD) if not present
    - Add helper function to detect complex date expressions (relative with time, future dates, ambiguous modifiers)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Implement Pattern Parser Service
  - [x] 2.1 Create Pattern Parser Service core structure
    - Create `services/ai/pattern-parser.service.ts`
    - Define TypeScript interfaces: `PatternParseResult`, `PatternParseFailure`, `PatternParseAttempt`, `PatternParsedIntent`
    - Implement main `attemptPatternParse()` static method with try-catch error handling
    - Implement input validation (null checks, empty string checks)
    - _Requirements: 1.4, 2.4, 3.3, 4.2, 9.1, 9.4_
  
  - [x] 2.2 Implement expense pattern parsing
    - Implement `parseExpense()` private method with multi-action detection
    - Extract expense verb matching (beli, bayar, belanja, buat, untuk, habis)
    - Extract description between verb and amount
    - Extract amount using normalizeAmount()
    - Extract optional account hint and category hint using regex utilities
    - Extract transaction date using date utilities
    - Detect complex date expressions and return failure when found
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_
  
  - [x] 2.3 Implement income pattern parsing
    - Implement `parseIncome()` private method with multi-action detection
    - Extract income verb matching (gaji, terima, dapat, dapet, bonus, pendapatan, masuk)
    - Extract optional description or default to verb name
    - Extract amount using normalizeAmount()
    - Extract optional account hint using regex utilities
    - Extract transaction date using date utilities
    - Detect complex date expressions and return failure when found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4_
  
  - [x] 2.4 Implement budget allocation pattern parsing
    - Implement `parseBudgetAllocation()` private method with multi-action detection
    - Extract budget prefix matching (budget, anggaran, alokasi)
    - Extract category name between prefix and amount
    - Extract amount using normalizeAmount()
    - Use current Jakarta date for budget allocation transaction date
    - Validate category name is not empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 6.2_
  
  - [x] 2.5 Implement pattern parser error handling
    - Wrap all parsing methods in try-catch blocks
    - Return PatternParseFailure with appropriate reason codes (NO_MATCH, AMBIGUOUS, MULTI_ACTION, COMPLEX_DATE, INVALID_FORMAT)
    - Add input sanitization to detect malicious patterns (SQL injection, XSS attempts)
    - Ensure no exceptions are thrown to caller
    - Log errors for debugging without exposing to user
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.1, 9.4, 9.5_

- [x] 3. Checkpoint - Ensure Pattern Parser tests pass
  - Ensure all Pattern Parser unit tests pass (expense, income, budget allocation parsing)
  - Ensure error handling tests pass (negative cases, edge cases)
  - Ask the user if questions arise about pattern matching behavior

- [x] 4. Implement Hybrid Parser Orchestrator
  - [x] 4.1 Create Hybrid Parser Service core structure
    - Create `services/ai/hybrid-parser.service.ts`
    - Define TypeScript interface: `ParseMetrics`
    - Implement constructor accepting optional FinancialParserService instance
    - Store AI parser instance for fallback
    - Initialize metrics collection array
    - _Requirements: 4.1, 4.5, 8.2, 8.4_
  
  - [x] 4.2 Implement pattern-first routing logic
    - Implement `processFinancialText()` method matching FinancialParserService interface
    - Attempt pattern parse first using PatternParserService.attemptPatternParse()
    - On pattern success, call resolvePatternIntent() and return result
    - On pattern failure, fallback to AI parser processFinancialText()
    - Collect timing metrics for both pattern and AI paths
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.1, 10.2_
  
  - [x] 4.3 Implement entity resolution for pattern intents
    - Implement `resolvePatternIntent()` private method
    - For BUDGET_ALLOCATION: resolve budget category using IntentResolverService
    - For EXPENSE: resolve account and category using IntentResolverService
    - For INCOME: resolve account using IntentResolverService
    - Format confirmation prompts matching existing AI parser output format
    - Return ParseWorkflowResult in same structure as AI parser
    - _Requirements: 4.3, 4.5, 9.3, 10.1, 10.2, 10.3_
  
  - [x] 4.4 Implement graceful AI fallback error handling
    - Wrap AI parser calls in try-catch
    - Detect AI service unavailability (503, timeout, missing API key)
    - Return NEEDS_CLARIFICATION with user-friendly message when AI unavailable
    - Log AI fallback errors for observability
    - Ensure no unhandled exceptions reach message service
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 4.5 Implement metrics collection methods
    - Implement `getMetrics()` method returning ParseMetrics array
    - Record parse method (PATTERN, AI_FALLBACK) for each invocation
    - Record processing time in milliseconds
    - Record pattern attempt status and success/failure
    - Record pattern failure reason when applicable
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 5. Checkpoint - Ensure Hybrid Parser tests pass
  - Ensure all Hybrid Parser integration tests pass
  - Ensure pattern-first routing works correctly
  - Ensure AI fallback triggers correctly for complex commands
  - Ask the user if questions arise about hybrid orchestration behavior

- [x] 6. Integrate with Message Service
  - [x] 6.1 Add feature flag support to Message Service
    - Add environment variable `ENABLE_PATTERN_PARSER` with default false
    - Modify `WhatsAppMessageService.processInboundMessage()` to check feature flag
    - When enabled, instantiate HybridParserService instead of FinancialParserService
    - When disabled, use existing FinancialParserService (backward compatibility)
    - Preserve all existing specialized service routing (greeting, deletion, budget query, etc.)
    - _Requirements: 4.1, 10.3, 10.4, 10.5_
  
  - [x] 6.2 Integrate Hybrid Parser into message processing pipeline
    - Replace direct FinancialParserService instantiation with conditional parser selection
    - Pass parser instance through processInboundMessage() for testability
    - Ensure ParseWorkflowResult handling remains unchanged
    - Verify all downstream logic (PendingActionService, confirmation flow) works with hybrid parser
    - _Requirements: 4.1, 4.5, 10.1, 10.2, 10.3_

- [x] 7. Implement observability and metrics collection
  - [x] 7.1 Create Parse Metrics Service
    - Create `services/ai/parse-metrics.service.ts`
    - Define ParseEvent interface with all required fields (timestamp, userId, phoneNumber, messageLength, parseMethod, intentType, processingTimeMs, etc.)
    - Implement `logParseEvent()` static method to log to console and observability backend
    - Implement `getAggregatedMetrics()` method for dashboard queries (placeholder for future observability integration)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 7.2 Integrate metrics logging into Hybrid Parser
    - Add ParseMetricsService.logParseEvent() calls in processFinancialText()
    - Log PATTERN method when pattern parsing succeeds
    - Log AI_FALLBACK method when pattern fails and AI is invoked
    - Include intent type, processing time, pattern attempt status in logs
    - _Requirements: 8.1, 8.2, 8.4_
  
  - [x] 7.3 Integrate metrics logging into Message Service
    - Add ParseMetricsService.logParseEvent() calls for specialized services (greeting, deletion, budget query, etc.)
    - Use parse method "SPECIALIZED" for non-parser routes
    - Include userId, phoneNumber, message length in all log events
    - _Requirements: 8.3, 8.5_

- [ ] 8. Implement comprehensive testing
  - [ ]* 8.1 Write Pattern Parser unit tests for expense parsing
    - Test simple expense commands: "Beli kopi 25rb", "Bayar parkir 5000"
    - Test expense with account hint: "Bayar parkir 5000 dari BCA"
    - Test expense with category hint: "Beli makan siang 45ribu kategori makanan"
    - Test expense with date: "Beli kopi 25rb kemarin"
    - Test multi-action detection: "Beli kopi 25rb dan makan siang 50rb" should fail
    - Test ambiguous expense: "Kemarin kayaknya habis sekitar 50rb" should fail
    - Test missing amount: "Beli kopi" should fail
    - Test all supported expense verbs (beli, bayar, belanja, buat, untuk, habis)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.3, 11.3, 11.4_
  
  - [ ]* 8.2 Write Pattern Parser unit tests for income parsing
    - Test simple income commands: "Gaji 10jt", "Terima transfer 500k", "Bonus 2jt"
    - Test income with description: "Bonus 2jt dari kantor"
    - Test income with account hint: "Gaji 10jt ke BCA"
    - Test income without description (should default to verb): "Gaji 10jt" → description "Gaji"
    - Test multi-action detection: "Gaji 10jt dan bonus 2jt" should fail
    - Test all supported income verbs (gaji, terima, dapat, dapet, bonus, pendapatan, masuk)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 11.3, 11.4_
  
  - [ ]* 8.3 Write Pattern Parser unit tests for budget allocation parsing
    - Test simple budget commands: "Budget makan 1jt", "Anggaran transport 500rb", "Alokasi hiburan 800k"
    - Test multi-word category names: "Budget hiburan dan rekreasi 800k"
    - Test multi-action detection: "Budget makan 1jt dan transport 500rb" should fail
    - Test missing category name: "Budget 1jt" should fail
    - Test all supported budget prefixes (budget, anggaran, alokasi)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 11.3, 11.4_
  
  - [ ]* 8.4 Write property-based tests for amount normalization
    - **Property 1: Amount normalization preserves value semantics**
    - Test all valid Indonesian formats (rb, ribu, k, jt, juta) produce positive numbers
    - Test equivalent formats produce same value ("25rb" = "25ribu" = "25k" = "25000")
    - Test decimal multipliers work correctly ("1.5jt" = "1,5juta" = 1500000)
    - Use fast-check with minimum 100 iterations
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.1, 11.5_
  
  - [ ]* 8.5 Write property-based tests for date extraction
    - **Property 2: Date extraction is deterministic for keywords**
    - Test all common Indonesian date keywords produce valid ISO dates (hari ini, kemarin, tadi, day names)
    - Test date extraction is idempotent within same calendar day
    - Test absolute date formats produce correct dates
    - Use fast-check with minimum 100 iterations
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 11.2, 11.5_
  
  - [ ]* 8.6 Write property-based tests for command format parsing
    - **Property 5, 6, 7: Pattern recognition for all supported formats**
    - Generate random valid expense commands and verify parsing succeeds
    - Generate random valid income commands and verify parsing succeeds
    - Generate random valid budget commands and verify parsing succeeds
    - Use fast-check with minimum 100 iterations per intent type
    - _Requirements: 1.1, 2.1, 3.1, 11.3, 11.5_
  
  - [ ]* 8.7 Write Hybrid Parser integration tests
    - Test pattern parser used for simple expense (AI NOT called)
    - Test pattern parser used for simple income (AI NOT called)
    - Test pattern parser used for simple budget allocation (AI NOT called)
    - Test AI fallback for multi-action command
    - Test AI fallback for complex date expression
    - Test AI fallback for ambiguous command
    - Test graceful degradation when AI service unavailable (503 error)
    - Test entity resolution failure handling
    - _Requirements: 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 9.1, 9.2, 9.3, 11.3, 11.4_
  
  - [ ]* 8.8 Write Message Service integration tests with Hybrid Parser
    - Test message processing with feature flag enabled
    - Test message processing with feature flag disabled (backward compatibility)
    - Test specialized services still execute before Hybrid Parser
    - Test simple expense message end-to-end with pattern parser
    - Test complex message end-to-end with AI fallback
    - Mock WhatsApp client to verify confirmation messages sent
    - _Requirements: 4.1, 10.1, 10.2, 10.3, 10.4, 10.5, 11.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all unit tests pass (pattern parser, utilities)
  - Ensure all property-based tests pass (100+ iterations each)
  - Ensure all integration tests pass (hybrid parser, message service)
  - Verify test coverage meets requirements
  - Ask the user if questions arise about test failures or coverage gaps

- [x] 10. Add documentation and deployment preparation
  - [x] 10.1 Add inline code documentation
    - Add JSDoc comments to all public methods in PatternParserService
    - Add JSDoc comments to all public methods in HybridParserService
    - Add JSDoc comments to ParseMetricsService methods
    - Document all regex patterns with examples in regex.utils.ts
    - Document error handling strategy in comments
    - _Requirements: All requirements (documentation supports understanding)_
  
  - [x] 10.2 Create deployment guide
    - Document feature flag usage (ENABLE_PATTERN_PARSER environment variable)
    - Document rollout phases (development → canary → gradual → default enabled)
    - Document rollback procedure (set flag to false)
    - Document success metrics to monitor (pattern match rate, latency reduction, cost reduction)
    - Document observability dashboard queries for metrics
    - Create `.env.example` entry for ENABLE_PATTERN_PARSER with default false
    - _Requirements: 10.5 (gradual rollout support)_
  
  - [x] 10.3 Update README or documentation with hybrid parser feature
    - Add section explaining hybrid parsing architecture
    - Document supported command formats for pattern matching
    - Document when AI fallback is used
    - Document performance improvements (latency, cost)
    - Add examples of pattern-matched vs AI-fallback commands
    - _Requirements: All requirements (user-facing documentation)_

- [x] 11. Final checkpoint - Production readiness validation
  - Verify all tests pass in CI/CD pipeline
  - Verify feature flag is disabled by default
  - Verify backward compatibility (AI-only mode still works)
  - Verify metrics collection is working
  - Verify error handling catches all edge cases
  - Review code for security issues (SQL injection, XSS prevention)
  - Ask the user if ready to deploy to staging environment

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP, but are highly recommended for production reliability
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- Property-based tests validate universal correctness properties across input space (minimum 100 iterations)
- Feature flag allows gradual rollout and instant rollback without code changes
- Hybrid parser preserves backward compatibility by implementing same interface as AI parser
- Pattern parser never throws exceptions - always returns success or failure result
- All pattern parsing is deterministic and stateless for predictable behavior

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5"] },
    { "id": 6, "tasks": ["8.7"] },
    { "id": 7, "tasks": ["6.1", "6.2"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "8.8"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3"] }
  ]
}
```
