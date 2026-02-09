import type * as React from "react";
import { LoadingOverlay } from "@/components/blackpill/LoadingOverlay";
import { Footer } from "@/components/blackpill/shell/Footer";
import { Sidebar } from "@/components/blackpill/shell/Sidebar";

export type AppShellProps = {
  children: React.ReactNode;
  loading?: boolean;
};

export function AppShell({ children, loading = false }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 relative">
      <Sidebar />
      <main
        className="flex-1 bg-white flex flex-col min-h-0 transition-[margin] duration-300"
        style={{ marginLeft: 0 }}
      >
        <div className="flex-1 min-h-0">{children}</div>
        <Footer />
      </main>
      <LoadingOverlay open={loading} />
    </div>
  );
}

