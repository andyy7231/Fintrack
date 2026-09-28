import { db } from "@/lib/db";
import { transactions, accounts, categories, transfers } from "@/db/schema";
import { eq, and, sql, gte, lt, or, isNull, desc, SQL } from "drizzle-orm";
import { ReportFilterInput } from "@/schemas/report.schema";
import {
  resolveReportPeriod,
  ResolvedReportPeriod,
  formatJakartaDateTime,
  JAKARTA_OFFSET_MS,
} from "@/lib/utils/report-date";
import * as XLSX from "xlsx";

// ─── DTO Types ─────────────────────────────────────────────────────────────────

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  savingsRate: number; // percentage (e.g. 25.5 for 25.5%)
  transactionCount: number;
  totalTransfers: number;
  transfersCount: number;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  type: "INCOME" | "EXPENSE";
  amount: number;
  percentage: number;
}

export interface AccountBreakdownItem {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
}

export interface TimeSeriesPoint {
  date: string; // "YYYY-MM-DD" or "YYYY-MM"
  label: string; // e.g. "1 Sep" or "Sep 2026"
  income: number;
  expense: number;
  net: number;
}

export interface FinancialReportDTO {
  period: ResolvedReportPeriod;
  summary: ReportSummary;
  categoryBreakdown: {
    expense: CategoryBreakdownItem[];
    income: CategoryBreakdownItem[];
  };
  accountBreakdown: AccountBreakdownItem[];
  timeSeries: TimeSeriesPoint[];
}

