# Budget Rolling Period Implementation - Tasks

## Summary

Implementasi fitur budget dengan periode fleksibel (rolling period) untuk mengatasi masalah budget yang dibuat di akhir bulan.

**Problem Solved:**
- User membuat budget 29 Sep, tetapi hanya berlaku sampai 30 Sep
- Transaksi Oktober tidak terhitung dalam budget
- User ingin budget 30 hari dari tanggal pembuatan

## Status

- [x] Requirements document created
- [x] Design document created  
- [x] Schema updated (schemas/budget.schema.ts)
- [ ] Database migration needed
- [ ] BudgetService.createBudget() update
- [ ] BudgetService helper functions (calculateRollingPeriod)
- [ ] WhatsApp budget status update
- [ ] Dashboard UI update
- [ ] Testing

## Files to Modify

### 1. Database Schema (db/schema/budget.ts)
**Status:** Already supports periodType field
**Action:** NO CHANGES NEEDED - existing schema already has flexible \periodType: text("period_type")\

### 2. Validation Schemas (schemas/budget.schema.ts)
**Status:** ✅ COMPLETED
**Changes:**
- Added ROLLING_30_DAYS, ROLLING_7_DAYS, ROLLING_90_DAYS to periodTypeSchema
- Created createRollingBudgetSchema
- Updated discriminated union

### 3. Budget Service (services/budget.service.ts)
**Status:** ⏳ IN PROGRESS
**Required Changes:**

#### A. Add Rolling Period Calculation Function
Insert after \jakartaDateStringToExclusiveUtcEnd\ function (line ~67):

\\\	ypescript
/**
 * Calculate rolling period (30/7/90 days) from a start date.
 * Returns [startUtc, endUtc) where endUtc = start + N days.
 */
