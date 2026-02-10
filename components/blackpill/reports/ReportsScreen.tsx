"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import type { AnalysisSnapshot } from "@/lib/analysisHistory";
import { formatAgoShort, loadSnapshots, subscribeSnapshots } from "@/lib/analysisHistory";
import type { ReportExport, ReportExportStatus } from "@/lib/reportHistory";
import {
  clearReportExports,
  deleteReportExport,
  loadReportExports,
  saveReportExport,
  subscribeReportExports,
} from "@/lib/reportHistory";
import { buildSnapshotReportPayload, snapshotMetricsToCsv } from "@/lib/snapshotExport";
import { cn } from "@/lib/cn";
import {
  loadSelectedAnalysisId,
  saveSelectedAnalysisId,
  subscribeSelectedAnalysisId,
} from "@/lib/uiSelectedAnalysis";

const downloadText = (fileName: string, contents: string, type: string) => {
  const blob = new Blob([contents], { type });
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

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.top = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
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
  const [snapshots, setSnapshots] = useState<AnalysisSnapshot[]>([]);
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [reports, setReports] = useState<ReportExport[]>([]);
  const [reportsReady, setReportsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportExportStatus | "">("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    const load = () => {
      setSnapshots(loadSnapshots());
      setSnapshotsReady(true);
    };
    const unsubscribe = subscribeSnapshots(load);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(load);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const load = () => {
      setReports(loadReportExports());
      setReportsReady(true);
    };
    const unsubscribe = subscribeReportExports(load);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(load);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const apply = () => {
      const id = loadSelectedAnalysisId();
      setSelectedAnalysisId((prev) => (prev ? prev : id ?? ""));
    };
    const unsubscribe = subscribeSelectedAnalysisId(apply);
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(apply);
    return unsubscribe;
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
        r.fileName.toLowerCase().includes(q) ||
        (r.cohortKey ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, reports, status]);

  const effectiveSelectedReportId = useMemo(() => {
    if (selectedReportId && visibleReports.some((r) => r.id === selectedReportId)) return selectedReportId;
    return visibleReports[0]?.id ?? "";
  }, [selectedReportId, visibleReports]);

  type ExportFormat = "json" | "csv";

  const exportSnapshot = (analysisId: string, format: ExportFormat, track = true) => {
    const snap = snapshots.find((s) => s.id === analysisId) ?? null;
    if (!snap) return;

    const exportedAtIso = new Date().toISOString();
    const exportId = `rpt_${format}_${analysisId}_${exportedAtIso}`;
    const fileName =
      format === "csv"
        ? `blackpill-metrics-${analysisId}.csv`
        : `blackpill-report-${analysisId}.json`;

    if (track) {
      saveReportExport({
        id: exportId,
        createdAtIso: exportedAtIso,
        analysisId,
        cohortKey: snap.cohortKey ?? null,
        overall: Math.round(snap.overall),
        status: "Queued",
        fileName,
      });
    }

    try {
      if (format === "csv") {
        const csv = snapshotMetricsToCsv(snap);
        downloadText(fileName, csv, "text/csv");
      } else {
        const payload = buildSnapshotReportPayload(snap, exportedAtIso);
        downloadText(fileName, JSON.stringify(payload, null, 2), "application/json");
      }

      if (track) {
        saveReportExport({
          id: exportId,
          createdAtIso: exportedAtIso,
          analysisId,
          cohortKey: snap.cohortKey ?? null,
          overall: Math.round(snap.overall),
          status: "Complete",
          fileName,
        });
      }
    } catch {
      if (track) {
        saveReportExport({
          id: exportId,
          createdAtIso: exportedAtIso,
          analysisId,
          cohortKey: snap.cohortKey ?? null,
          overall: Math.round(snap.overall),
          status: "Failed",
          fileName,
        });
      }
    }
  };

  const onCopyJson = async (analysisId: string) => {
    const snap = snapshots.find((s) => s.id === analysisId) ?? null;
    if (!snap) return;

    const payload = buildSnapshotReportPayload(snap, new Date().toISOString());
    const ok = await copyToClipboard(JSON.stringify(payload, null, 2));
    setCopyStatus(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 1600);
  };

  const selectedReport = useMemo(() => {
    if (!effectiveSelectedReportId) return null;
    return visibleReports.find((r) => r.id === effectiveSelectedReportId) ?? null;
  }, [effectiveSelectedReportId, visibleReports]);

  const selectedReportSnapshot = useMemo(() => {
    if (!selectedReport) return null;
    return snapshots.find((s) => s.id === selectedReport.analysisId) ?? null;
  }, [selectedReport, snapshots]);

  const onSelectReport = (report: ReportExport) => {
    setSelectedReportId(report.id);
    setSelectedAnalysisId(report.analysisId);
    saveSelectedAnalysisId(report.analysisId);
  };

  return (
    <AppShell title="Reports" subtitle="Exports and history">
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        {!snapshotsReady || !reportsReady ? (
          <div className="space-y-6">
            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-3 w-24 rounded bg-gray-900/10" />
                  <div className="h-3 w-20 rounded bg-gray-900/10" />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="h-10 w-full sm:w-64 rounded bg-gray-900/10" />
                  <div className="h-10 w-full sm:w-44 rounded bg-gray-900/10" />
                  <div className="h-10 w-full sm:w-56 rounded bg-gray-900/10" />
                </div>
              </div>
            </Card>

            <Card className="rounded-xl border-gray-200/50 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="h-3 w-28 rounded bg-gray-900/10 animate-pulse" />
                  <div className="mt-2 h-2 w-44 rounded bg-gray-900/10 animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded bg-gray-900/10 animate-pulse" />
              </div>
              <div className="p-4 sm:p-6">
                <div className="animate-pulse space-y-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div className="h-3 w-56 rounded bg-gray-900/10" />
                      <div className="h-3 w-20 rounded bg-gray-900/10" />
                    </div>
                  ))}
                  <div className="h-10 rounded bg-gray-900/5" />
                </div>
              </div>
            </Card>

            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-28 rounded bg-gray-900/10" />
                <div className="h-2 w-2/3 rounded bg-gray-900/10" />
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              <div className="flex-1 min-w-0 space-y-4">
                <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">Report history</div>
                      <div className="mt-1 text-xs text-gray-500">Search, filter, and select an export.</div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="relative">
                        <input
                          type="search"
                          placeholder="Search reports..."
                          className="w-full sm:w-64 rounded-md border border-white/60 bg-white/70 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 supports-[backdrop-filter]:backdrop-blur-sm"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>

                      <div className="inline-flex items-center rounded-xl border border-white/60 bg-white/60 p-1 supports-[backdrop-filter]:backdrop-blur-sm">
                        {([
                          { label: "All", value: "" },
                          { label: "Complete", value: "Complete" },
                          { label: "Queued", value: "Queued" },
                          { label: "Failed", value: "Failed" },
                        ] as Array<{ label: string; value: "" | ReportExportStatus }>).map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => setStatus(t.value)}
                            className={cn(
                              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                              status === t.value
                                ? "bg-gray-900 text-white"
                                : "text-gray-600 hover:text-gray-900 hover:bg-white/70",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-xl border-gray-200/50 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-white/50 flex items-start justify-between gap-4 supports-[backdrop-filter]:backdrop-blur-sm bg-white/40">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Exports</div>
                      <div className="mt-1 text-xs text-gray-500">Stored locally in your browser.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/60 text-gray-600">{visibleReports.length}</Badge>
                      <button
                        type="button"
                        disabled={!reports.length}
                        onClick={() => {
                          if (!reports.length) return;
                          if (!window.confirm("Clear export history? This removes report records from this browser.")) {
                            return;
                          }
                          clearReportExports();
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border",
                          reports.length
                            ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                            : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                        )}
                        title="Clear export history"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/35 supports-[backdrop-filter]:backdrop-blur-sm">
                        <tr className="text-left text-xs font-medium text-gray-500">
                          <th className="px-4 sm:px-6 py-3">Report</th>
                          <th className="px-4 sm:px-6 py-3">Age</th>
                          <th className="px-4 sm:px-6 py-3">Cohort</th>
                          <th className="px-4 sm:px-6 py-3">Overall</th>
                          <th className="px-4 sm:px-6 py-3">Status</th>
                          <th className="px-4 sm:px-6 py-3 text-right"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/45">
                        {visibleReports.length ? (
                          visibleReports.map((row) => {
                            const isSelected = row.id === effectiveSelectedReportId;
                            const format: ExportFormat = row.fileName.toLowerCase().endsWith(".csv") ? "csv" : "json";
                            const label = format === "csv" ? "CSV" : "JSON";

                            return (
                              <tr
                                key={row.id}
                                className={cn(
                                  "transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300",
                                  isSelected ? "bg-white/70" : "hover:bg-white/55",
                                )}
                                onClick={() => onSelectReport(row)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelectReport(row);
                                  }
                                }}
                                tabIndex={0}
                                aria-selected={isSelected}
                              >
                                <td className="px-4 sm:px-6 py-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className="w-1 h-10 rounded-full transition-colors"
                                      style={{
                                        background: isSelected ? "rgb(17 24 39)" : "rgba(209, 213, 219, 0.9)",
                                        opacity: isSelected ? 0.85 : 0.6,
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                                          style={{
                                            background: "transparent",
                                            color: "#72838c",
                                            letterSpacing: "0.08em",
                                            border: "1px dashed rgba(114, 131, 140, 0.3)",
                                          }}
                                        >
                                          {label}
                                        </span>
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                          {row.fileName}
                                        </div>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500 truncate">
                                        Analysis {row.analysisId}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 tabular-nums">
                                  {formatAgoShort(row.createdAtIso, baselineNow)} ago
                                </td>
                                <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">{row.cohortKey ?? "—"}</td>
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
                                    className={cn(
                                      "lucide lucide-chevron-right h-4 w-4 inline-block transition-all",
                                      isSelected
                                        ? "text-gray-700 opacity-100 translate-x-0"
                                        : "text-gray-400 opacity-60 -translate-x-1",
                                    )}
                                    aria-hidden="true"
                                  >
                                    <path d="m9 18 6-6-6-6" />
                                  </svg>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="px-4 sm:px-6 py-10 text-center text-sm text-gray-600" colSpan={6}>
                              No exports yet. Generate a report from the Export panel.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <aside className="w-full lg:w-[360px] flex-shrink-0 space-y-4">
                <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Selected export</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {selectedReport ? `Export ${selectedReport.id}` : "Select a row from the table."}
                      </div>
                    </div>
                    {selectedReport ? (
                      <Badge variant={badgeVariant(selectedReport.status)}>{selectedReport.status}</Badge>
                    ) : (
                      <Badge className="bg-white/60 text-gray-600">None</Badge>
                    )}
                  </div>

                  {selectedReport ? (
                    <div className="mt-5 space-y-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{selectedReport.fileName}</div>
                        <div className="mt-1 text-xs text-gray-500 truncate">
                          Analysis {selectedReport.analysisId} • {formatAgoShort(selectedReport.createdAtIso, baselineNow)}{" "}
                          ago
                        </div>
                      </div>

                      <div className="space-y-2">
                        <MetaRow label="Cohort" value={selectedReport.cohortKey ?? "—"} />
                        <MetaRow label="Overall" value={selectedReport.overall != null ? `${selectedReport.overall}/100` : "—"} />
                        <MetaRow label="Source" value={selectedReportSnapshot ? "Snapshot available" : "Missing snapshot"} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Link
                          href={`/results/${selectedReport.analysisId}`}
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors border border-white/60"
                        >
                          View results
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
                            className="lucide lucide-external-link h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          </svg>
                        </Link>

                        <Link
                          href={`/ui/dashboard/${selectedReport.analysisId}`}
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/70 transition-colors border border-white/60"
                        >
                          Open in UI
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
                            className="lucide lucide-arrow-right h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!selectedReportSnapshot}
                          onClick={() => onCopyJson(selectedReport.analysisId)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
                            selectedReportSnapshot
                              ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                              : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                          )}
                          title={selectedReportSnapshot ? "Copy JSON to clipboard" : "Snapshot missing for this export"}
                        >
                          {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy JSON"}
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
                            className="lucide lucide-copy h-4 w-4"
                            aria-hidden="true"
                          >
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          disabled={!(selectedReport.status === "Complete" && selectedReportSnapshot)}
                          onClick={() => {
                            const format: ExportFormat = selectedReport.fileName.toLowerCase().endsWith(".csv")
                              ? "csv"
                              : "json";
                            exportSnapshot(selectedReport.analysisId, format, false);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
                            selectedReport.status === "Complete" && selectedReportSnapshot
                              ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                              : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                          )}
                          title={
                            selectedReport.status === "Complete" && selectedReportSnapshot
                              ? "Download again"
                              : selectedReport.status === "Queued"
                                ? "Export still queued"
                                : "Snapshot missing for this export"
                          }
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

                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Delete this export record? This cannot be undone.")) return;
                            deleteReportExport(selectedReport.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-50 transition-colors border border-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="rounded-xl border border-white/55 bg-white/40 p-4 supports-[backdrop-filter]:backdrop-blur-sm">
                        <div className="text-sm font-medium text-gray-900">No export selected</div>
                        <div className="mt-1 text-xs text-gray-500">
                          Select a row to preview details and download again.
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Export</div>
                      <div className="mt-1 text-xs text-gray-500">Generate a fresh JSON/CSV export.</div>
                    </div>
                    <Badge className="bg-white/60 text-gray-600">Local</Badge>
                  </div>

                  <div className="mt-5 space-y-3">
                    <select
                      className="w-full rounded-md border border-white/60 bg-white/70 px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 supports-[backdrop-filter]:backdrop-blur-sm disabled:opacity-60"
                      value={effectiveSelectedId}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectedAnalysisId(next);
                        saveSelectedAnalysisId(next);
                      }}
                      disabled={!snapshots.length}
                    >
                      {snapshots.length ? null : <option value="">No analyses</option>}
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          Analysis {s.id}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!canExport}
                        onClick={() => onCopyJson(effectiveSelectedId)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
                          canExport
                            ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                            : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                        )}
                        title={canExport ? "Copy JSON to clipboard" : "Run an analysis to enable exports"}
                      >
                        Copy JSON
                      </button>

                      <button
                        type="button"
                        disabled={!canExport}
                        onClick={() => exportSnapshot(effectiveSelectedId, "json")}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
                          canExport
                            ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                            : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                        )}
                        title={canExport ? "Export JSON report" : "Run an analysis to enable exports"}
                      >
                        Export JSON
                      </button>

                      <button
                        type="button"
                        disabled={!canExport}
                        onClick={() => exportSnapshot(effectiveSelectedId, "csv")}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border",
                          canExport
                            ? "text-gray-600 hover:text-gray-900 hover:bg-white/70 border-white/60"
                            : "text-gray-400 border-white/50 bg-white/40 cursor-not-allowed",
                        )}
                        title={canExport ? "Export CSV metrics" : "Run an analysis to enable exports"}
                      >
                        Export CSV
                      </button>

                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-400 border border-white/50 bg-white/40 cursor-not-allowed"
                        title="PDF export is a UI stub for now"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                  <div className="text-sm font-medium text-gray-900">Export notes</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Exports are generated client-side from locally stored analysis snapshots (JSON report or CSV metrics).
                  </div>
                </Card>
              </aside>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
    </div>
  );
}
