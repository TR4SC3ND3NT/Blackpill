import Link from "next/link";
import { Avatar } from "@/components/blackpill/Avatar";

export function TopHeader() {
  return (
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link className="flex items-center gap-2 hover:opacity-70 transition-opacity" href="/ui/dashboard">
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
          aria-label="Account menu"
        >
          <Avatar fallback="B" size="sm" shape="circle" />
        </button>
      </div>
    </div>
  );
}

