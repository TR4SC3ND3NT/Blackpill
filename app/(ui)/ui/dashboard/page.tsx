import { AppShell } from "@/components/blackpill/shell/AppShell";
import { DashboardContent } from "@/components/blackpill/dashboard/DashboardContent";
import Link from "next/link";

export const metadata = {
  title: "Dashboard",
};

export default function UiDashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      subtitle="Overview and recent analyses"
      rightSlot={
        <Link
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
          href="/"
        >
          New
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
      }
    >
      <DashboardContent />
    </AppShell>
  );
}
