import { TransactionService } from "@/services/transaction.service";
import { formatTransactionList, TransactionListItem } from "./response-formatter.service";

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
      "transaksi terakhir",
    ];

    return queryKeywords.some((keyword) => lower.includes(keyword));
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
    let limit: number | undefined;

    if (lower.includes("terakhir")) {
      // Recent 5 transactions (no date filter)
      limit = 5;
      startDate = new Date(0); // epoch
    } else if (lower.includes("hari ini")) {
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
    const txs = await TransactionService.getTransactions(userId, {
      startDate: limit ? undefined : startDate,
      endDate: limit ? undefined : endDate,
      limit: limit ?? 20,
    });

    const periodLabel = this.getPeriodLabel(lower);

    const items: TransactionListItem[] = txs.map((tx) => ({
      type: tx.type as "EXPENSE" | "INCOME",
      categoryName: tx.categoryName ?? null,
      amount: typeof tx.amount === "string" ? parseFloat(tx.amount) : tx.amount,
      description: tx.description || "(tanpa keterangan)",
      transactionDate: new Date(tx.transactionDate),
    }));

    return formatTransactionList(items, periodLabel);
  }

  private static getPeriodLabel(lowerText: string): string {
    if (lowerText.includes("terakhir")) return "Terakhir";
    if (lowerText.includes("hari ini")) return "Hari Ini";
    if (lowerText.includes("kemarin")) return "Kemarin";
    if (lowerText.includes("minggu ini")) return "7 Hari Terakhir";
    if (lowerText.includes("bulan ini")) return "Bulan Ini";
    return "7 Hari Terakhir";
  }
}
