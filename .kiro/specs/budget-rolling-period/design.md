# Budget Rolling Period - Design Document

**Selected Option:** B - User Pilih Sendiri (Fleksibel)

User dapat memilih tipe periode budget saat pembuatan:
1. **Calendar Month Budget** - Budget berbasis bulan kalender (existing behavior)
2. **Rolling Period Budget** - Budget berbasis 30 hari dari tanggal pembuatan (new feature)

---

## 1. Database Schema Changes

### Add New Column: \period_type\

\\\sql
ALTER TABLE budgets 
ADD COLUMN period_type TEXT NOT NULL DEFAULT 'CALENDAR_MONTH';

-- Valid values: 'CALENDAR_MONTH' | 'ROLLING_30_DAYS' | 'ROLLING_7_DAYS' | 'ROLLING_90_DAYS'
\\\

**Migration Strategy:**
- Existing budgets: \period_type = 'CALENDAR_MONTH'\ (preserve current behavior)
- New budgets: user chooses at creation time

### Schema Definition (Updated)

\\\	ypescript
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("IDR").notNull(),
  
  // NEW: Period type determines how start_date and end_date are calculated
  periodType: text("period_type", { 
    enum: ["CALENDAR_MONTH", "ROLLING_30_DAYS", "ROLLING_7_DAYS", "ROLLING_90_DAYS"] 
  }).notNull().default("CALENDAR_MONTH"),
  
  // Deprecated for new budgets, kept for backward compatibility
  periodYear: integer("period_year"),
  periodMonth: integer("period_month"),
  
  // Source of truth for budget period
  startDate: timestamp("start_date", { mode: "date", withTimezone: false }).notNull(),
  endDate: timestamp("end_date", { mode: "date", withTimezone: false }).notNull(),
  
  createdAt: timestamp("created_at", { mode: "date", withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: false }).defaultNow().notNull(),
});
\\\

---

## 2. Period Calculation Logic

### Calendar Month Budget (Existing)

\\\	ypescript
function calculateCalendarMonthPeriod(creationDate: Date): { startDate: Date; endDate: Date } {
  const year = creationDate.getFullYear();
  const month = creationDate.getMonth(); // 0-indexed
  
  // Start: 1st day of current month, Jakarta midnight
  const startLocal = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const startDate = new Date(startLocal.getTime() - JAKARTA_OFFSET_MS);
  
  // End: 1st day of next month, Jakarta midnight (exclusive)
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const endLocal = new Date(Date.UTC(nextYear, nextMonth, 1, 0, 0, 0, 0));
  const endDate = new Date(endLocal.getTime() - JAKARTA_OFFSET_MS);
  
  return { startDate, endDate };
}
\\\

### Rolling Period Budget (New)

\\\	ypescript
function calculateRollingPeriod(
  creationDate: Date, 
  durationDays: 30 | 7 | 90
): { startDate: Date; endDate: Date } {
  // Start: creation date Jakarta midnight
  const jakartaDate = new Date(creationDate.getTime() + JAKARTA_OFFSET_MS);
  const startLocal = new Date(Date.UTC(
    jakartaDate.getFullYear(),
    jakartaDate.getMonth(),
    jakartaDate.getDate(),
    0, 0, 0, 0
  ));
  const startDate = new Date(startLocal.getTime() - JAKARTA_OFFSET_MS);
  
  // End: start + durationDays
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  return { startDate, endDate };
}
\\\

---

## 3. API Changes

### Create Budget Input Schema

\\\	ypescript
// schemas/budget.schema.ts

export const CreateBudgetInputSchema = z.object({
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default("IDR"),
  
  // NEW: Period type selection
  periodType: z.enum(["CALENDAR_MONTH", "ROLLING_30_DAYS", "ROLLING_7_DAYS", "ROLLING_90_DAYS"])
    .default("CALENDAR_MONTH"),
  
  // Optional: explicit start date (defaults to today)
  startDate: z.string().optional(), // "YYYY-MM-DD"
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetInputSchema>;
\\\

### BudgetService.createBudget() Update

\\\	ypescript
async createBudget(userId: string, input: CreateBudgetInput): Promise<Budget> {
  const now = new Date();
  const creationDate = input.startDate 
    ? jakartaDateStringToUtc(input.startDate) 
    : now;
  
  let startDate: Date;
  let endDate: Date;
  let periodYear: number | null = null;
  let periodMonth: number | null = null;
  
  switch (input.periodType) {
    case "CALENDAR_MONTH": {
      const period = calculateCalendarMonthPeriod(creationDate);
      startDate = period.startDate;
      endDate = period.endDate;
      
      // Keep period_year and period_month for backward compatibility
      const jakartaStart = new Date(startDate.getTime() + JAKARTA_OFFSET_MS);
      periodYear = jakartaStart.getUTCFullYear();
      periodMonth = jakartaStart.getUTCMonth() + 1;
      break;
    }
    
    case "ROLLING_30_DAYS": {
      const period = calculateRollingPeriod(creationDate, 30);
      startDate = period.startDate;
      endDate = period.endDate;
      break;
    }
    
    case "ROLLING_7_DAYS": {
      const period = calculateRollingPeriod(creationDate, 7);
      startDate = period.startDate;
      endDate = period.endDate;
      break;
    }
    
    case "ROLLING_90_DAYS": {
      const period = calculateRollingPeriod(creationDate, 90);
      startDate = period.startDate;
      endDate = period.endDate;
      break;
    }
  }
  
  // Check for overlapping budgets in the same category/account/period
  const hasOverlap = await this.hasOverlappingBudget(
    userId,
    input.categoryId,
    input.accountId,
    startDate,
    endDate
  );
  
  if (hasOverlap) {
    throw new Error(
      "Budget dengan kategori dan periode yang sama sudah ada. " +
      "Hapus budget lama atau gunakan periode berbeda."
    );
  }
  
  const [budget] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId: input.categoryId,
      accountId: input.accountId,
      amount: input.amount.toString(),
      currency: input.currency,
      periodType: input.periodType,
      periodYear,
      periodMonth,
      startDate,
      endDate,
    })
    .returning();
  
  return budget;
}
\\\

