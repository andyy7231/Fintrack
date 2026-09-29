"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { formatUserIdentifier } from "@/services/whatsapp/phone.utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transaksi" },
  { href: "/accounts", label: "Akun" },
  { href: "/categories", label: "Kategori" },
  { href: "/budgets", label: "Budget" },
  { href: "/goals", label: "Goals" },
  { href: "/reports", label: "Laporan" },
  { href: "/transfers", label: "Transfer" },
  { href: "/settings/profile", label: "Profil" },
];

export function AppHeader({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm shadow-sm">
              FT
            </span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
              FinTrack
            </span>
          </Link>

          <nav className="hidden md:flex md:space-x-1 ml-6">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {userEmail && (
            <span className="hidden lg:inline-block text-xs text-zinc-500 dark:text-zinc-400">
              {formatUserIdentifier(userEmail)}
            </span>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Mobile navigation bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-zinc-100 px-4 py-2 dark:border-zinc-800 space-x-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