function calculateRollingPeriod(
  startDateStr: string | null,
  durationDays: 30 | 7 | 90
): { start: Date; end: Date } {
  let startUtc: Date;
  
  if (startDateStr) {
    startUtc = jakartaDateStringToUtc(startDateStr);
  } else {
    // Default to today Jakarta midnight
    const now = new Date();
    const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
    const year = jakartaNow.getUTCFullYear();
    const month = jakartaNow.getUTCMonth();
    const day = jakartaNow.getUTCDate();
    const todayLocal = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    startUtc = new Date(todayLocal.getTime() - JAKARTA_OFFSET_MS);
  }
  
  const endUtc = new Date(startUtc.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return { start: startUtc, end: endUtc };
}
\\\

#### B. Update createBudget Method
Modify line ~438 (\if (input.periodType === "MONTHLY")\) to:

\\\	ypescript
if (input.periodType === "MONTHLY") {
  const bounds = jakartaMonthToUtcRange(input.year, input.month);
  startUtc = bounds.start;
  endUtc = bounds.end;
} else if (input.periodType === "CUSTOM") {
  startUtc = jakartaDateStringToUtc(input.startDate);
  endUtc = jakartaDateStringToExclusiveUtcEnd(input.endDate);
} else {
  // ROLLING periods
  const durationMap = {
    "ROLLING_30_DAYS": 30,
    "ROLLING_7_DAYS": 7,
    "ROLLING_90_DAYS": 90,
  } as const;
  
  const duration = durationMap[input.periodType];
  const period = calculateRollingPeriod(input.startDate || null, duration);
  startUtc = period.start;
  endUtc = period.end;
}
\\\

### 4. WhatsApp Budget Query (services/whatsapp/budget-query.service.ts)
**Status:** ⏳ TODO
**Required Changes:**

#### A. Add Period Type Label Function
\\\	ypescript
function getPeriodTypeLabel(periodType: string): string {
  switch (periodType) {
    case "MONTHLY": return "Bulanan";
    case "ROLLING_30_DAYS": return "30 Hari";
    case "ROLLING_7_DAYS": return "7 Hari";
    case "ROLLING_90_DAYS": return "90 Hari";
    case "CUSTOM": return "Custom";
    default: return periodType;
  }
}
\\\

#### B. Add Remaining Days Calculator
\\\	ypescript
function getRemainingDays(endDate: Date): number {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
\\\

#### C. Update formatSingleBudgetStatus Function (line ~179)
Add period info:

\\\	ypescript
return (
  \\ *Status Budget \*\n\n\ +
  \• Batas Anggaran: Rp \\n\ +
  \• Sudah Terpakai: Rp \ (\%)\n\ +
  \• Sisa Kuota: *Rp \*\n\n\ +
  \• Tipe: *\*\n\ +
  \• Periode: \ - \ (\ hari lagi)\n\n\ +
  \Status: \\n\n\ +
  \Setiap Anda catat pengeluaran di WA, sisa kuota ini akan otomatis berkurang.\
);
\\\

### 5. Dashboard Budget UI (app/dashboard/budget/)
**Status:** ⏳ TODO
**Files to Modify:**
- \pp/dashboard/budget/create/page.tsx\ - Add period type selector
- \pp/dashboard/budget/components/BudgetCard.tsx\ - Show period type badge
- \pp/dashboard/budget/components/BudgetList.tsx\ - Display rolling periods

**UI Changes Needed:**
1. Budget creation form - add radio group for period type selection
2. Budget card - show period type badge and remaining days
3. Budget list - format date ranges instead of "Oktober 2026"

## Migration Strategy

**NO DATABASE MIGRATION NEEDED!**

Existing budgets already have \periodType\ field stored as text. They currently use "MONTHLY" or "CUSTOM". New rolling types are just new valid values.

**Backward Compatibility:**
- All existing budgets continue to work (periodType = "MONTHLY" or "CUSTOM")
- New budgets can use ROLLING_30_DAYS / ROLLING_7_DAYS / ROLLING_90_DAYS
- No data migration required

## Testing Checklist

### Backend Tests
- [ ] Create MONTHLY budget (existing behavior)
- [ ] Create ROLLING_30_DAYS budget
- [ ] Create ROLLING_7_DAYS budget  
- [ ] Create ROLLING_90_DAYS budget
- [ ] Verify date ranges are calculated correctly
- [ ] Test overlapping budget detection with rolling periods
- [ ] Test spending aggregation across rolling periods
- [ ] Test budget created without startDate (defaults to today)
- [ ] Test budget created with explicit startDate

### WhatsApp Tests
- [ ] Query budget status shows period type
- [ ] Query budget status shows remaining days
- [ ] Multiple budgets display correctly

### Frontend Tests
- [ ] Budget creation form shows period type options
- [ ] Budget list displays rolling periods correctly
- [ ] Budget card shows period type badge
- [ ] Remaining days indicator works

## Deployment Steps

1. ✅ Commit schema changes (schemas/budget.schema.ts)
2. ⏳ Update BudgetService with rolling period logic
3. ⏳ Update WhatsApp responses
4. ⏳ Update Dashboard UI
5. ⏳ Run tests
6. ⏳ Deploy to production

**NO DATABASE MIGRATION REQUIRED** - schema already supports text periodType.

## User Example

**Before Fix:**
\\\
User: (creates budget 29 Sep)
System: Budget Makanan Rp 600k untuk September
Period: 1 Sep - 30 Sep (only 2 days left!)
Transaction 1 Oct: NOT COUNTED ❌
\\\

**After Fix:**
\\\
User: (creates budget 29 Sep, chooses "30 Hari")
System: Budget Makanan Rp 600k untuk 30 hari
Period: 29 Sep - 28 Okt (30 days)
Transaction 1 Oct: COUNTED ✅
Transaction 2 Okt: COUNTED ✅
\\\

## Next Steps

Would you like me to:
1. **Continue with automated implementation** - I'll complete the remaining tasks
2. **Manual implementation** - You implement based on this task list
3. **Review and adjust** - Discuss any changes to the design first

Choose option to proceed.
