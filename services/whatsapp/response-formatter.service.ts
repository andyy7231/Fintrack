/**
 * WhatsApp Response Formatter
 *
 * Provides structured, consistent response strings for all WhatsApp intents.
 * All formatters work from structured execution results — never from raw keywords.
 *
 * Encoding: all string literals use UTF-8; emoji are stored as Unicode codepoints.
 */

import { formatRupiah } from "@/services/ai/amount.utils";

// ─── Category → Icon Mapping ─────────────────────────────────────────────────

const CATEGORY_ICON_MAP: Record<string, string> = {
  // Expense
  "makanan & minuman":  "\uD83C\uDF7D\uFE0F",  // 🍽️
  "transportasi":       "\uD83D\uDE97",         // 🚗
  "tagihan & utilitas": "\uD83E\uDDFE",         // 🧾
  "belanja":            "\uD83D\uDECD\uFE0F",   // 🛍️
  "kesehatan":          "\uD83D\uDC8A",         // 💊
  "hiburan":            "\uD83C\uDFAE",         // 🎮
  "pendidikan":         "\uD83D\uDCDA",         // 📚
  "tempat tinggal":     "\uD83C\uDFE0",         // 🏠
  "lainnya":            "\uD83D\uDCCC",         // 📌
  "pengeluaran lain":   "\uD83D\uDCCC",         // 📌
  // Income
  "gaji":               "\uD83D\uDCB0",         // 💰
  "bonus":              "\uD83C\uDF81",         // 🎁
  "freelance":          "\uD83D\uDCBC",         // 💼
  "bisnis":             "\uD83C\uDFEA",         // 🏪
  "investasi":          "\uD83D\uDCC8",         // 📈
  "hadiah":             "\uD83C\uDF81",         // 🎁
  "pemasukan lain":     "\uD83D\uDCB5",         // 💵
  // Special
  "transfer":           "\uD83D\uDD04",         // 🔄
};

/**
 * Get icon for a category name (case-insensitive, fallback safe).
 */
export function getCategoryIcon(categoryName: string | null | undefined): string {
  if (!categoryName) return "\uD83D\uDCCC"; // 📌
  return CATEGORY_ICON_MAP[categoryName.toLowerCase()] ?? "\uD83D\uDCCC";
}

/**
 * Format amount as canonical Rupiah: Rp1.000 / Rp25.000 / Rp5.000.000
 */
export function formatAmount(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return formatRupiah(Math.round(num));
}

// ─── Single Transaction Success ───────────────────────────────────────────────

export interface SingleTransactionResult {
  type: "EXPENSE" | "INCOME";
  categoryName: string | null;
  amount: number;
  description: string;
  accountName: string;
  accountBalance: number;
}

/**
 * Format a single EXPENSE success response.
 */
export function formatExpenseSuccess(r: SingleTransactionResult): string {
  const icon = getCategoryIcon(r.categoryName);
  const cat = r.categoryName || "Lainnya";
  return (
    `${icon} Pengeluaran berhasil dicatat\n\n` +
    `\u2022 Kategori: ${cat}\n` +
    `\u2022 Jumlah: ${formatAmount(r.amount)}\n` +
    `\u2022 Keterangan: ${r.description}\n` +
    `\u2022 Akun: ${r.accountName}\n\n` +
    `Saldo ${r.accountName}: ${formatAmount(r.accountBalance)}`
  );
}

/**
 * Format a single INCOME success response.
 */
