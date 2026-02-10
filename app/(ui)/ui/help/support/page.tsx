import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Help Support",
};

export default function UiHelpSupportPage() {
  return (
    <AppShell title="Help" subtitle="Support">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Contact</div>
            <div className="mt-2 text-sm text-gray-600">
              For issues, include your browser, a screenshot, and steps to reproduce.
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline">Email support</Button>
              <Button variant="outline">Open Discord</Button>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Bug reports</div>
            <div className="mt-2 text-sm text-gray-600">
              UI routes are isolated under <span className="font-mono text-xs">/ui/*</span>. If you see rendering glitches, note the route and the selected analysis id (if any).
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
