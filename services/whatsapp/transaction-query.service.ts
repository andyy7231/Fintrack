import { TransactionService } from "@/services/transaction.service";
import { getJakartaDateString } from "@/services/ai/date.utils";
import { formatRupiah } from "@/services/ai/amount.utils";

export class TransactionQueryService {
  /**
   * Check if message is a transaction history query
   */
  static isTransactionQuery(text: string): boolean {
    const lower = text.toLowerCase().trim();
    
    const queryKeywords = [
      "lihat transaksi",
      "tampilkan transaksi",
      "riwayat transaksi",
      "history transaksi",
      "keseluruhan transaksi",
      "semua transaksi",
      "transaksi hari ini",
      "transaksi kemarin",
      "transaksi minggu ini",
      "transaksi bulan ini",
    ];
    
    return queryKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Handle transaction history query
   */
  static async handleTransactionQuery(
    userId: string,
    text: string
  ): Promise<string> {
    const lower = text.toLowerCase().trim();
    
    // Determine date range
    const today = new Date();
    let startDate: Date;
    let endDate: Date = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    if (lower.includes("hari ini")) {
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
    } else if (lower.includes("kemarin")) {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (lower.includes("minggu ini")) {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (lower.includes("bulan ini")) {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default: last 7 days
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    }
    
    // Fetch transactions
    const transactions = await TransactionService.getTransactions(userId, {
      startDate,
      endDate,
    });
    
    if (transactions.length === 0) {
      return "ℹ️ Tidak ada transaksi ditemukan untuk periode tersebut.";
    }
    
    // Format response
    const periodLabel = this.getPeriodLabel(lower);
    let response = `📊 *Riwayat Transaksi ${periodLabel}*\n\n`;
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    const lines: string[] = [];
    transactions.forEach((tx, idx) => {
      const date = new Date(tx.transactionDate);
      const dateStr = date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      const emoji = tx.type === "INCOME" ? "💰" : "💸";
      const sign = tx.type === "INCOME" ? "+" : "-";
      const amount = typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount;
      
      lines.push(
        `${idx + 1}. ${emoji} ${dateStr} | ${sign}${formatRupiah(amount)}\n` +
        `   ${tx.description || "(no description)"}`
      );
      
      if (tx.type === "INCOME") {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
    });
    
    response += lines.join("\n\n");
    response += `\n\n───────────────\n`;
    response += `💰 Total Pemasukan: ${formatRupiah(totalIncome)}\n`;
    response += `💸 Total Pengeluaran: ${formatRupiah(totalExpense)}\n`;
    response += `📈 Net: ${formatRupiah(totalIncome - totalExpense)}`;
    
    if (transactions.length >= 20) {
      response += `\n\n💡 Menampilkan 20 transaksi terbaru. Lihat lebih lengkap di dashboard web.`;
    }
    
    return response;
  }
  
  private static getPeriodLabel(lowerText: string): string {
    if (lowerText.includes("hari ini")) return "Hari Ini";
    if (lowerText.includes("kemarin")) return "Kemarin";
    if (lowerText.includes("minggu ini")) return "7 Hari Terakhir";
    if (lowerText.includes("bulan ini")) return "Bulan Ini";
    return "7 Hari Terakhir";
  }
}
