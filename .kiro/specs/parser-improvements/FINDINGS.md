# Parser Improvements - Technical Findings

**Status:** Documented issues for future implementation  
**Source:** Budget deployment baseline testing (2026-10-03)  
**Context:** Created test files to document parser behavior, discovered 8 mismatches

---

## Summary

During budget accounting verification, new parser regression tests were created to document expected behavior. These tests revealed 8 existing parser limitations that should be addressed in a separate parser improvement task.

**Critical:** These issues are NOT regressions from the budget fix. The parser code was unchanged during budget implementation.

---

## Issues Discovered

### 1. Transfer Account Extraction - Amount in Account Name

**Test:** \"dari BCA ke OVO 250k"\  
**Expected:** \	oAccountHint = 'ovo'\  
**Actual:** \	oAccountHint = 'ovo 250k'\

**Root Cause:**  
Regex \/ke\s+([a-z0-9_\-\s]+?)(?:\s+dari\s+|$)/i\ captures everything after "ke " until end-of-string, including the amount.

**Fix Needed:**  
Regex should stop at numeric characters or amount keywords (k, rb, ribu, jt, juta).

**File:** \services/ai/provider.ts\ line ~384

---

### 2. Income Category Naming - "Freelance"

**Tests:** 3 failures  
**Expected:** \"Freelance / Side Job"\  
**Actual:** \"Freelance"\

**Root Cause:**  
Parser returns \"Freelance"\ (line 402 in provider.ts), tests expect full category name.

**Fix Needed:**  
Decision required - update parser to match database category names OR update tests to match parser output.

**File:** \services/ai/provider.ts\ line 402

---

### 3. Income Category Naming - "Bonus"

**Tests:** 2 failures  
**Expected:** \"Bonus & Hadiah"\  
**Actual:** \"Bonus"\

**Root Cause:**  
Parser returns \"Bonus"\ (line 404), tests expect full category name with " & Hadiah".

**Fix Needed:**  
Align parser output with database category naming convention.

**File:** \services/ai/provider.ts\ line 404

---

### 4. Income Category Naming - "Penjualan"

**Test:** \"penjualan produk 800k"\  
**Expected:** \categoryHint = "Penjualan"\  
**Actual:** \categoryHint = "Bisnis"\

**Root Cause:**  
Parser maps "penjualan" keyword to "Bisnis" category (line 405).

**Fix Needed:**  
Either add "Penjualan" as separate category OR update test to expect "Bisnis".

**File:** \services/ai/provider.ts\ line 405

---

### 5. Amount Parsing - Indonesian Dot Separator

**Test:** \"gaji Rp 7.500.000"\  
**Expected:** \mount = 7500000\  
**Actual:** \mount = 7500\

**Root Cause:**  
Amount parser treats dot as decimal separator (Western style) instead of thousands separator (Indonesian style).

**Fix Needed:**  
\parseIndonesianAmount()\ should recognize \Rp\ prefix and treat dots as thousands separators in that context.

**File:** \services/ai/amount.utils.ts\

---

### 6. Amount Parsing - Space Between Number and Unit

**Test:** \"bonus 2 juta"\  
**Expected:** \intent = "INCOME", amount = 2000000\  
**Actual:** \intent = "UNKNOWN"\

**Root Cause:**  
Amount regex doesn't match patterns with space between number and unit word (e.g., "2 juta", "500 ribu").

**Fix Needed:**  
Update amount regex to handle optional whitespace: \/(\d+)\s*(juta|ribu|jt|rb|k)/i\

**File:** \services/ai/provider.ts\ income parsing regex

---

## Test Files Status

### Created but NOT Committed (Failing Tests)

- \__tests__/services/ai/income-regression.test.ts\ (11/18 PASS, 7 FAIL)
- \__tests__/services/ai/transfer-detection.test.ts\ (15/16 PASS, 1 FAIL)

**Reason for exclusion:** These tests document expected behavior but currently fail. They should be included once the parser issues are fixed.

### Committed (Passing Tests)

- \__tests__/services/budget-allocation-preservation.test.ts\ (8/8 PASS)
- \__tests__/services/budget-expense-integration.test.ts\ (5/5 PASS)
- \__tests__/services/budget-find-applicable.test.ts\ (7/7 PASS)

---

## Recommended Approach

### Phase 1: Fix Amount Parsing (Issues #5, #6)
Priority: HIGH - affects transaction accuracy

1. Fix \parseIndonesianAmount()\ to handle "Rp 7.500.000" format
2. Update amount regex to support "2 juta" (space before unit)
3. Add comprehensive amount parsing regression tests

### Phase 2: Fix Transfer Extraction (Issue #1)
Priority: MEDIUM - affects transfer account matching

1. Update transfer regex to stop at amount boundaries
2. Verify against \	ransfer-detection.test.ts\

### Phase 3: Align Category Naming (Issues #2, #3, #4)
Priority: LOW - cosmetic, doesn't break functionality

1. Decide on canonical category names (parser vs database)
2. Update parser or tests to match
3. Verify against \income-regression.test.ts\

---

## Production Safety

**Confirmed:**
- Parser issues exist independently of budget fix
- Budget changes did NOT modify parser logic
- No parser code changed during budget deployment
- All budget tests (20/20) passing with current parser

**Deployment Decision:**
Budget accounting fix deployed without parser changes. Parser improvements deferred to separate task.

---

## References

**Budget Deployment Commit:** 1f10d7ec7f149884d5aa3696fe2b793c9353edaf  
**Production Baseline:** 1a7d2e19add05b1e2f47dffb149192240fea13c5  
**Test Creation Date:** 2026-10-03

