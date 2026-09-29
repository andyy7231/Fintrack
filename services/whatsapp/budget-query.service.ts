import { BudgetService, BudgetProgressDTO } from "@/services/budget.service";
import { CategoryService } from "@/services/category.service";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(amount));
}

export class BudgetQueryService {
  /**
   * Determine if an inbound message is asking to check budget status
   */
  static isBudgetQuery(rawText: string): boolean {
    const text = rawText.toLowerCase().trim();

    // Ignore salary split/allocation commands which have budget words
    if (
      (text.includes("gaji") || text.includes("gajian") || text.includes("pemasukan")) &&
      (text.includes("bagi") || text.includes("alokasi") || text.includes("%"))
    ) {
      return false;
    }

    // Direct budget query patterns
    const hasBudgetWord = text.includes("budget") || text.includes("anggaran");
    const hasSisaQuery = text.includes("tinggal berapa") || text.includes("sisa kuota") || text.includes("cek sisa");
    const startsWithSisa = /^sisa\s+/i.test(text);

    return hasBudgetWord || hasSisaQuery || startsWithSisa;
  }

  /**
   * Process budget query and return formatted WhatsApp response
   */
  static async handleBudgetQuery(userId: string, rawText: string): Promise<string> {
    const text = rawText.toLowerCase().trim();
    const budgets = await BudgetService.listBudgets(userId);

    // List of known category keywords to detect specific category query
    const categoryKeywords: Record<string, string[]> = {
      makan: ["makan", "minum", "kuliner", "konsumsi", "food"],
      transport: ["transport", "bensin", "kendaraan", "gojek", "grab", "parkir", "tol"],
      belanja: ["belanja", "shopping", "mall", "pasar"],
      hiburan: ["hiburan", "nonton", "bioskop", "game", "liburan"],
      tagihan: ["tagihan", "listrik", "air", "pdam", "wifi", "internet", "pulsa", "utilitas"],
      kesehatan: ["kesehatan", "obat", "dokter", "rumah sakit", "klinik"],
      pendidikan: ["pendidikan", "kursus", "buku", "sekolah", "kuliah"],
      lainnya: ["lain", "lainnya"],
    };

    // Check if user is asking for a specific category
    let matchedGroup: string | null = null;
    for (const [group, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        matchedGroup = group;
        break;
      }
    }

    // ─── SPECIFIC CATEGORY BUDGET QUERY ──────────────────────────────────────────
    if (matchedGroup) {
      const keywords = categoryKeywords[matchedGroup] || [];
      const matchedBudget = budgets.find((b) =>
        keywords.some((kw) => b.categoryName.toLowerCase().includes(kw))
      );

      if (matchedBudget) {
        return this.formatSingleBudgetResponse(matchedBudget);
      }

      // Budget for this category not set yet
      const allCategories = await CategoryService.getCategories(userId, "EXPENSE");
      const matchedCat = allCategories.find((c) =>
        keywords.some((kw) => c.name.toLowerCase().includes(kw))
      );

      const catName = matchedCat ? matchedCat.name : matchedGroup;
      const catIcon = matchedCat?.icon || "📋";

      return (
        `${catIcon} *Budget ${catName}:*\n\n` +
        `Anda belum menyetel batas budget untuk kategori *${catName}* bulan ini.\n\n` +
        `💡 *Cara Setel Budget:*\n` +
        `• Di Web: Buka menu *Budget* di https://fintrack-iota-three.vercel.app/budgets\n` +
        `• Lewat WA: Ketik alokasi gaji (contoh: _"Gaji 10jt bagi makan 40%, transport 20%"_)`
      );
    }

    // ─── GENERAL BUDGET QUERY (ALL BUDGETS) ──────────────────────────────────────
    if (budgets.length === 0) {
      return (
        `📊 *Status Anggaran (Budget) FinTrack*\n\n` +
        `Anda belum memiliki budget bulanan yang disetel untuk bulan ini.\n\n` +
        `💡 *Tips Memulai:*\n` +
        `1. *Lewat WhatsApp:* Alokasikan gaji bulanan Anda, misal:\n` +
        `   _"Gaji 10jt bagi makan 40%, transport 20%, tabungan 40%"_\n` +
        `2. *Lewat Web:* Setel batas pengeluaran kategori di menu *Budget* https://fintrack-iota-three.vercel.app/budgets`
      );
    }

    let totalLimit = 0;
    let totalSpent = 0;
    let totalRemaining = 0;

    const budgetLines = budgets.map((b) => {
      totalLimit += b.limitAmount;
      totalSpent += b.spentAmount;
      totalRemaining += Math.max(0, b.remainingAmount);

      const icon = b.categoryIcon || "🏷️";
      let statusEmoji = "✅";
      if (b.isOverBudget) {
        statusEmoji = "🚨 Melebihi Batas!";
      } else if (b.usagePercentage >= 80) {
        statusEmoji = "⚠️ Menipis";
      } else {
        statusEmoji = "✅ Aman";
      }

      return (
        `${icon} *${b.categoryName}*\n` +
        `• Terpakai: Rp ${formatRupiah(b.spentAmount)} / Rp ${formatRupiah(b.limitAmount)} (${b.usagePercentage.toFixed(1)}%)\n` +
        `• Sisa: *Rp ${formatRupiah(b.remainingAmount)}* (${statusEmoji})\n`
      );
    });

    return (
      `📊 *Ringkasan Budget Bulan Ini:*\n\n` +
      budgetLines.join("\n") +
      `\n───────────────────\n` +
      `💰 *Total Batas Budget:* Rp ${formatRupiah(totalLimit)}\n` +
      `📉 *Total Terpakai:* Rp ${formatRupiah(totalSpent)}\n` +
      `💵 *Sisa Kuota Belanja:* *Rp ${formatRupiah(totalRemaining)}*\n\n` +
      `Ketik misal: _"budget makan tinggal berapa"_ untuk cek detail spesifik.`
    );
  }

  private static formatSingleBudgetResponse(b: BudgetProgressDTO): string {
    const icon = b.categoryIcon || "🏷️";
    let statusText = "✅ *Aman* (Kuota masih cukup)";

    if (b.isOverBudget) {
      const overAmount = b.spentAmount - b.limitAmount;
      statusText = `🚨 *Melebihi Batas Anggaran!* (Lebih Rp ${formatRupiah(overAmount)})`;
    } else if (b.usagePercentage >= 80) {
      statusText = `⚠️ *Peringatan: Anggaran Hampir Habis!* (${b.usagePercentage.toFixed(1)}% terpakai)`;
    } else {
      const sisaPersen = Math.max(0, 100 - b.usagePercentage);
      statusText = `✅ *Aman* (Tersisa ${sisaPersen.toFixed(1)}% kuota)`;
    }

    return (
      `${icon} *Status Budget ${b.categoryName}*\n\n` +
      `• Batas Anggaran: Rp ${formatRupiah(b.limitAmount)}\n` +
      `• Sudah Terpakai: Rp ${formatRupiah(b.spentAmount)} (${b.usagePercentage.toFixed(1)}%)\n` +
      `• Sisa Kuota: *Rp ${formatRupiah(b.remainingAmount)}*\n\n` +
      `Status: ${statusText}\n\n` +
      `_Setiap Anda catat pengeluaran di WA, sisa kuota ini akan otomatis berkurang._`
    );
  }
}