export interface ExportTransactionRow {
  date: string;
  type: string;
  description: string;
  category: string;
  account: string;
  amount: string;
  source: string;
  status: string;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class ReportService {
  /**
   * Validate account and category ownership for filter safety (anti-IDOR).
   */
  private static async validateFilters(
    userId: string,
    filter: ReportFilterInput
  ): Promise<void> {
    if (filter.accountId) {
      const [acc] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, filter.accountId), eq(accounts.userId, userId)));
      if (!acc) {
        throw new Error("Akun tidak ditemukan atau bukan milik Anda.");
      }
    }

    if (filter.categoryId) {
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, filter.categoryId),
            or(eq(categories.userId, userId), isNull(categories.userId))
          )
        );
      if (!cat) {
        throw new Error("Kategori tidak ditemukan atau bukan milik Anda.");
      }
    }
  }

  /**
   * Build common WHERE conditions for transactions.
   */
  private static buildTransactionConditions(
    userId: string,
    period: ResolvedReportPeriod,
    filter: ReportFilterInput
  ): SQL[] {
    const conditions: SQL[] = [
      eq(transactions.userId, userId),
      eq(transactions.status, "CONFIRMED"),
      gte(transactions.transactionDate, period.startUtc),
      lt(transactions.transactionDate, period.endExclusiveUtc),
    ];

    if (filter.accountId) {
      conditions.push(eq(transactions.accountId, filter.accountId));
    }
    if (filter.categoryId) {
      conditions.push(eq(transactions.categoryId, filter.categoryId));
    }
    if (filter.type) {
      conditions.push(eq(transactions.type, filter.type));
    }

    return conditions;
  }

  /**
   * 1. Get Summary (Total Income, Total Expense, Net Cash Flow, Savings Rate)
   */
  static async getReportSummary(
    userId: string,
    filter: ReportFilterInput,
    resolvedPeriod?: ResolvedReportPeriod
  ): Promise<ReportSummary> {
    await this.validateFilters(userId, filter);
    const period = resolvedPeriod || resolveReportPeriod(filter);
    const conditions = this.buildTransactionConditions(userId, period, filter);

    const [txSummary] = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'INCOME' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'EXPENSE' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
        txCount: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(and(...conditions));

    const totalIncome = parseFloat(txSummary?.totalIncome || "0.00");
    const totalExpense = parseFloat(txSummary?.totalExpense || "0.00");
    const netCashFlow = Math.round((totalIncome - totalExpense) * 100) / 100;
    const savingsRate =
      totalIncome > 0
        ? Math.round(((netCashFlow / totalIncome) * 100) * 100) / 100
        : 0;

    // Transfers query (strictly informative, transfers do not alter income/expense/net cash flow)
    const [transferSummary] = await db
      .select({
        totalTransfers: sql<string>`COALESCE(SUM(${transfers.amount}), '0.00')`,
        transferCount: sql<number>`count(*)::int`,
      })
      .from(transfers)
      .where(
        and(
          eq(transfers.userId, userId),
          gte(transfers.transferDate, period.startUtc),
          lt(transfers.transferDate, period.endExclusiveUtc)
        )
      );

    const totalTransfers = parseFloat(transferSummary?.totalTransfers || "0.00");
    const transfersCount = transferSummary?.transferCount || 0;

    return {
      totalIncome,
      totalExpense,
      netCashFlow,
      savingsRate,
      transactionCount: txSummary?.txCount || 0,
      totalTransfers,
      transfersCount,
    };
  }

  /**
   * 2. Get Category Breakdown (Expense & Income)
   */
  static async getCategoryBreakdown(
    userId: string,
    filter: ReportFilterInput,
    resolvedPeriod?: ResolvedReportPeriod
  ): Promise<{ expense: CategoryBreakdownItem[]; income: CategoryBreakdownItem[] }> {
    await this.validateFilters(userId, filter);
    const period = resolvedPeriod || resolveReportPeriod(filter);
    const conditions = this.buildTransactionConditions(userId, period, filter);

    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        type: transactions.type,
        amount: sql<string>`COALESCE(SUM(${transactions.amount}), '0.00')`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(
        transactions.categoryId,
        categories.name,
        categories.color,
        categories.icon,
        transactions.type
      );

    const expenseRows = rows.filter((r) => r.type === "EXPENSE");
    const incomeRows = rows.filter((r) => r.type === "INCOME");

    const totalExpense = expenseRows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const totalIncome = incomeRows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    const mapBreakdown = (
      items: typeof rows,
      total: number,
      targetType: "INCOME" | "EXPENSE"
    ): CategoryBreakdownItem[] => {
      return items
        .map((r) => {
          const amt = parseFloat(r.amount);
          const pct = total > 0 ? Math.round(((amt / total) * 100) * 100) / 100 : 0;
          return {
            categoryId: r.categoryId,
            categoryName: r.categoryName || "Tanpa Kategori",
            categoryColor: r.categoryColor,
            categoryIcon: r.categoryIcon,
            type: targetType,
            amount: amt,
            percentage: pct,
          };
        })
        .sort((a, b) => b.amount - a.amount);
    };

    return {
      expense: mapBreakdown(expenseRows, totalExpense, "EXPENSE"),
      income: mapBreakdown(incomeRows, totalIncome, "INCOME"),
    };
  }

  /**
   * 3. Get Account Breakdown (Income, Expense, Net per Account)
   */
  static async getAccountBreakdown(
    userId: string,
    filter: ReportFilterInput,
    resolvedPeriod?: ResolvedReportPeriod
  ): Promise<AccountBreakdownItem[]> {
    await this.validateFilters(userId, filter);
    const period = resolvedPeriod || resolveReportPeriod(filter);
    const conditions = this.buildTransactionConditions(userId, period, filter);

    const rows = await db
      .select({
        accountId: transactions.accountId,
        accountName: accounts.name,
        accountType: accounts.type,
        currency: accounts.currency,
        income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'INCOME' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
        expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'EXPENSE' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .groupBy(transactions.accountId, accounts.name, accounts.type, accounts.currency);

    return rows
      .map((r) => {
        const income = parseFloat(r.income);
        const expense = parseFloat(r.expense);
        return {
          accountId: r.accountId,
          accountName: r.accountName,
          accountType: r.accountType,
          currency: r.currency,
          income,
          expense,
          net: Math.round((income - expense) * 100) / 100,
        };
      })
      .sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }

  /**
   * 4. Get Time Series (Daily or Monthly server-side aggregation with zero-fill)
   */
  static async getTimeSeries(
    userId: string,
    filter: ReportFilterInput,
    resolvedPeriod?: ResolvedReportPeriod
  ): Promise<TimeSeriesPoint[]> {
    await this.validateFilters(userId, filter);
    const period = resolvedPeriod || resolveReportPeriod(filter);
    const conditions = this.buildTransactionConditions(userId, period, filter);

    const isDaily = period.granularity === "daily";

    // SQL expression converting stored UTC timestamp to Jakarta Date
    // transactions.transaction_date + interval '7 hours'
    const dateGroupingSql = isDaily
      ? sql<string>`to_char(${transactions.transactionDate} + interval '7 hours', 'YYYY-MM-DD')`
      : sql<string>`to_char(${transactions.transactionDate} + interval '7 hours', 'YYYY-MM')`;

    const rows = await db
      .select({
        periodKey: dateGroupingSql,
        income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'INCOME' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
        expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'EXPENSE' THEN ${transactions.amount} ELSE 0 END), '0.00')`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(dateGroupingSql)
      .orderBy(dateGroupingSql);

    const lookup = new Map<string, { income: number; expense: number }>();
    rows.forEach((r) => {
      lookup.set(r.periodKey, {
        income: parseFloat(r.income),
        expense: parseFloat(r.expense),
      });
    });

    const result: TimeSeriesPoint[] = [];

    if (isDaily) {
      // Zero-fill each day between startUtc and endExclusiveUtc
      let current = new Date(period.startUtc.getTime() + JAKARTA_OFFSET_MS);
      const endLimit = new Date(period.endExclusiveUtc.getTime() + JAKARTA_OFFSET_MS);

      while (current < endLimit) {
        const y = current.getUTCFullYear();
        const m = String(current.getUTCMonth() + 1).padStart(2, "0");
        const d = String(current.getUTCDate()).padStart(2, "0");
        const key = `${y}-${m}-${d}`;

        const found = lookup.get(key) || { income: 0, expense: 0 };
        const label = current.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        });

        result.push({
          date: key,
          label,
          income: found.income,
          expense: found.expense,
          net: Math.round((found.income - found.expense) * 100) / 100,
        });

        // Next calendar day
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      // Monthly zero-fill
      const [startYear, startMonth] = period.startDate.split("-").map(Number);
      const [endYear, endMonth] = period.endDate.split("-").map(Number);

      let curY = startYear;
      let curM = startMonth;

      while (curY < endYear || (curY === endYear && curM <= endMonth)) {
        const key = `${curY}-${String(curM).padStart(2, "0")}`;
        const found = lookup.get(key) || { income: 0, expense: 0 };

        const dObj = new Date(Date.UTC(curY, curM - 1, 1));
        const label = dObj.toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });

        result.push({
          date: key,
          label,
          income: found.income,
          expense: found.expense,
          net: Math.round((found.income - found.expense) * 100) / 100,
        });

        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }
    }

    return result;
  }

  /**
   * 5. Get Comprehensive Financial Report
   */
  static async getFinancialReport(
    userId: string,
    filter: ReportFilterInput
  ): Promise<FinancialReportDTO> {
    await this.validateFilters(userId, filter);
    const period = resolveReportPeriod(filter);

    const [summary, categoryBreakdown, accountBreakdown, timeSeries] =
      await Promise.all([
        this.getReportSummary(userId, filter, period),
        this.getCategoryBreakdown(userId, filter, period),
        this.getAccountBreakdown(userId, filter, period),
        this.getTimeSeries(userId, filter, period),
      ]);

    return {
      period,
      summary,
      categoryBreakdown,
      accountBreakdown,
      timeSeries,
    };
  }

  /**
   * 6. Fetch Raw Filtered Transactions for Export (Safety capped at 5000 rows)
   */
  static async getTransactionsForExport(
    userId: string,
    filter: ReportFilterInput,
    limit = 5000
  ): Promise<ExportTransactionRow[]> {
    await this.validateFilters(userId, filter);
    const period = resolveReportPeriod(filter);
    const conditions = this.buildTransactionConditions(userId, period, filter);

    const rows = await db
      .select({
        id: transactions.id,
        transactionDate: transactions.transactionDate,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        source: transactions.source,
        status: transactions.status,
        categoryName: categories.name,
        accountName: accounts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      date: formatJakartaDateTime(r.transactionDate),
      type: r.type,
      description: r.description,
      category: r.categoryName || "Tanpa Kategori",
      account: r.accountName,
      amount: r.amount,
      source: r.source,
      status: r.status,
    }));
  }

  /**
   * 7. Export to CSV string with RFC-4180 escaping and UTF-8 BOM
   */
  static async exportToCsv(
    userId: string,
    filter: ReportFilterInput
  ): Promise<{ filename: string; csvContent: string }> {
    const period = resolveReportPeriod(filter);
    const rawTxns = await this.getTransactionsForExport(userId, filter);

    const escapeCsv = (val: string): string => {
      if (val.includes('"') || val.includes(",") || val.includes("\n") || val.includes("\r")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = [
      "Tanggal (WIB)",
      "Tipe",
      "Deskripsi",
      "Kategori",
      "Akun",
      "Nominal (Rp)",
      "Sumber",
      "Status",
    ];

    const lines: string[] = [headers.join(",")];

    for (const tx of rawTxns) {
      lines.push(
        [
          escapeCsv(tx.date),
          escapeCsv(tx.type),
          escapeCsv(tx.description),
          escapeCsv(tx.category),
          escapeCsv(tx.account),
          escapeCsv(tx.amount),
          escapeCsv(tx.source),
          escapeCsv(tx.status),
        ].join(",")
      );
    }

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const filename = `financial-report-${period.startDate}-to-${period.endDate}.csv`;

    return { filename, csvContent };
  }

  /**
   * 8. Export to XLSX buffer with 4 dedicated sheets (Summary, Transactions, Categories, Accounts)
   */
  static async exportToXlsx(
    userId: string,
    filter: ReportFilterInput
  ): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.getFinancialReport(userId, filter);
    const rawTxns = await this.getTransactionsForExport(userId, filter);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ["LAPORAN KEUANGAN FINTRACK"],
      ["Periode", `${report.period.startDate} s/d ${report.period.endDate} (Asia/Jakarta)`],
      ["Tanggal Ekspor", formatJakartaDateTime(new Date())],
      [],
      ["RINGKASAN", "NOMINAL"],
      ["Total Pemasukan", report.summary.totalIncome],
      ["Total Pengeluaran", report.summary.totalExpense],
      ["Net Cash Flow", report.summary.netCashFlow],
      ["Savings Rate", `${report.summary.savingsRate}%`],
      ["Jumlah Transaksi", report.summary.transactionCount],
      ["Total Transfer Antar Akun", report.summary.totalTransfers],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Sheet 2: Transactions
    const txHeaders = [
      "Tanggal (WIB)",
      "Tipe",
      "Deskripsi",
      "Kategori",
      "Akun",
      "Nominal (IDR)",
      "Sumber",
      "Status",
    ];
    const txRows = rawTxns.map((t) => [
      t.date,
      t.type,
      t.description,
      t.category,
      t.account,
      parseFloat(t.amount),
      t.source,
      t.status,
    ]);
    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
    XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

    // Sheet 3: Category Breakdown
    const catHeaders = ["Tipe", "Kategori", "Total Nominal (IDR)", "Persentase (%)"];
    const catRows = [
      ...report.categoryBreakdown.expense.map((c) => [
        "EXPENSE",
        c.categoryName,
        c.amount,
        c.percentage,
      ]),
      ...report.categoryBreakdown.income.map((c) => [
        "INCOME",
        c.categoryName,
        c.amount,
        c.percentage,
      ]),
    ];
    const wsCat = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    XLSX.utils.book_append_sheet(wb, wsCat, "Category Breakdown");

    // Sheet 4: Account Breakdown
    const accHeaders = ["Nama Akun", "Tipe Akun", "Mata Uang", "Pemasukan", "Pengeluaran", "Net"];
    const accRows = report.accountBreakdown.map((a) => [
      a.accountName,
      a.accountType,
      a.currency,
      a.income,
      a.expense,
      a.net,
    ]);
    const wsAcc = XLSX.utils.aoa_to_sheet([accHeaders, ...accRows]);
    XLSX.utils.book_append_sheet(wb, wsAcc, "Account Breakdown");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = `financial-report-${report.period.startDate}-to-${report.period.endDate}.xlsx`;

    return { filename, buffer };
  }
}
