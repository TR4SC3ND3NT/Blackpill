import { Badge } from "@/components/blackpill/Badge";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Billing",
};

export default function UiBillingPage() {
  return (
    <AppShell title="Billing" subtitle="Plan, payment method, and invoices">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Current plan</div>
                <div className="mt-1 text-sm text-gray-600">Free (UI-only)</div>
              </div>
              <Badge>Active</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="primary">Upgrade</Button>
              <Button variant="outline">View plans</Button>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">Payment method</div>
              <div className="mt-1 text-xs text-gray-500">No payment methods on file.</div>
            </div>
            <div className="px-4 sm:px-6 py-6">
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-5">
                <div className="text-sm font-medium text-gray-900">Add a payment method</div>
                <div className="mt-1 text-sm text-gray-600">
                  This is a UI shell only. Payment processing is not wired in.
                </div>
                <div className="mt-4">
                  <Button variant="outline">Add card</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">Invoices</div>
              <div className="mt-1 text-xs text-gray-500">No invoices yet.</div>
            </div>
            <div className="px-4 sm:px-6 py-6">
              <div className="text-sm text-gray-600">Once billing is enabled, invoices will appear here.</div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
