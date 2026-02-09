"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import type { AnalysisSnapshot } from "@/lib/analysisHistory";
import { formatAgoShort, loadSnapshots, subscribeSnapshots } from "@/lib/analysisHistory";
import type { ReportExport, ReportExportStatus } from "@/lib/reportHistory";
import { addReportExport, loadReportExports, subscribeReportExports } from "@/lib/reportHistory";
import { cn } from "@/lib/cn";

const downloadJson = (fileName: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const badgeVariant = (status: ReportExportStatus): "neutral" | "success" | "danger" => {
  switch (status) {
    case "Complete":
      return "success";
    case "Failed":
      return "danger";
    case "Queued":
    default:
      return "neutral";
  }
};

export function ReportsScreen() {
  const [snapshots, setSnapshots] = useState<AnalysisSnapshot[]>(() => loadSnapshots());
  const [reports, setReports] = useState<ReportExport[]>(() => loadReportExports());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportExportStatus | "">("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");

  useEffect(() => {
    return subscribeSnapshots(() => setSnapshots(loadSnapshots()));
  }, []);

  useEffect(() => {
    return subscribeReportExports(() => setReports(loadReportExports()));
  }, []);

  const effectiveSelectedId = selectedAnalysisId || snapshots[0]?.id || "";
  const canExport = Boolean(effectiveSelectedId);

  const baselineNow = useMemo(() => {
    const iso = reports[0]?.createdAtIso ?? snapshots[0]?.createdAtIso ?? "1970-01-01T00:00:00.000Z";
    return new Date(iso).getTime();
  }, [reports, snapshots]);

  const visibleReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (status && r.status !== status) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.analysisId.toLowerCase().includes(q) ||
        (r.cohortKey ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, reports, status]);

  const exportSnapshot = (analysisId: string) => {
    const snap = snapshots.find((s) => s.id === analysisId) ?? null;
    if (!snap) return;

    const exportedAtIso = new Date().toISOString();
    const fileName = `blackpill-report-${analysisId}.json`;

    downloadJson(fileName, {
      kind: "blackpill-report-v1",
      exportedAtIso,
      snapshot: snap,
    });

    addReportExport({
      id: `rpt_${analysisId}_${exportedAtIso}`,
      createdAtIso: exportedAtIso,
      analysisId,
      cohortKey: snap.cohortKey ?? null,
      overall: Math.round(snap.overall),
      status: "Complete",
      fileName,
    });
  };

  return (
    <AppShell
      title="Reports"
      subtitle="Exports and history"
      rightSlot={
        <button
          type="button"
          disabled={!canExport}
          onClick={() => exportSnapshot(effectiveSelectedId)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
            canExport
              ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-200"
              : "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed",
          )}
          title={canExport ? "Export latest analysis snapshot" : "Run an analysis to enable exports"}
        >
          Export
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-download h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
        </button>
      }
    >
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-6">
          <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">Filters</div>
                <div className="mt-1 text-xs text-gray-500">UI-only controls. Export is real.</div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search reports..."
                    className="w-full sm:w-64 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <select
                  className="w-full sm:w-44 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReportExportStatus | "")}
                >
                  <option value="">All statuses</option>
                  {(["Complete", "Queued", "Failed"] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full sm:w-56 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                  value={effectiveSelectedId}
                  onChange={(e) => setSelectedAnalysisId(e.target.value)}
                  disabled={!snapshots.length}
                >
                  {snapshots.length ? null : <option value="">No analyses</option>}
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      Analysis {s.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/60 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Report history</div>
                <div className="mt-1 text-xs text-gray-500">
                  Stored locally in your browser.
                </div>
              </div>
              <Badge className="bg-gray-50 text-gray-600">{visibleReports.length}</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 sm:px-6 py-3">Report</th>
                    <th className="px-4 sm:px-6 py-3">Date</th>
                    <th className="px-4 sm:px-6 py-3">Cohort</th>
                    <th className="px-4 sm:px-6 py-3">Overall</th>
                    <th className="px-4 sm:px-6 py-3">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleReports.length ? (
                    visibleReports.map((row) => {
                      const canDownload = Boolean(snapshots.find((s) => s.id === row.analysisId));
                      return (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{row.fileName}</div>
                            <div className="mt-1 text-xs text-gray-500">JSON export</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                            {formatAgoShort(row.createdAtIso, baselineNow)} ago
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                            {row.cohortKey ?? "—"}
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <span className="text-sm font-semibold text-gray-900 tabular-nums">
                              {row.overall ?? "—"}
                            </span>
                            <span className="text-sm text-gray-500"> / 100</span>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <Badge variant={badgeVariant(row.status)}>{row.status}</Badge>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right">
                            <button
                              type="button"
                              disabled={!canDownload}
                              onClick={() => exportSnapshot(row.analysisId)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
                                canDownload
                                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-200"
                                  : "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed",
                              )}
                              title={canDownload ? "Download again" : "Source analysis no longer available"}
                            >
                              Download
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="lucide lucide-download h-4 w-4"
                                aria-hidden="true"
                              >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <path d="M7 10l5 5 5-5" />
                                <path d="M12 15V3" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-4 sm:px-6 py-10 text-center text-sm text-gray-600" colSpan={6}>
                        No exports yet. Use the Export button to generate a report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">Export notes</div>
                <div className="mt-1 text-xs text-gray-500">
                  Exports are generated client-side from locally stored analysis snapshots.
                </div>
              </div>
              <Badge className="bg-gray-50 text-gray-600">Local</Badge>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