export function formatIncomeSuccess(r: SingleTransactionResult): string {
  const icon = getCategoryIcon(r.categoryName);
  const cat = r.categoryName || "Pemasukan Lain";
  return (
    `${icon} Pemasukan berhasil dicatat\n\n` +
    `\u2022 Kategori: ${cat}\n` +
    `\u2022 Jumlah: ${formatAmount(r.amount)}\n` +
    `\u2022 Keterangan: ${r.description}\n` +
    `\u2022 Akun: ${r.accountName}\n\n` +
    `Saldo ${r.accountName}: ${formatAmount(r.accountBalance)}`
  );
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export interface TransferSuccessResult {
  fromAccountName: string;
  toAccountName: string;
  amount: number;
  fromAccountBalance: number;
}

export function formatTransferSuccess(r: TransferSuccessResult): string {
  return (
    `\uD83D\uDD04 Transfer berhasil\n\n` +
    `\u2022 Dari: ${r.fromAccountName}\n` +
    `\u2022 Ke: ${r.toAccountName}\n` +
    `\u2022 Jumlah: ${formatAmount(r.amount)}\n\n` +
    `Saldo ${r.fromAccountName}: ${formatAmount(r.fromAccountBalance)}`
  );
}

export function formatTransferDestinationNotFound(accountHint: string): string {
  return (
    `\u26A0\uFE0F Transfer tidak dapat dilakukan\n\n` +
    `Akun tujuan "${accountHint}" tidak ditemukan.\n\n` +
    `Gunakan nama akun yang sudah terdaftar di FinTrack.`
  );
}

export function formatTransferSameAccount(): string {
  return (
    `\u26A0\uFE0F Transfer tidak dapat dilakukan\n\n` +
    `Akun sumber dan tujuan tidak boleh sama.\n\n` +
    `Silakan pilih dua akun yang berbeda.`
  );
}

export function formatTransferInsufficientBalance(
  accountName: string,
  balance: number,
  transferAmount: number
): string {
  return (
    `\u26A0\uFE0F Transfer tidak dapat dilakukan\n\n` +
    `Saldo ${accountName} tidak mencukupi.\n\n` +
    `\u2022 Saldo: ${formatAmount(balance)}\n` +
    `\u2022 Transfer: ${formatAmount(transferAmount)}\n\n` +
    `Silakan periksa saldo atau gunakan akun lain.`
  );
}

// ─── Batch / Multi-action ─────────────────────────────────────────────────────

export interface BatchItem {
  type: "EXPENSE" | "INCOME" | "TRANSFER" | "BUDGET_ALLOCATION";
  categoryName: string | null;
  amount: number;
  description: string;
}

export interface BatchSuccessResult {
  items: BatchItem[];
  /** Balance of the primary affected account (or null for multi-account) */
  accountName?: string;
  accountBalance?: number;
}

export function formatBatchSuccess(r: BatchSuccessResult): string {
  const expenseItems = r.items.filter((i) => i.type === "EXPENSE");
  const incomeItems = r.items.filter((i) => i.type === "INCOME");

  const lines: string[] = [];

  r.items.forEach((item, idx) => {
    const icon = item.type === "TRANSFER"
      ? "\uD83D\uDD04"
      : getCategoryIcon(item.categoryName);
    const sign = item.type === "EXPENSE" ? "-" : item.type === "INCOME" ? "+" : "";
    const cat = item.categoryName || (item.type === "EXPENSE" ? "Lainnya" : item.type === "INCOME" ? "Pemasukan Lain" : "Transfer");
    lines.push(
      `${idx + 1}. ${icon} ${cat} ${sign}${formatAmount(item.amount)}\n   ${item.description}`
    );
  });

  let response = `\u2705 Semua transaksi berhasil dicatat\n\n${lines.join("\n\n")}`;

  const totalExpense = expenseItems.reduce((s, i) => s + i.amount, 0);
  const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);

  if (incomeItems.length > 0 && expenseItems.length > 0) {
    response += `\n\nTotal pemasukan: ${formatAmount(totalIncome)}`;
    response += `\nTotal pengeluaran: ${formatAmount(totalExpense)}`;
  } else if (expenseItems.length > 0) {
    response += `\n\nTotal pengeluaran: ${formatAmount(totalExpense)}`;
  } else if (incomeItems.length > 0) {
    response += `\n\nTotal pemasukan: ${formatAmount(totalIncome)}`;
  }

  if (r.accountName && r.accountBalance !== undefined) {
    response += `\n\nSaldo: ${formatAmount(r.accountBalance)}`;
  }

  return response;
}

