# Budget Rolling Period - Requirements

**Problem:** User membuat budget di tanggal 29 September, tetapi budget hanya berlaku sampai 30 September (akhir bulan kalender). Transaksi di bulan berikutnya (Oktober) tidak terhitung dalam budget tersebut.

**Current Behavior:**
- Budget periode: Calendar month (1 Sep - 30 Sep)
- User membuat budget 29 Sep → hanya berlaku 2 hari
- Transaksi 1-2 Okt tidak terhitung karena budget sudah berakhir

**User Request:**
"Apakah kamu bisa memperbaiki sistem nya bahwa budgeting ini dimulai dengan tanggal bukan bulan sehingga jika pengguna membuat budgeting di akhir bulan maka budgeting tersebut tidak kadaluarsa di bulan berikutnya"

---

## Proposed Solution: Rolling Period Budget

### Option 1: 30-Day Rolling Period (Recommended)
Budget berlaku 30 hari dari tanggal pembuatan:
- Dibuat 29 Sep → berlaku 29 Sep sampai 28 Okt
- Dibuat 15 Okt → berlaku 15 Okt sampai 13 Nov

**Pros:**
- Fleksibel, user tidak perlu tunggu awal bulan
- Konsisten (selalu 30 hari)
- Cocok untuk budgeting yang dibuat kapan saja

**Cons:**
- Berbeda dari mental model "budget bulanan"
- Perlu UI yang jelas menunjukkan periode (29 Sep - 28 Okt)

### Option 2: Current Month + Next Month (Hybrid)
Jika budget dibuat di pertengahan/akhir bulan, extend ke bulan berikutnya:
- Dibuat 1-15 bulan ini → periode: bulan ini saja
- Dibuat 16-akhir bulan ini → periode: sisa bulan ini + bulan depan penuh

**Pros:**
- Tetap berbasis bulan kalender
- User yang buat budget akhir bulan tidak rugi

**Cons:**
- Logika lebih kompleks
- Inkonsisten (kadang 1 bulan, kadang 1.5 bulan)

### Option 3: Always Start From Next Month
Budget yang dibuat bulan ini berlaku mulai bulan depan:
- Dibuat 29 Sep → berlaku 1 Okt - 31 Okt

**Pros:**
- Simple, konsisten
- Encourage planning ahead

**Cons:**
- Tidak solve masalah user (transaksi 29-30 Sep tetap tidak terhitung)

---

## Recommended: Option 1 (30-Day Rolling)

### UI Changes Needed:

**Budget Creation:**
\\\
Buat Budget Baru

Kategori: Makanan & Minuman
Jumlah: Rp 600.000
Periode: 30 hari (29 Sep - 28 Okt) ← Auto-calculated
\\\

**Budget Display (Dashboard):**
\\\
🍔 Budget Makanan & Minuman
Periode: 29 Sep - 28 Okt (masih 15 hari)
Terpakai: Rp 76.000 / Rp 600.000 (12.7%)
Sisa: Rp 524.000
\\\

**WhatsApp Response:**
\\\
🍔 Status Budget Makanan & Minuman

• Batas Anggaran: Rp 600.000
• Sudah Terpakai: Rp 76.000 (12.7%)
• Sisa Kuota: Rp 524.000
• Periode: 29 Sep - 28 Okt (masih 15 hari)

Status: ✅ Aman (Tersisa 87.3% kuota)
\\\

---

## Database Changes

### Current Schema:
\\\sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL,
  account_id UUID,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'IDR',
  period_year INT NOT NULL,    -- Currently: calendar year
  period_month INT NOT NULL,   -- Currently: calendar month (1-12)
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  ...
);
\\\

### Proposed Change:
**Keep existing fields** but change semantics:
- \start_date\: Tanggal pembuatan budget (or user-specified start)
- \end_date\: start_date + 30 days
- \period_year\, \period_month\: **Deprecated** (keep for backward compatibility, but use start_date/end_date as source of truth)

**Migration:**
- Existing budgets: keep as-is (calendar month)
- New budgets: use rolling 30-day period
- Or: migrate all existing budgets to set start_date = first day of month

---

## Implementation Plan

### Phase 1: Core Logic
1. Update \BudgetService.createBudget()\
   - Calculate \end_date = start_date + 30 days\
   - Set \start_date\ to current date (or user input)

2. Update \ggregateSpending()\
   - Already uses \start_date\ and \end_date\ ✅
   - No changes needed

3. Update \indApplicableBudget()\
   - Already uses date ranges ✅
   - No changes needed

### Phase 2: UI Updates
1. Dashboard budget display
   - Show "29 Sep - 28 Okt" instead of "September 2026"
   - Add remaining days indicator

2. Budget creation form
   - Show calculated period preview
   - Optional: allow user to set custom start date

3. WhatsApp responses
   - Update budget status message to show period
   - Add "masih X hari" indicator

### Phase 3: Migration (Optional)
- Convert existing calendar-month budgets to rolling periods
- Or: keep old budgets as-is, only apply to new budgets

---

## Breaking Changes

**Minimal Breaking Changes:**
- Existing budgets continue to work (use existing start_date/end_date)
- New budgets use rolling 30-day logic
- UI shows date ranges instead of month names

**User Experience:**
- **Before:** "Budget September" (confusing when created on Sep 29)
- **After:** "Budget 29 Sep - 28 Okt" (clear period)

---

## Alternative: Let User Choose

Add budget type option:
1. **Calendar Month Budget** (current behavior)
   - Good for monthly salary budgeting
   - E.g., "Budget Makan bulan Oktober"

2. **Rolling Period Budget** (new feature)
   - Good for flexible budgeting
   - E.g., "Budget Makan 30 hari ke depan"

**Implementation:**
\\\	ypescript
type BudgetPeriodType = 'CALENDAR_MONTH' | 'ROLLING_30_DAYS';

interface Budget {
  periodType: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
}
\\\

This gives users flexibility while maintaining backward compatibility.

---

## User Confirmation Needed

Before implementing, user should choose:

**A. Always rolling 30-day (recommended for your use case)**
- Simple, consistent
- Every budget lasts exactly 30 days from creation

**B. Let user choose per budget (calendar vs rolling)**
- More flexible
- More complex UI

**C. Auto-detect: if created after day 15 → rolling, otherwise → calendar month**
- Smart default
- May be confusing

Which option do you prefer?
