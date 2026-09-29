import { parseIndonesianAmount } from "@/services/ai/amount.utils";
import { AccountService } from "@/services/account.service";
import { CategoryService } from "@/services/category.service";
import { TransactionService } from "@/services/transaction.service";
import { BudgetService } from "@/services/budget.service";
import { GoalService } from "@/services/goal.service";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(amount));
}

interface AllocationItem {
  target: string;
  categoryType: "EXPENSE" | "SAVING";
  percentage?: number;
  fixedAmount?: number;
  calculatedAmount: number;
  matchedCategoryName?: string;
  matchedCategoryId?: string;
  matchedCategoryIcon?: string;
}

export class SalaryAllocationService {
  /**
   * Determine if message is an instruction to record income and allocate budgets/savings
   */
  static isSalaryAllocation(rawText: string): boolean {
    const text = rawText.toLowerCase().trim();

    // Multi-line messages or messages containing explicit items ("budget", "bayar", "biaya", "kurangan", "paylater")
    // must go through the FinancialParserService batch parser, NOT this single-shot service!
    if (text.includes("\n")) return false;
    if (
      text.includes("budget ") ||
      text.includes("bayar ") ||
      text.includes("biaya ") ||
      text.includes("beli ") ||
      text.includes("tagihan ") ||
      text.includes("kurangan ")
    ) {
      return false;
    }

    const hasIncomeWord =
      text.includes("gaji") ||
      text.includes("gajian") ||
      text.includes("pemasukan") ||
      text.includes("income") ||
      text.includes("penghasilan");

    const hasSplitWord =
      text.includes("bagi") ||
      text.includes("dibagi") ||
      text.includes("alokasi") ||
      text.includes("alokasikan") ||
      text.includes("pos") ||
      text.includes("%") ||
      text.includes("persen");

    const hasDigits = /\d/.test(text);

    return hasIncomeWord && hasSplitWord && hasDigits;
  }

