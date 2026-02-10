import { Badge } from "@/components/blackpill/Badge";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Notifications",
};

export default function UiNotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Updates and alerts">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Inbox</div>
                <div className="mt-1 text-sm text-gray-600">
                  Notifications are not wired in yet. This page mirrors the reference route.
                </div>
              </div>
              <Badge>0</Badge>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline">Mark all read</Button>
              <Button variant="outline">Preferences</Button>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-6">
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-6 text-center">
                <div className="text-sm font-medium text-gray-900">No notifications</div>
                <div className="mt-1 text-sm text-gray-600">You are all caught up.</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
