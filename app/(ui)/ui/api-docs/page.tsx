import { AppShell } from "@/components/blackpill/shell/AppShell";
import { Card } from "@/components/blackpill/Card";

export const metadata = {
  title: "API Docs",
};

export default function UiApiDocsPage() {
  return (
    <AppShell title="API Docs" subtitle="Local endpoints (MVP)">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-4">
          <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
            <div className="text-sm font-medium text-gray-900">Base URL</div>
            <div className="mt-2 text-sm text-gray-600">
              All endpoints are served from the same origin:
              <span className="ml-2 inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">
                /api/*
              </span>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/50 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">Endpoints</div>
              <div className="mt-1 text-xs text-gray-500">
                This project uses a catch-all Next route: <span className="font-mono">app/api/[...path]/route.ts</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              <Row method="GET" path="/api/health" desc="Health check + build flags." />
              <Row method="GET" path="/api/subscription" desc="Stub quota/subscription payload." />
              <Row method="GET" path="/api/auth/session" desc="Stub session payload." />
              <Row method="GET" path="/api/faces/:id" desc="Fetch a face record." />
              <Row method="GET" path="/api/faces/:id/segmented" desc="Stub segmented image status." />
              <Row method="GET" path="/api/faces/:id/mediapipe" desc="Fetch stored MediaPipe landmarks." />
              <Row method="POST" path="/api/faces" desc="Create a face record from photos + landmarks." />
              <Row method="POST" path="/api/faces/:id/mediapipe" desc="Save MediaPipe landmarks for a face." />
              <Row method="POST" path="/api/side-landmarks" desc="Derive a side-landmarks payload from landmarks + image size." />
              <Row method="POST" path="/api/background-removal" desc="Stub background removal (echo)." />
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {method}
        </span>
        <span className="font-mono text-xs text-gray-900 break-all">{path}</span>
      </div>
      <div className="text-xs text-gray-500">{desc}</div>
    </div>
  );
}
