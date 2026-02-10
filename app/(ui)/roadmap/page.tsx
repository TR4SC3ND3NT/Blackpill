import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Roadmap",
};

export default function UiRoadmapPage() {
  return (
    <AppShell title="Roadmap" subtitle="What we're building next">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <Card className="rounded-xl border-gray-200/50 p-6">
          <div className="text-sm font-medium text-gray-900">Roadmap</div>
          <p className="mt-2 text-sm text-gray-600">
            This is a placeholder Roadmap page for the Blackpill UI shell.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Add real milestones and timelines here.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

