"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppSidebar, NAV_ITEMS } from "@/components/navigation/app-sidebar";
import { LogoutButton } from "@/components/auth/logout-button";
import { formatUserIdentifier } from "@/services/whatsapp/phone.utils";

/**
 * AppHeader — Provides responsive navigation:
 * - Desktop: Sticky dark sidebar (AppSidebar)
 * - Mobile: Modern top navigation bar, floating quick-action bottom tab bar,
 *   and slide-over drawer menu with complete navigation & profile info.
 */
export function AppHeader({
  userEmail,
  userName,
}: {
  userEmail?: string;
  userName?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer automatically on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const displayName = userName || "FinTrack User";
  const userInitial = (displayName[0] || "F").toUpperCase();
  const displayId = userEmail ? formatUserIdentifier(userEmail) : "";

  const handleOpenCatat = (e: React.MouseEvent) => {
    if (pathname.startsWith("/transactions")) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("open-new-transaction"));
    }
  };

  return (
    <>
      {/* ── 1. Desktop Sidebar ───────────────────────────────────── */}
      <div className="hidden md:flex shrink-0">
        <AppSidebar userEmail={userEmail} userName={userName} />
      </div>

      {/* ── 2. Mobile Top Navigation Bar ─────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#07130f]/95 backdrop-blur-md border-b border-[#132820] px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-black border border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-500/20 overflow-hidden">
            <img
              src="/fintrack-logo.png"
              alt="FinTrack"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white block leading-none">
              FinTrack
            </span>
            <span className="text-[10px] font-medium text-emerald-400 block leading-tight mt-0.5">
              Personal Finance
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Quick Catat button in header */}
          <Link
            href="/transactions?new=1"
            onClick={handleOpenCatat}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00c076] hover:bg-[#00a866] text-[#051610] text-xs font-extrabold shadow-sm active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Catat</span>
          </Link>

          {/* Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi"
            className="p-2 -mr-1 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 transition"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── 3. Mobile Top Spacer (preserves page layout flow) ─────── */}
      <div className="md:hidden h-14 w-full shrink-0" aria-hidden="true" />

      {/* ── 4. Mobile Bottom Navigation Bar (Tab Bar) ─────────────── */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#07130f]/95 backdrop-blur-md border-t border-[#132820] px-3 py-1.5 flex items-center justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.4)]"
      >
        {/* Tab 1: Dashboard */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-colors ${
            pathname === "/dashboard"
              ? "text-[#00c076]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Beranda</span>
        </Link>

        {/* Tab 2: Transaksi */}
        <Link
          href="/transactions"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-colors ${
            pathname.startsWith("/transactions") && !pathname.includes("new=1")
              ? "text-[#00c076]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Transaksi</span>
        </Link>

        {/* Center Action: Floating Quick Catat Button */}
        <Link
          href="/transactions?new=1"
          onClick={handleOpenCatat}
          className="flex flex-col items-center justify-center -mt-5 group"
          aria-label="Catat Transaksi Baru"
        >
          <div className="w-12 h-12 rounded-full bg-[#00c076] hover:bg-[#00d885] active:scale-95 text-[#051610] flex items-center justify-center shadow-[0_4px_16px_rgba(0,192,118,0.45)] transition-all">
            <svg className="w-6 h-6 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 mt-0.5">Catat</span>
        </Link>

        {/* Tab 4: Budget */}
        <Link
          href="/budgets"
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-colors ${
            pathname.startsWith("/budgets")
              ? "text-[#00c076]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Budget</span>
        </Link>

        {/* Tab 5: Menu Drawer Toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-colors ${
            drawerOpen ? "text-[#00c076]" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="2" rx="1"></rect>
            <rect x="3" y="11" width="18" height="2" rx="1"></rect>
            <rect x="3" y="17" width="18" height="2" rx="1"></rect>
          </svg>
          <span>Menu</span>
        </button>
      </nav>

      {/* ── 5. Mobile Slide-Over Drawer Menu ──────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="relative w-[290px] max-w-[85vw] h-full bg-[#081813] border-l border-[#163327] z-50 flex flex-col justify-between p-5 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
            aria-label="Menu navigasi lengkap"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#132820]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-black border border-emerald-500/30 flex items-center justify-center shadow-xs overflow-hidden">
                    <img
                      src="/fintrack-logo.png"
                      alt="FinTrack"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-base font-extrabold text-white tracking-tight">FinTrack</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                  aria-label="Tutup menu"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* User Profile Summary Card */}
              <div className="mt-4 p-3 rounded-2xl bg-[#0c221a] border border-emerald-900/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00c076] to-[#4eedb2] text-[#051610] font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{displayName}</p>
                  {displayId && (
                    <p className="text-[11px] font-medium text-emerald-400/90 truncate">{displayId}</p>
                  )}
                </div>
              </div>

              {/* Quick Action Button */}
              <div className="mt-4">
                <Link
                  href="/transactions?new=1"
                  onClick={(e) => {
                    setDrawerOpen(false);
                    handleOpenCatat(e);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#00c076] hover:bg-[#00a866] text-[#051610] text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
                >
                  <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Catat Transaksi Baru</span>
                </Link>
              </div>

              {/* Navigation Links */}
              <nav className="mt-5 space-y-1">
                <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Menu Utama
                </p>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                        isActive
                          ? "bg-[#00c076]/15 text-[#00c076] border border-[#00c076]/30 shadow-xs"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className={isActive ? "text-[#00c076]" : "text-slate-400"}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-[#132820] mt-6 space-y-3">
              <LogoutButton />
              <p className="text-[10px] text-center text-slate-400">
                FinTrack v0.1 • Personal Finance Manager
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
