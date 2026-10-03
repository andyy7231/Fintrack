# Bugfix Requirements Document

## Introduction

User sends WhatsApp command "makan 5k" which successfully creates a transaction, but it is incorrectly categorized as "Lainnya" (Other) instead of being automatically inferred as "Makanan & Minuman" (Food & Drinks) based on the keyword "makan" in the description.

The pattern parser currently only extracts explicit category keywords (e.g., "makan 5k **kategori makanan**") but does not perform automatic category inference from description keywords like the AI parser does. This creates inconsistent behavior between the two parsers and results in poor user experience when users expect natural language commands to work intelligently.

**Impact:** Users must explicitly specify category keywords in every command, or their transactions default to "Lainnya" category, requiring manual recategorization.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user sends "makan 5k" command via WhatsApp THEN the pattern parser extracts description = "makan" and sets categoryHint = null because no explicit "kategori" keyword is present

1.2 WHEN categoryHint is null THEN the category resolver receives no hint and defaults the transaction to "Lainnya" category instead of inferring from description keywords

1.3 WHEN user sends commands with food keywords ("makan", "kopi", "nasi", "ayam", etc.) without explicit "kategori" keyword THEN transactions are miscategorized as "Lainnya" instead of "Makanan & Minuman"

1.4 WHEN user sends commands with transport keywords ("bensin", "grab", "ojek", etc.) without explicit "kategori" keyword THEN transactions are miscategorized as "Lainnya" instead of "Transportasi"

1.5 WHEN user sends commands with utility keywords ("pulsa", "listrik", "wifi", etc.) without explicit "kategori" keyword THEN transactions are miscategorized as "Lainnya" instead of "Tagihan & Utilitas"

### Expected Behavior (Correct)

2.1 WHEN user sends "makan 5k" command via WhatsApp THEN the pattern parser SHALL automatically infer categoryHint = "Makanan & Minuman" from the description keyword "makan"

2.2 WHEN categoryHint is inferred automatically THEN the category resolver SHALL receive the inferred hint and match it to user's existing categories or create/use appropriate category

2.3 WHEN user sends commands with food keywords ("makan", "kopi", "nasi", "ayam", etc.) without explicit "kategori" keyword THEN the system SHALL automatically infer categoryHint = "Makanan & Minuman"

2.4 WHEN user sends commands with transport keywords ("bensin", "grab", "ojek", etc.) without explicit "kategori" keyword THEN the system SHALL automatically infer categoryHint = "Transportasi"

2.5 WHEN user sends commands with utility keywords ("pulsa", "listrik", "wifi", etc.) without explicit "kategori" keyword THEN the system SHALL automatically infer categoryHint = "Tagihan & Utilitas"

2.6 WHEN user sends "makan 5k kategori snack" with explicit category keyword THEN the system SHALL use the explicit categoryHint = "snack" with higher precedence than automatic inference

2.7 WHEN description or text contains keywords matching multiple category patterns THEN the system SHALL use the first matched category from the inference logic (following the same precedence order as AI parser's inferCategoryHint function)

2.8 WHEN description contains no recognizable category keywords THEN the system SHALL infer categoryHint = "Lainnya" explicitly rather than returning null

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user sends commands with explicit "kategori" keyword (e.g., "makan 5k kategori snack") THEN the system SHALL CONTINUE TO extract and use the explicit category hint with highest precedence

3.2 WHEN extractCategoryHint() finds an explicit category keyword THEN the system SHALL CONTINUE TO return that explicit hint without applying automatic inference

3.3 WHEN pattern parser determines a command needs AI fallback (multi-action, ambiguous modifiers, complex dates) THEN the system SHALL CONTINUE TO return null and trigger AI parser

3.4 WHEN AI parser processes a command THEN the system SHALL CONTINUE TO use its existing inferCategoryHint() logic without changes

3.5 WHEN pattern parser successfully parses expense, income, or budget commands THEN the system SHALL CONTINUE TO extract amount, description, transactionDate, and accountHint as before

3.6 WHEN category resolver receives a categoryHint THEN the system SHALL CONTINUE TO match it against user's existing categories using the same matching logic

3.7 WHEN a command contains account hints (e.g., "dari BCA", "pakai Mandiri") THEN the system SHALL CONTINUE TO extract accountHint correctly regardless of category inference changes