  /**
   * Process salary allocation command and execute financial changes
   */
  static async handleSalaryAllocation(userId: string, rawText: string): Promise<string> {
    const text = rawText.toLowerCase().trim();

    // 1. Extract total income amount
    const totalAmount = this.extractTotalAmount(text);
    if (!totalAmount || totalAmount <= 0) {
      return (
        "⚠️ Gagal mendeteksi nominal gaji/pemasukan Anda.\n\n" +
        "Contoh format yang benar:\n" +
        "• _Gaji 10jt bagi makan 40%, transport 20%, tabungan 40%_\n" +
        "• _Gaji masuk 8 juta dibagi makan 3jt, transport 2jt, nabung 3jt_"
      );
    }

    // 2. Extract allocation segments
    const allocations = this.extractAllocations(text, totalAmount);
    if (allocations.length === 0) {
      return (
        `⚠️ Nominal pemasukan terdeteksi sebesar Rp ${formatRupiah(totalAmount)}, ` +
        `tetapi pos pembagian anggarannya belum jelas.\n\n` +
        `Contoh pembagian:\n` +
        `_"Gaji ${formatRupiah(totalAmount)} bagi makan 40%, transport 20%, tabungan 40%"_`
      );
    }

    // 3. Resolve user active accounts
    const userAccounts = await AccountService.getAccounts(userId);
    const activeAccounts = userAccounts.filter((a) => a.isActive);
    if (activeAccounts.length === 0) {
      return "⚠️ Anda belum memiliki akun keuangan aktif di FinTrack untuk menerima pemasukan.";
    }
    const targetAccount = activeAccounts.find((a) => a.type === "CASH") || activeAccounts[0];

    // 4. Resolve income category (Gaji)
    const incomeCategories = await CategoryService.getCategories(userId, "INCOME");
    const salaryCategory =
      incomeCategories.find((c) => c.name.toLowerCase().includes("gaji")) ||
      incomeCategories[0];

    // 5. Execute Income Transaction
    const today = new Date();
    const todayIso = today.toISOString().split("T")[0]!;

    await TransactionService.createTransaction(userId, {
      accountId: targetAccount.id,
      categoryId: salaryCategory ? salaryCategory.id : undefined,
      type: "INCOME",
      amount: String(totalAmount),
      description: "Pemasukan Gaji & Alokasi",
      transactionDate: today,
    });

    // 6. Fetch user expense categories
    const expenseCategories = await CategoryService.getCategories(userId, "EXPENSE");
    const existingBudgets = await BudgetService.listBudgets(userId);

    const now = new Date();
    // Jakarta local date values
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const budgetResults: Array<{ name: string; icon: string; amount: number; percentage?: number }> = [];
    let savingResult: { name: string; amount: number; percentage?: number } | null = null;

    // 7. Process each allocation
    for (const alloc of allocations) {
      if (alloc.categoryType === "SAVING") {
        // Handle saving goal
        const goals = await GoalService.listGoals(userId);
        let targetGoal = goals.find((g) => g.status === "ACTIVE");

        if (!targetGoal) {
          // Auto-create default saving goal if none exists
          targetGoal = await GoalService.createGoal(userId, {
            name: "Tabungan Utama",
            targetAmount: String(alloc.calculatedAmount * 12),
            targetDate: `${currentYear + 1}-12-31`,
            currency: "IDR",
          });
        }

        try {
          await GoalService.createContribution(userId, targetGoal.id, {
            amount: String(alloc.calculatedAmount),
            description: "Alokasi otomatis dari gaji",
            contributionDate: todayIso,
          });
        } catch {
          // In case contribution exceeds goal target or other edge case, ignore gracefully
        }

        savingResult = {
          name: targetGoal.name,
          amount: alloc.calculatedAmount,
          percentage: alloc.percentage,
        };
      } else {
        // Handle expense budget
        const matchedCat = this.matchExpenseCategory(alloc.target, expenseCategories);
        if (matchedCat) {
          // Check if budget already exists for this category in current month
          const existing = existingBudgets.find((b) => b.categoryId === matchedCat.id);

          if (existing) {
            // Update budget
            await BudgetService.updateBudget(userId, existing.id, {
              amount: String(alloc.calculatedAmount),
            });
          } else {
            // Create new monthly budget
            await BudgetService.createBudget(userId, {
              periodType: "MONTHLY",
              categoryId: matchedCat.id,
              amount: String(alloc.calculatedAmount),
              currency: "IDR",
              year: currentYear,
              month: currentMonth,
            });
          }

          budgetResults.push({
            name: matchedCat.name,
            icon: matchedCat.icon || "🏷️",
            amount: alloc.calculatedAmount,
            percentage: alloc.percentage,
          });
        }
      }
    }

    // 8. Format structured WhatsApp confirmation response
    let responseText =
      `🎉 *Gaji & Alokasi Anggaran Berhasil Dicatat!*\n\n` +
      `💵 *Pemasukan:* Rp ${formatRupiah(totalAmount)} (Kategori: ${salaryCategory?.name || "Gaji"})\n` +
      `🏦 *Masuk ke:* Akun ${targetAccount.name}\n\n`;

    if (budgetResults.length > 0) {
      responseText += `📋 *Alokasi Budget Belanja Bulan Ini:*\n`;
      for (const b of budgetResults) {
        const pctLabel = b.percentage ? ` (${b.percentage}%)` : "";
        responseText += `• ${b.icon} *${b.name}:* Rp ${formatRupiah(b.amount)}${pctLabel}\n`;
      }
      responseText += `\n`;
    }

    if (savingResult) {
      const pctLabel = savingResult.percentage ? ` (${savingResult.percentage}%)` : "";
      responseText +=
        `🎯 *Alokasi Tabungan:*\n` +
        `• 🏦 *${savingResult.name}:* Rp ${formatRupiah(savingResult.amount)}${pctLabel} berhasil ditambahkan ke Target Tabungan!\n\n`;
    }

    responseText +=
      `💡 *Semua data sudah langsung terupdate di dashboard web FinTrack Anda!*\n` +
      `Ketik *'cek budget'* atau *'sisa budget makan'* kapan saja untuk memantau pengeluaran Anda.`;

    return responseText;
  }

  /**
   * Helper to extract total salary amount from text
   */
  private static extractTotalAmount(text: string): number | null {
    // Find pattern like "gaji 10jt", "gaji masuk 10 juta", "gajian 8.500.000", "pemasukan 15jt"
    const salaryMatch = text.match(
      /(?:gaji(?:an)?|pemasukan|income)\s*(?:masuk|sebesar|bulan ini)?\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d{4,})/i
    );

    if (salaryMatch && salaryMatch[1]) {
      return parseIndonesianAmount(salaryMatch[1]);
    }

    // Fallback: look for the first amount mentioned before the word "bagi" or "alokasi"
    const splitIndex = text.search(/\b(?:bagi|dibagi|alokasi|alokasikan)\b/i);
    const textBeforeSplit = splitIndex > 0 ? text.substring(0, splitIndex) : text;

    const anyAmountMatch = textBeforeSplit.match(
      /(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d{5,})/i
    );

    if (anyAmountMatch && anyAmountMatch[1]) {
      return parseIndonesianAmount(anyAmountMatch[1]);
    }

