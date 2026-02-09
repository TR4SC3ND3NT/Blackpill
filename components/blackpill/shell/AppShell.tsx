"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingOverlay } from "@/components/blackpill/LoadingOverlay";
import { Footer } from "@/components/blackpill/shell/Footer";
import { Sidebar } from "@/components/blackpill/shell/Sidebar";

export type AppShellProps = {
  children: React.ReactNode;
  loading?: boolean;
  selectedAnalysisId?: string;
};

export function AppShell({ children, loading = false, selectedAnalysisId }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = "min(320px, 100vw)";

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
        <div className="flex-shrink-0 border-b border-gray-200/60 bg-white">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-gray-100 transition-colors text-gray-700"
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
                  Dashboard
                </div>
                <div className="text-xs text-gray-500 leading-none mt-1 truncate">
                  Overview and recent analyses
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                href="/"
              >
                New analysis
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