---

## 4. UI/UX Changes

### Budget Creation Form (Dashboard)

\\\	sx
// app/dashboard/budget/create/page.tsx

<form>
  <Select name="categoryId" label="Kategori">
    <option value="food-id">Makanan & Minuman</option>
    {/* ... */}
  </Select>
  
  <Input name="amount" label="Jumlah Budget" type="number" />
  
  {/* NEW: Period Type Selector */}
  <RadioGroup name="periodType" label="Tipe Periode Budget">
    <Radio value="CALENDAR_MONTH">
      <strong>Budget Bulanan</strong>
      <p className="text-sm text-gray-600">
        Berlaku untuk bulan kalender (1-30/31 bulan ini)
      </p>
      <p className="text-xs text-gray-500">
        Contoh: Budget Oktober (1 Okt - 31 Okt)
      </p>
    </Radio>
    
    <Radio value="ROLLING_30_DAYS">
      <strong>Budget 30 Hari</strong>
      <p className="text-sm text-gray-600">
        Berlaku 30 hari dari sekarang
      </p>
      <p className="text-xs text-gray-500">
        Contoh: 3 Okt - 1 Nov
      </p>
    </Radio>
    
    <Radio value="ROLLING_7_DAYS">
      <strong>Budget Mingguan (7 Hari)</strong>
      <p className="text-sm text-gray-600">
        Untuk budget jangka pendek
      </p>
    </Radio>
    
    <Radio value="ROLLING_90_DAYS">
      <strong>Budget Kuartalan (90 Hari)</strong>
      <p className="text-sm text-gray-600">
        Untuk budget jangka panjang
      </p>
    </Radio>
  </RadioGroup>
  
  {/* Optional: Custom Start Date */}
  <Input 
    name="startDate" 
    label="Tanggal Mulai (Opsional)" 
    type="date"
    helperText="Kosongkan untuk mulai hari ini"
  />
  
  <Button type="submit">Buat Budget</Button>
</form>
\\\

### Budget Display (Dashboard)

\\\	sx
// Show period type badge and date range

<Card>
  <CardHeader>
    <div className="flex justify-between items-start">
      <div>
        <h3>🍔 Makanan & Minuman</h3>
        <Badge variant={budget.periodType === "CALENDAR_MONTH" ? "default" : "secondary"}>
          {budget.periodType === "CALENDAR_MONTH" && "Budget Bulanan"}
          {budget.periodType === "ROLLING_30_DAYS" && "30 Hari"}
          {budget.periodType === "ROLLING_7_DAYS" && "7 Hari"}
          {budget.periodType === "ROLLING_90_DAYS" && "90 Hari"}
        </Badge>
      </div>
      <p className="text-sm text-gray-600">
        {formatDate(budget.startDate)} - {formatDate(budget.endDate)}
      </p>
    </div>
  </CardHeader>
  
  <CardContent>
    <ProgressBar value={budget.usagePercentage} max={100} />
    <p>Terpakai: Rp {formatRupiah(budget.spentAmount)} / Rp {formatRupiah(budget.limitAmount)}</p>
    <p>Sisa: Rp {formatRupiah(budget.remainingAmount)} ({remainingDays} hari lagi)</p>
  </CardContent>
</Card>
\\\

### WhatsApp Budget Status

\\\	ypescript
// services/whatsapp/budget-query.service.ts