    return null;
  }

  /**
   * Helper to parse allocation segments (percentages or fixed amounts)
   */
  private static extractAllocations(text: string, totalAmount: number): AllocationItem[] {
    const allocations: AllocationItem[] = [];

    // Find the portion of text after split keyword
    const splitMatch = text.match(/\b(?:bagi|dibagi|alokasi|alokasikan|untuk)\b/i);
    const allocationPart = splitMatch ? text.substring(splitMatch.index!) : text;

    // Mapping patterns
    const targets = [
      { key: "makan", keywords: ["makan", "minum", "kuliner", "konsumsi"], type: "EXPENSE" as const },
      { key: "transport", keywords: ["transport", "bensin", "kendaraan", "transportasi"], type: "EXPENSE" as const },
      { key: "belanja", keywords: ["belanja", "shopping", "mall"], type: "EXPENSE" as const },
      { key: "hiburan", keywords: ["hiburan", "nonton", "liburan", "refreshing"], type: "EXPENSE" as const },
      { key: "tagihan", keywords: ["tagihan", "listrik", "air", "wifi", "internet", "pulsa"], type: "EXPENSE" as const },
      { key: "kesehatan", keywords: ["kesehatan", "obat", "dokter"], type: "EXPENSE" as const },
      { key: "pendidikan", keywords: ["pendidikan", "kursus", "sekolah"], type: "EXPENSE" as const },
      { key: "nabung", keywords: ["nabung", "tabungan", "saving", "simpan", "investasi", "goal"], type: "SAVING" as const },
    ];

    for (const target of targets) {
      for (const kw of target.keywords) {
        // Pattern 1: Percentage (e.g. "makan 40%", "makan 40 persen", "untuk makan 40%")
        const pctRegex = new RegExp(
          `(?:untuk\\s+)?${kw}[^0-9]*?([0-9]+(?:[.,][0-9]+)?)\\s*(?:%|persen)`,
          "i"
        );
        const pctMatch = allocationPart.match(pctRegex);

        if (pctMatch && pctMatch[1]) {
          const pct = parseFloat(pctMatch[1].replace(",", "."));
          if (pct > 0 && pct <= 100) {
            const calculatedAmount = Math.round((pct / 100) * totalAmount);
            allocations.push({
              target: target.key,
              categoryType: target.type,
              percentage: pct,
              calculatedAmount,
            });
            break;
          }
        }

        // Pattern 2: Percentage before keyword (e.g. "40% makan", "20% untuk transport")
        const revPctRegex = new RegExp(
          `([0-9]+(?:[.,][0-9]+)?)\\s*(?:%|persen)\\s*(?:untuk\\s+)?${kw}`,
          "i"
        );
        const revPctMatch = allocationPart.match(revPctRegex);

        if (revPctMatch && revPctMatch[1]) {
          const pct = parseFloat(revPctMatch[1].replace(",", "."));
          if (pct > 0 && pct <= 100) {
            const calculatedAmount = Math.round((pct / 100) * totalAmount);
            allocations.push({
              target: target.key,
              categoryType: target.type,
              percentage: pct,
              calculatedAmount,
            });
            break;
          }
        }

        // Pattern 3: Fixed amount (e.g. "makan 3jt", "transport 1.5jt", "makan 3 juta")
        const fixedRegex = new RegExp(
          `(?:untuk\\s+)?${kw}[^0-9]*?([0-9]+(?:[.,][0-9]+)?\\s*(?:juta|jt|ribu|rb|k))`,
          "i"
        );
        const fixedMatch = allocationPart.match(fixedRegex);

        if (fixedMatch && fixedMatch[1]) {
          const parsed = parseIndonesianAmount(fixedMatch[1]);
          if (parsed && parsed > 0) {
            const pct = Math.round((parsed / totalAmount) * 100);
            allocations.push({
              target: target.key,
              categoryType: target.type,
              fixedAmount: parsed,
              percentage: pct,
              calculatedAmount: parsed,
            });
            break;
          }
        }
      }
    }

    return allocations;
  }

  /**
   * Match target keyword to actual user expense category in DB
   */
  private static matchExpenseCategory(
    targetKey: string,
    categories: Array<{ id: string; name: string; icon?: string | null }>
  ) {
    const targetMap: Record<string, string[]> = {
      makan: ["makan", "minum", "kuliner", "konsumsi"],
      transport: ["transport", "bensin", "kendaraan"],
      belanja: ["belanja", "shopping"],
      hiburan: ["hiburan", "liburan", "nonton"],
      tagihan: ["tagihan", "listrik", "air", "utilitas"],
      kesehatan: ["kesehatan", "obat"],
      pendidikan: ["pendidikan", "kursus", "buku"],
    };

    const keywords = targetMap[targetKey] || [targetKey];

    for (const kw of keywords) {
      const found = categories.find((c) => c.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    return categories[0] || null;
  }
}
