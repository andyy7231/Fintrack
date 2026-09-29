import { TransactionService } from "@/services/transaction.service";
import { parseIndonesianAmount } from "@/services/ai/amount.utils";

function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID").format(Math.round(num));
}

export class TransactionDeletionService {
  /**
   * Check if text is a command to delete or undo a recorded transaction
   */
  static isDeleteCommand(rawText: string): boolean {
    const text = rawText.toLowerCase().trim();

    // If it's a delete keyword
    if (text.includes("hapus") || text.includes("delete") || text.includes("hilangkan")) {
      return true;
    }

    // If it's a cancellation of a specific transaction (not just a single word "batal")
    if (
      text.startsWith("batal ") ||
      text.startsWith("batalkan ") ||
      text.includes("batalin ")
    ) {
      return (
        text.includes("transaksi") ||
        text.includes("pengeluaran") ||
        text.includes("pemasukan") ||
        text.includes("terakhir") ||
        text.includes("tadi") ||
        /\d/.test(text)
      );
    }

    return false;
  }

  /**
   * Process transaction deletion by matching amount, description, or last transaction
   */
  static async handleDeleteCommand(userId: string, rawText: string): Promise<string> {
    const text = rawText.toLowerCase().trim();

    // 1. Fetch user's recent transactions
    const recentTxs = await TransactionService.getTransactions(userId, { limit: 15 });

    if (recentTxs.length === 0) {
      return (
        "ℹ️ Anda belum memiliki riwayat transaksi yang tersimpan di FinTrack untuk dihapus."
      );
    }

    // 2. Check if user wants to delete the very last transaction
    const isLastTxCommand =
      text.includes("terakhir") ||
      text.includes("yang tadi") ||
      (text.includes("sebelumnya") && !/\d/.test(text) && !text.includes("kopi"));

    if (
      isLastTxCommand ||
      text === "hapus transaksi" ||
      text === "hapus pengeluaran" ||
      text === "batalkan transaksi"
    ) {
      const lastTx = recentTxs[0];
      await TransactionService.deleteTransaction(userId, lastTx.id);

      const typeLabel = lastTx.type === "INCOME" ? "Pemasukan" : "Pengeluaran";
      return (
        `🗑️ *Transaksi Terakhir Berhasil Dihapus!*\n\n` +
        `• Tipe: ${typeLabel}\n` +
        `• Keterangan: ${lastTx.description}\n` +
        `• Nominal: Rp ${formatRupiah(lastTx.amount)}\n` +
        `• Kategori: ${lastTx.categoryName || "Lainnya"}\n\n` +
        `✅ Saldo dan batas budget Anda di dashboard web telah otomatis dikembalikan.`
      );
    }

    // 3. Extract amount if mentioned (e.g. "25k", "25rb", "25.000", "25 ribu")
    const amountMatch = text.match(/(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?\s*(?:juta|jt|ribu|rb|k)?|\d{4,})/i);
    let targetAmount: number | null = null;
    if (amountMatch && amountMatch[1]) {
      targetAmount = parseIndonesianAmount(amountMatch[1]);
    }

    // 4. Extract search keyword by removing common command filler words
    let searchKeyword = text
      .replace(/\b(?:tolong|mohon|bisa|tolongin|dong|ya|kak|bot)\b/gi, "")
      .replace(/\b(?:hapus|hapuskan|delete|batalkan|batalin|hilangkan)\b/gi, "")
      .replace(/\b(?:transaksi|pengeluaran|pemasukan|catatan|uang)\b/gi, "")
      .replace(/\b(?:sebelumnya|kemarin|tadi|terakhir|yang|untuk|buat|sebesar|senilai)\b/gi, "");

    if (amountMatch && amountMatch[0]) {
      searchKeyword = searchKeyword.replace(amountMatch[0], "");
    }
    searchKeyword = searchKeyword.trim().replace(/\s+/g, " ");

    // 5. Score recent transactions to find best match
    let bestMatch: (typeof recentTxs)[0] | null = null;
    let highestScore = 0;

    for (const tx of recentTxs) {
      let score = 0;
      const txAmount = parseFloat(tx.amount);
      const txDesc = tx.description.toLowerCase();
      const txCat = (tx.categoryName || "").toLowerCase();

      // Check amount match
      const amountMatches = targetAmount !== null && Math.abs(txAmount - targetAmount) < 1;
      if (amountMatches) {
        score += 5;
      }

      // Check keyword match in description or category
      if (searchKeyword.length >= 2) {
        if (txDesc.includes(searchKeyword)) {
          score += 6;
        } else if (txCat.includes(searchKeyword)) {
          score += 4;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = tx;
      }
    }

    // 6. If match found with confidence
    if (bestMatch && highestScore >= 4) {
      await TransactionService.deleteTransaction(userId, bestMatch.id);

      const typeLabel = bestMatch.type === "INCOME" ? "Pemasukan" : "Pengeluaran";
      return (
        `🗑️ *Transaksi Berhasil Dihapus!*\n\n` +
        `• Tipe: ${typeLabel}\n` +
        `• Keterangan: ${bestMatch.description}\n` +
        `• Nominal: Rp ${formatRupiah(bestMatch.amount)}\n` +
        `• Kategori: ${bestMatch.categoryName || "Lainnya"}\n\n` +
        `✅ Saldo akun dan kuota budget terkait di dashboard web telah otomatis dikembalikan!`
      );
    }

    // 7. If no confident match found, list the 3 most recent transactions
    const top3 = recentTxs.slice(0, 3);
    const listLines = top3.map(
      (t: (typeof recentTxs)[number], idx: number) =>
        `${idx + 1}. *${t.description}* — Rp ${formatRupiah(t.amount)} (${t.categoryName || "Lainnya"})`
    );

    return (
      `⚠️ Tidak ditemukan transaksi yang cocok dengan rincian yang Anda minta.\n\n` +
      `📋 *3 Transaksi Terakhir Anda:*\n` +
      listLines.join("\n") +
      `\n\n💡 *Tips:* Anda bisa ketik:\n` +
      `• _"Hapus transaksi terakhir"_\n` +
      `• _"Hapus ${top3[0]?.description || "kopi"}"_`
    );
  }
}
