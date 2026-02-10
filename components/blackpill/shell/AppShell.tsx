"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadingOverlay } from "@/components/blackpill/LoadingOverlay";
import { Footer } from "@/components/blackpill/shell/Footer";
import { Sidebar } from "@/components/blackpill/shell/Sidebar";
import { cn } from "@/lib/cn";
import { saveSelectedAnalysisId } from "@/lib/uiSelectedAnalysis";

export type AppShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  loading?: boolean;
  selectedAnalysisId?: string;
};

export function AppShell({
  children,
  title,
  subtitle,
  rightSlot,
  loading = false,
  selectedAnalysisId,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = "min(320px, 100vw)";

  useEffect(() => {
    if (!selectedAnalysisId) return;
    // Persist selection so other /ui pages can derive from the same "current analysis".
    saveSelectedAnalysisId(selectedAnalysisId);
  }, [selectedAnalysisId]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 relative">
      <Sidebar
        open={sidebarOpen}
        selectedId={selectedAnalysisId}
        onNavigate={() => setSidebarOpen(false)}
      />
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 bg-black/20 z-40"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <main
        className="flex-1 bg-white flex flex-col min-h-0 transition-[margin] duration-300"
        style={{ marginLeft: sidebarOpen ? sidebarWidth : 0 }}
      >
        <div className="flex-shrink-0 border-b border-gray-200/50 bg-white">
          <div className="max-w-7xl mx-auto px-6 h-[var(--bp-header-h)] flex items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                {sidebarOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-x h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-menu h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </svg>
                )}
              </button>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 leading-none truncate">
                  {title}
                </div>
                {subtitle ? (
                  <div className="text-xs text-gray-500 leading-none mt-1 truncate">{subtitle}</div>
                ) : null}
              </div>
            </div>

            <nav className="hidden md:flex flex-1 items-center justify-center gap-3 md:gap-6">
              <HeaderNavLink href="/ui/dashboard" pathname={pathname}>
                Dashboard
              </HeaderNavLink>
              <HeaderNavLink href="/ui/analytics" pathname={pathname}>
                Analytics
              </HeaderNavLink>
              <HeaderNavLink href="/ui/reports" pathname={pathname}>
                Reports
              </HeaderNavLink>
              <HeaderNavLink href="/ui/settings" pathname={pathname}>
                Settings
              </HeaderNavLink>
              <HeaderNavLink href="/ui/profile" pathname={pathname}>
                Profile
              </HeaderNavLink>
            </nav>

            <div className="flex items-center gap-2">

              <nav className="flex md:hidden items-center gap-1">
                <HeaderNavLink href="/ui/dashboard" pathname={pathname}>
                  Dash
                </HeaderNavLink>
                <HeaderNavLink href="/ui/settings" pathname={pathname}>
                  Settings
                </HeaderNavLink>
                <HeaderNavLink href="/ui/profile" pathname={pathname}>
                  Profile
                </HeaderNavLink>
              </nav>

              {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <span className="hidden sm:inline">New analysis</span>
                <span className="sm:hidden">New</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-plus h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">{children}</div>
        <Footer />
      </main>
      <LoadingOverlay open={loading} />
    </div>
  );
}

function HeaderNavLink({
  href,
  pathname,
  children,
}: {
  href: string;
  pathname: string;
  children: React.ReactNode;
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
