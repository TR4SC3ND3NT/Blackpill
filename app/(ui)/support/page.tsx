import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Support",
};

export default function UiSupportPage() {
  return (
    <AppShell title="Support" subtitle="Help and contact">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <Card className="rounded-xl border-gray-200/50 p-6">
          <div className="text-sm font-medium text-gray-900">Support</div>
          <p className="mt-2 text-sm text-gray-600">
            This is a placeholder support page for the Blackpill UI shell.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            If you need help, please reach out via your preferred channel.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