// ─── Confirmation Prompt ──────────────────────────────────────────────────────

export interface ConfirmationItem {
  type: "EXPENSE" | "INCOME" | "TRANSFER" | "BUDGET_ALLOCATION";
  categoryName: string | null;
  amount: number;
  description: string;
  accountName?: string;
  fromAccountName?: string;
  toAccountName?: string;
}

export function formatConfirmation(items: ConfirmationItem[]): string {
  if (items.length === 1) {
    const item = items[0]!;
    const typeLabel = item.type === "EXPENSE" ? "Pengeluaran"
      : item.type === "INCOME" ? "Pemasukan"
      : item.type === "TRANSFER" ? "Transfer"
      : "Budget";
    const cat = item.categoryName || (item.type === "EXPENSE" ? "Lainnya" : item.type === "INCOME" ? "Pemasukan Lain" : "-");
    const accountInfo = item.type === "TRANSFER"
      ? `\u2022 Dari: ${item.fromAccountName}\n\u2022 Ke: ${item.toAccountName}`
      : `\u2022 Akun: ${item.accountName ?? "-"}`;

    return (
      `\uD83D\uDCDD Konfirmasi transaksi\n\n` +
      `Saya akan mencatat:\n\n` +
      `\u2022 ${typeLabel}: ${formatAmount(item.amount)}\n` +
      `\u2022 Kategori: ${cat}\n` +
      `\u2022 Keterangan: ${item.description}\n` +
      `${accountInfo}\n\n` +
      `Balas *YA* untuk menyimpan\nBalas *BATAL* untuk membatalkan`
    );
  }

  // Multi-action
  const totalExpense = items.filter((i) => i.type === "EXPENSE").reduce((s, i) => s + i.amount, 0);
  const totalIncome = items.filter((i) => i.type === "INCOME").reduce((s, i) => s + i.amount, 0);

  const lines = items.map((item, idx) => {
    const icon = item.type === "TRANSFER" ? "\uD83D\uDD04" : getCategoryIcon(item.categoryName);
    const desc = item.type === "TRANSFER"
      ? `Transfer ${formatAmount(item.amount)} ke ${item.toAccountName}`
      : `${item.description} — ${formatAmount(item.amount)}`;
    return `${idx + 1}. ${icon} ${desc}`;
  });

  let msg =
    `\uD83D\uDCDD Konfirmasi transaksi\n\n` +
    `Saya menemukan ${items.length} transaksi:\n\n` +
    `${lines.join("\n")}\n\n`;

  if (totalExpense > 0) msg += `Total pengeluaran: ${formatAmount(totalExpense)}\n`;
  if (totalIncome > 0) msg += `Total pemasukan: ${formatAmount(totalIncome)}\n`;

  msg += `\nBalas *YA* untuk menyimpan semuanya.\nBalas *BATAL* untuk membatalkan semuanya.`;
  return msg;
}

// ─── YA Confirmation Success ──────────────────────────────────────────────────

export interface ConfirmationSuccessResult {
  count: number;
  totalExpense: number;
  totalIncome: number;
  accountName?: string;
  accountBalance?: number;
}

export function formatConfirmationSuccess(r: ConfirmationSuccessResult): string {
  if (r.count === 1) {
    let msg = `\u2705 Transaksi berhasil disimpan\n\n1 transaksi telah dicatat.`;
    if (r.totalExpense > 0) msg += `\n\nTotal pengeluaran: ${formatAmount(r.totalExpense)}`;
    if (r.totalIncome > 0) msg += `\n\nTotal pemasukan: ${formatAmount(r.totalIncome)}`;
    if (r.accountBalance !== undefined && r.accountName) {
      msg += `\n\nSaldo: ${formatAmount(r.accountBalance)}`;
    }
    return msg;
  }

  let msg = `\u2705 Transaksi berhasil disimpan\n\n${r.count} transaksi telah dicatat.`;
  if (r.totalExpense > 0) msg += `\n\nTotal pengeluaran: ${formatAmount(r.totalExpense)}`;
  if (r.totalIncome > 0) msg += `\nTotal pemasukan: ${formatAmount(r.totalIncome)}`;
  if (r.accountBalance !== undefined && r.accountName) {
    msg += `\n\nSaldo: ${formatAmount(r.accountBalance)}`;
  }
  return msg;
}

