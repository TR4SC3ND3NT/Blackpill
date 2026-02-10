"use client";

import type * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlassPanel } from "@/components/blackpill/glass/GlassPanel";
import { cn } from "@/lib/cn";

type ProfileNavItem = {
  label: string;
  href: string;
};

const navItems: ProfileNavItem[] = [
  { label: "Account", href: "/ui/profile" },
  { label: "Usage", href: "/ui/profile/usage" },
  { label: "Your Plan", href: "/ui/profile/plan" },
  { label: "Billing", href: "/ui/profile/billing" },
];

export type ProfileShellProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ProfileShell({
  title = "Account",
  subtitle = "Manage your account and subscription",
  children,
}: ProfileShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent">
      <GlassPanel className="bp-glass-header">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              href="/ui/dashboard"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Blackpill" width="32" height="32" />
              <span className="font-bold text-lg hidden min-[360px]:inline">Blackpill</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <nav className="flex items-center gap-3 md:gap-6">
              <Link
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                href="/ui/dashboard"
              >
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
                  className="lucide lucide-arrow-left h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="m12 19-7-7 7-7"></path>
                  <path d="M19 12H5"></path>
                </svg>
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </Link>
            </nav>

            <button
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2"
              type="button"
              aria-label="Avatar menu"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                <span className="text-sm font-medium text-gray-700">B</span>
              </span>
            </button>
          </div>
        </div>
      </GlassPanel>

      <main className="max-w-7xl mx-auto px-4 py-3 md:py-12">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
        </div>

        <div className="mt-8">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            <nav className="lg:hidden -mx-4 px-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                        active
                          ? "bg-black text-white"
                          : "text-gray-600 hover:bg-gray-100 border border-gray-200",
                      )}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <aside className="hidden lg:block w-48 flex-shrink-0">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      className={cn(
                        "block w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                        active ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
                      )}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </main>
    </div>
  );
}
