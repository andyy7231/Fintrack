# Bugfix Requirements Document

## Introduction

The WhatsApp bot incorrectly classifies budget allocation statements (e.g., "budget makan 600k") as EXPENSE transactions instead of BUDGET_ALLOCATION actions. This causes budget allocations to be recorded as actual spending, which corrupts the user's financial tracking data. Users expect that setting a budget (allocation/limit) is fundamentally different from recording actual expenses.

From the user report:
- Message sent: "Gaji 2.25 juta dibagi untuk: budget makan 600k, budget kos 750k, bayar kurangan seragam 100k, biaya atribut 100k, bayar paylater 50k"
- Bot processed 6 actions, marking "budget makan 600k" and "budget kos 750k" as "💸 Pengeluaran" (Expense) instead of "📊 Budget" allocation
- This results in incorrect financial records where budget allocations appear as actual spending

The system already has a BUDGET_ALLOCATION intent type and proper handling logic, but the AI parser fails to detect budget keywords when they appear as inline items (comma-separated) rather than at the start of a line.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user message contains "budget [category] [amount]" as an inline item (not at line start, e.g., "gaji dibagi untuk: budget makan 600k, budget kos 750k") THEN the system incorrectly classifies each budget item as an EXPENSE transaction

1.2 WHEN a user message contains "anggaran [category] [amount]" as an inline item THEN the system incorrectly classifies it as an EXPENSE transaction

1.3 WHEN a user message contains "alokasi [category] [amount]" as an inline item THEN the system incorrectly classifies it as an EXPENSE transaction

1.4 WHEN a user message contains "jatah [category] [amount]" as an inline item THEN the system incorrectly classifies it as an EXPENSE transaction

1.5 WHEN budget allocation items are incorrectly classified as EXPENSE THEN they are recorded in the transactions table instead of the budgets table

1.6 WHEN budget allocation items are incorrectly classified as EXPENSE THEN the confirmation message displays "💸 Pengeluaran" (Expense) instead of "📊 Budget"

1.7 WHEN budget allocation items are incorrectly classified as EXPENSE THEN the user's actual cash balance is incorrectly reduced by the budget amount

### Expected Behavior (Correct)

2.1 WHEN a user message contains "budget [category] [amount]" anywhere in the text (inline or at line start) THEN the system SHALL classify it as a BUDGET_ALLOCATION intent

2.2 WHEN a user message contains "anggaran [category] [amount]" anywhere in the text THEN the system SHALL classify it as a BUDGET_ALLOCATION intent

2.3 WHEN a user message contains "alokasi [category] [amount]" anywhere in the text (excluding salary allocation context) THEN the system SHALL classify it as a BUDGET_ALLOCATION intent

2.4 WHEN a user message contains "jatah [category] [amount]" anywhere in the text THEN the system SHALL classify it as a BUDGET_ALLOCATION intent

2.5 WHEN budget allocation is correctly detected THEN it SHALL be processed as a BUDGET_ALLOCATION action with categoryName and amount fields

2.6 WHEN budget allocation is correctly processed THEN the confirmation message SHALL display "📊 Budget [category] [amount]"

2.7 WHEN budget allocation is correctly processed THEN it SHALL create or update a budget record in the budgets table

2.8 WHEN budget allocation is correctly processed THEN it SHALL NOT affect the user's cash balance (no transaction recorded)

2.9 WHEN a message contains both budget allocations and actual expenses (e.g., "budget makan 600k, bayar seragam 100k") THEN the system SHALL correctly distinguish and process each action according to its type

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user message contains actual expense keywords ("bayar", "beli", "biaya") without budget keywords THEN the system SHALL CONTINUE TO classify them as EXPENSE transactions

3.2 WHEN a user sends a multi-line message with expenses on separate lines THEN the system SHALL CONTINUE TO parse each line as a separate action

3.3 WHEN a user sends "bayar makan 50k" (actual spending) THEN the system SHALL CONTINUE TO classify it as an EXPENSE transaction (not BUDGET_ALLOCATION)

3.4 WHEN budget keywords appear at the start of a line (e.g., "budget makan 600k") THEN the system SHALL CONTINUE TO classify them correctly as BUDGET_ALLOCATION

3.5 WHEN the salary allocation service processes messages like "gaji 10jt bagi makan 40% transport 20%" THEN the system SHALL CONTINUE TO use SalaryAllocationService (not the AI parser)

3.6 WHEN INCOME transactions are detected THEN the system SHALL CONTINUE TO process them correctly

3.7 WHEN TRANSFER transactions are detected THEN the system SHALL CONTINUE TO process them correctly

3.8 WHEN single-action messages are sent THEN the system SHALL CONTINUE TO parse and process them correctly

3.9 WHEN batch messages with multiple expenses are sent THEN the system SHALL CONTINUE TO parse all items in the batch

3.10 WHEN the MockAIProvider is used (no API key configured) THEN the system SHALL CONTINUE TO provide deterministic offline parsing