// ─── BATAL ────────────────────────────────────────────────────────────────────

export function formatCancellation(): string {
  return (
    `\u274C Transaksi dibatalkan\n\n` +
    `Tidak ada transaksi yang disimpan.`
  );
}

export function formatNoPendingAction(): string {
  return (
    `Tidak ada transaksi yang sedang menunggu konfirmasi atau batas waktu konfirmasi telah habis.\n\n` +
    `Kirim pesan transaksi baru untuk memulai, contoh: _makan 25k_`
  );
}

// ─── Balance Query ────────────────────────────────────────────────────────────

export interface BalanceAccount {
  name: string;
  balance: number;
}

export function formatBalance(accounts: BalanceAccount[]): string {
  if (accounts.length === 0) {
    return (
      `\uD83D\uDCB0 Saldo kamu saat ini:\n\n` +
      `Belum ada akun terdaftar.\n\n` +
      `Silakan tambahkan akun melalui dashboard FinTrack.`
    );
  }

  if (accounts.length === 1) {
    const acc = accounts[0]!;
    return (
      `\uD83D\uDCB0 Saldo kamu saat ini:\n\n` +
      `${formatAmount(acc.balance)}\n\n` +
      `Akun: ${acc.name}`
    );
  }

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const lines = accounts.map((a) => `\u2022 ${a.name}: ${formatAmount(a.balance)}`).join("\n");
  return (
    `\uD83D\uDCB0 Saldo kamu\n\n` +
    `${lines}\n\n` +
    `Total saldo: ${formatAmount(total)}`
  );
}

// ─── Transaction List ─────────────────────────────────────────────────────────

export interface TransactionListItem {
  type: "EXPENSE" | "INCOME";
  categoryName: string | null;
  amount: number;
  description: string;
  transactionDate: Date;
}

export function formatTransactionList(
  items: TransactionListItem[],
  periodLabel: string
): string {
  if (items.length === 0) {
    return `\uD83D\uDCCB Transaksi ${periodLabel}\n\nTidak ada transaksi ditemukan.`;
  }

  const lines = items.slice(0, 20).map((tx, idx) => {
    const d = new Date(tx.transactionDate);
    const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    const icon = getCategoryIcon(tx.categoryName);
    const sign = tx.type === "INCOME" ? "+" : "-";
    return (
      `${idx + 1}. ${icon} ${dateStr} | ${sign}${formatAmount(tx.amount)}\n` +
      `   ${tx.description}`
    );
  });

  const totalIncome = items.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = items.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  let response = `\uD83D\uDCCB Riwayat Transaksi ${periodLabel}\n\n${lines.join("\n\n")}`;
  response += `\n\n---------------`;
  if (totalIncome > 0) response += `\n\u2B06\uFE0F Total Pemasukan: ${formatAmount(totalIncome)}`;
  if (totalExpense > 0) response += `\n\u2B07\uFE0F Total Pengeluaran: ${formatAmount(totalExpense)}`;

  if (items.length >= 20) {
    response += `\n\nMenunjukkan 20 transaksi terbaru. Lihat lebih lengkap di dashboard web.`;
  }

  return response;
}

// ─── Category Summary ─────────────────────────────────────────────────────────

