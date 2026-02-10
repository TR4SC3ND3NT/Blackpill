import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Terms",
};

export default function UiTermsPage() {
  return (
    <AppShell title="Terms" subtitle="Terms of service">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <Card className="rounded-xl border-gray-200/50 p-6">
          <div className="text-sm font-medium text-gray-900">Terms</div>
          <p className="mt-2 text-sm text-gray-600">
            This is a placeholder Terms page for the Blackpill UI shell.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Replace this content with your actual terms before production.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