function formatBudgetPeriodInfo(budget: BudgetProgressDTO): string {
  const startStr = formatIndonesianDate(budget.startDate); // "29 Sep"
  const endStr = formatIndonesianDate(budget.endDate);     // "28 Okt"
  const remainingDays = Math.ceil(
    (budget.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  
  let periodLabel = "";
  switch (budget.periodType) {
    case "CALENDAR_MONTH":
      periodLabel = "Budget Bulanan";
      break;
    case "ROLLING_30_DAYS":
      periodLabel = "Budget 30 Hari";
      break;
    case "ROLLING_7_DAYS":
      periodLabel = "Budget Mingguan";
      break;
    case "ROLLING_90_DAYS":
      periodLabel = "Budget Kuartalan";
      break;
  }
  
  return (
    \• Tipe: *\*\n\ +
    \• Periode: \ - \ (\ hari lagi)\n\
  );
}

// Updated WhatsApp response:
\\\	ext
🍔 Status Budget Makanan & Minuman

• Batas Anggaran: Rp 600.000
• Sudah Terpakai: Rp 76.000 (12.7%)
• Sisa Kuota: Rp 524.000

• Tipe: *Budget 30 Hari*
• Periode: 29 Sep - 28 Okt (25 hari lagi)

Status: ✅ Aman (Tersisa 87.3% kuota)

Setiap Anda catat pengeluaran di WA, sisa kuota ini akan otomatis berkurang.
\\\
\\\

---

## 5. Backward Compatibility

### Existing Budgets
- All existing budgets have \periodType = 'CALENDAR_MONTH'\ (via migration default)
- They continue to work exactly as before
- \periodYear\ and \periodMonth\ are still populated for calendar month budgets

### Migration SQL

\\\sql
-- Step 1: Add column with default
ALTER TABLE budgets 
ADD COLUMN period_type TEXT NOT NULL DEFAULT 'CALENDAR_MONTH';

-- Step 2: Verify all existing budgets have the default value
SELECT COUNT(*) FROM budgets WHERE period_type = 'CALENDAR_MONTH';
-- Expected: count = total number of existing budgets

-- Step 3: Add check constraint (optional)
ALTER TABLE budgets
ADD CONSTRAINT period_type_check 
CHECK (period_type IN ('CALENDAR_MONTH', 'ROLLING_30_DAYS', 'ROLLING_7_DAYS', 'ROLLING_90_DAYS'));
\\\

---

## 6. Edge Cases

### Case 1: User Creates Budget on Last Day of Month

**Calendar Month Budget:**
- Created: 31 Okt
- Period: 31 Okt - 31 Okt (1 hari saja)
- ⚠️ Warning shown: "Budget hanya berlaku 1 hari. Pertimbangkan gunakan Budget 30 Hari."

**Rolling 30 Days Budget:**
- Created: 31 Okt
- Period: 31 Okt - 29 Nov (30 hari penuh)
- ✅ Works as expected

### Case 2: Overlapping Budgets

**Scenario:**
- Budget A: Makanan, Calendar Month, 1 Okt - 31 Okt
- Budget B: Makanan, Rolling 30 Days, 15 Okt - 13 Nov

**Result:**
- ❌ Rejected - overlapping periods (15-31 Okt overlap)
- User must delete Budget A or wait until Nov 1 to create Budget B

**Alternative:** Allow overlapping but show warning:
- "Anda sudah punya budget Makanan aktif (1-31 Okt). Budget baru akan overlap 15 hari. Lanjutkan?"

### Case 3: Budget Auto-Renewal

**Future Feature (not in initial implementation):**
- Add \uto_renew\ flag
- When rolling 30-day budget expires, auto-create new one with same amount
- E.g., \uto_renew = true\ → infinite rolling budget

---

## 7. Implementation Checklist

### Backend
- [ ] Add \period_type\ column to budgets table
- [ ] Create migration SQL
- [ ] Update \CreateBudgetInputSchema\ to include \periodType\
- [ ] Implement \calculateRollingPeriod()\ function
- [ ] Update \BudgetService.createBudget()\ to handle period type
- [ ] Update \BudgetProgressDTO\ to include \periodType\
- [ ] Update WhatsApp budget status to show period type and remaining days
- [ ] Add tests for rolling period budget creation

### Frontend
- [ ] Update budget creation form with period type selector
- [ ] Add period type badge to budget display
- [ ] Show remaining days indicator
- [ ] Add warning for calendar month budgets created near end of month
- [ ] Update budget list to show date ranges instead of "Oktober 2026"

### Testing
- [ ] Test calendar month budget (existing behavior)
- [ ] Test rolling 30-day budget
- [ ] Test overlapping budget detection
- [ ] Test budget created on last day of month
- [ ] Test spending aggregation across rolling periods
- [ ] Test WhatsApp budget status display

---

## 8. User Guidance

### When to Use Calendar Month Budget
- ✅ Gaji bulanan, ingin budget per bulan kalender
- ✅ Budget dimulai awal bulan (tanggal 1-10)
- ✅ Ingin budget align dengan laporan keuangan bulanan

### When to Use Rolling Period Budget
- ✅ Budget dibuat pertengahan/akhir bulan
- ✅ Ingin fleksibilitas mulai kapan saja
- ✅ Budget tidak terikat kalender (e.g., "budget 30 hari ke depan")

### Default Recommendation in UI
\\\
Rekomendasi sistem:
- Hari ini tanggal 
- Jika < 10: Gunakan "Budget Bulanan" ✅
- Jika >= 10: Gunakan "Budget 30 Hari" ✅
\\\

---

## Next Steps

1. Review design with user
2. Create migration SQL
3. Implement backend changes
4. Update frontend UI
5. Test thoroughly
6. Deploy to production
