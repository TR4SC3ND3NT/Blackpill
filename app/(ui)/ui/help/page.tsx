import Link from "next/link";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Help",
};

export default function UiHelpPage() {
  return (
    <AppShell title="Help" subtitle="Documentation and support">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          <Link href="/ui/help/documentation" className="block">
            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6 hover:bg-gray-50 transition-colors">
              <div className="text-sm font-medium text-gray-900">Documentation</div>
              <div className="mt-1 text-sm text-gray-600">
                How the app works, what the scores mean, and troubleshooting.
              </div>
            </Card>
          </Link>

          <Link href="/ui/help/support" className="block">
            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6 hover:bg-gray-50 transition-colors">
              <div className="text-sm font-medium text-gray-900">Support</div>
              <div className="mt-1 text-sm text-gray-600">
                Contact options, bug reports, and feature requests.
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
