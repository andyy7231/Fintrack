"use client";

import type { AccountBreakdownItem } from "@/services/report.service";

interface Props {
  accounts: AccountBreakdownItem[];
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function accountTypeIcon(type: string): string {
  switch (type) {
    case "BANK":
      return "🏦";
    case "E_WALLET":
      return "📱";
    case "CASH":
      return "💵";
    default:
      return "💳";
  }
}

export function ReportAccountBreakdown({ accounts }: Props) {
  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Tidak ada data akun untuk periode ini.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 dark:border-zinc-800">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Akun
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hidden sm:table-cell">
              Tipe
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pemasukan
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pengeluaran
            </th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {accounts.map((acc) => (
            <tr
              key={acc.accountId}
              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{accountTypeIcon(acc.accountType)}</span>
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      {acc.accountName}
                    </p>
                    <p className="text-xs text-zinc-400">{acc.currency}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-zinc-600 dark:text-zinc-400 hidden sm:table-cell">
                {acc.accountType}
              </td>
              <td className="px-5 py-3.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                +{formatIDR(acc.income)}
              </td>
              <td className="px-5 py-3.5 text-right font-medium text-red-600 dark:text-red-400">
                -{formatIDR(acc.expense)}
              </td>
              <td
                className={`px-5 py-3.5 text-right font-semibold ${
                  acc.net >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {acc.net >= 0 ? "+" : ""}
                {formatIDR(acc.net)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
