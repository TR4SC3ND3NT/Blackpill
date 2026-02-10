import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";

export const metadata = {
  title: "Help Documentation",
};

export default function UiHelpDocumentationPage() {
  return (
    <AppShell title="Help" subtitle="Documentation">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Getting started</div>
            <div className="mt-2 text-sm text-gray-600">
              Use <span className="font-medium">New analysis</span> to upload photos, then review results and export reports.
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Scores</div>
            <div className="mt-2 text-sm text-gray-600">
              Overall and pillar scores are stored locally as snapshots so they can be charted in Analytics and exported in Reports.
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Troubleshooting</div>
            <div className="mt-2 text-sm text-gray-600">
              If a page looks empty, ensure you have at least one saved snapshot. Use the New analysis flow (UI) or the main analyzer to generate data.
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