export function formatCategorySummary(
  categoryName: string,
  total: number,
  periodLabel: string,
  topItems: Array<{ description: string; amount: number; date: Date }>
): string {
  const icon = getCategoryIcon(categoryName);
  let msg =
    `${icon} ${categoryName}\n\n` +
    `Periode: ${periodLabel}\n\n` +
    `Total: *${formatAmount(total)}*`;

  if (topItems.length > 0) {
    const lines = topItems.slice(0, 5).map((item, idx) => {
      const d = new Date(item.date);
      const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      return `${idx + 1}. ${dateStr} — ${formatAmount(item.amount)} (${item.description})`;
    });
    msg += `\n\n${lines.join("\n")}`;
  }

  return msg;
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

export interface DeleteConfirmationItem {
  description: string;
  categoryName: string | null;
  amount: number;
  transactionDate: Date;
}

export function formatDeleteConfirmation(tx: DeleteConfirmationItem): string {
  const d = new Date(tx.transactionDate);
  const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  return (
    `\uD83D\uDDD1\uFE0F Konfirmasi penghapusan\n\n` +
    `Transaksi terakhir:\n\n` +
    `\u2022 ${tx.description}\n` +
    `\u2022 ${tx.categoryName || "Lainnya"}\n` +
    `\u2022 ${formatAmount(tx.amount)}\n` +
    `\u2022 ${dateStr}\n\n` +
    `Balas *YA* untuk menghapus.\nBalas *BATAL* untuk membatalkan.`
  );
}

export interface DeleteSuccessResult {
  description: string;
  amount: number;
  accountName: string;
  accountBalance: number;
}

export function formatDeleteSuccess(r: DeleteSuccessResult): string {
  return (
    `\u2705 Transaksi berhasil dihapus\n\n` +
    `\u2022 ${r.description}\n` +
    `\u2022 ${formatAmount(r.amount)}\n\n` +
    `Saldo ${r.accountName}: ${formatAmount(r.accountBalance)}`
  );
}

export function formatDeleteCancellation(): string {
  return (
    `\u274C Penghapusan dibatalkan\n\n` +
    `Transaksi tetap tersimpan.`
  );
}

// ─── Error / Incomplete Input ─────────────────────────────────────────────────

export function formatMissingAmount(): string {
  return (
    `\u26A0\uFE0F Jumlah belum ditemukan.\n\n` +
    `Contoh:\n` +
    `*makan 25k*\n` +
    `*bensin 20k*\n` +
    `*kopi 15k*`
  );
}

export function formatMissingDescription(amount: number): string {
  return (
    `\u26A0\uFE0F Saya menemukan jumlah *${formatAmount(amount)}*, tetapi belum tahu transaksi ini untuk apa.\n\n` +
    `Contoh:\n` +
    `*makan 25k*\n` +
    `*bensin 25k*\n` +
    `*belanja 25k*`
  );
}

export function formatUnknownMessage(): string {
  return (
    `\uD83E\uDD14 Saya belum memahami transaksi tersebut.\n\n` +
    `Coba gunakan format seperti:\n\n` +
    `\u2022 makan 25k\n` +
    `\u2022 bensin 20k\n` +
    `\u2022 gaji 5jt\n` +
    `\u2022 transfer 100k ke BCA\n` +
    `\u2022 berapa saldo saya\n` +
    `\u2022 transaksi terakhir`
  );
}

export function formatSystemError(): string {
  return (
    `\u26A0\uFE0F Transaksi belum berhasil disimpan.\n\n` +
    `Terjadi kendala saat memproses transaksi. Silakan coba lagi beberapa saat lagi.\n\n` +
    `Tidak ada transaksi yang dianggap berhasil jika penyimpanan belum dikonfirmasi.`
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

export function formatGreeting(): string {
  return (
    `\uD83D\uDC4B Halo! Saya FinTrack.\n\n` +
    `Saya bisa membantu mencatat dan mengecek keuangan kamu.\n\n` +
    `Contoh:\n` +
    `\u2022 makan 25k\n` +
    `\u2022 bensin 20k\n` +
    `\u2022 gaji 5jt\n` +
    `\u2022 transfer 100k ke BCA\n` +
    `\u2022 berapa saldo saya\n` +
    `\u2022 transaksi terakhir`
  );
}
