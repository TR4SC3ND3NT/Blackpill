import { Badge } from "@/components/blackpill/Badge";
import { Button } from "@/components/blackpill/Button";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Team",
};

export default function UiTeamPage() {
  return (
    <AppShell title="Team" subtitle="Members and roles (UI-only)">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Workspace</div>
                <div className="mt-1 text-sm text-gray-600">
                  This is a UI shell to mirror the reference route.
                </div>
              </div>
              <Badge>Free</Badge>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Members</div>
                <div className="mt-1 text-xs text-gray-500">1 member</div>
              </div>
              <Button variant="outline">Invite</Button>
            </div>
            <div className="divide-y divide-gray-100">
              <MemberRow name="Blackpill User" email="user@example.com" role="Owner" />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function MemberRow({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
        <div className="mt-1 text-xs text-gray-500 truncate">{email}</div>
      </div>
      <Badge className="shrink-0">{role}</Badge>
    </div>
  );
}
