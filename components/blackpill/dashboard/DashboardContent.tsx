"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { LineAreaChart } from "@/components/blackpill/charts/LineAreaChart";
import type { AnalysisSnapshot } from "@/lib/analysisHistory";
import { formatAgoShort, loadSnapshots, subscribeSnapshots } from "@/lib/analysisHistory";
import { cn } from "@/lib/cn";
import {
  loadSelectedAnalysisId,
  saveSelectedAnalysisId,
  subscribeSelectedAnalysisId,
} from "@/lib/uiSelectedAnalysis";

export type DashboardContentProps = {
  selectedId?: string;
};

export function DashboardContent({ selectedId }: DashboardContentProps) {
  const [snapshots, setSnapshots] = useState<AnalysisSnapshot[]>([]);
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [storedSelectedId, setStoredSelectedId] = useState<string | null>(null);

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
    const unsubscribe = subscribeSelectedAnalysisId(() =>
      setStoredSelectedId(loadSelectedAnalysisId()),
    );
    // Avoid hydration mismatch: load localStorage only after mount (async).
    queueMicrotask(() => setStoredSelectedId(loadSelectedAnalysisId()));
    return unsubscribe;
  }, []);

  const effectiveSelectedId = useMemo(() => {
    if (selectedId && snapshots.some((s) => s.id === selectedId)) return selectedId;
    if (storedSelectedId && snapshots.some((s) => s.id === storedSelectedId)) return storedSelectedId;
    return snapshots[0]?.id ?? null;
  }, [selectedId, snapshots, storedSelectedId]);

  useEffect(() => {
    // For /ui/dashboard (no route param), keep the last selected analysis sticky across /ui pages.
    if (selectedId) return;
    if (!effectiveSelectedId) return;
    if (storedSelectedId === effectiveSelectedId) return;
    saveSelectedAnalysisId(effectiveSelectedId);
  }, [effectiveSelectedId, selectedId, storedSelectedId]);

  const { history, kpis, series, selected, cohortLabel } = useMemo(() => {
    if (!snapshots.length) {
      return {
        history: [],
        kpis: {
          overallAvg: 0,
          overallAvgDelta: undefined,
          bestOverall: 0,
          analysesCount: 0,
          last7Days: 0,
        },
        series: { overall: [] as Array<{ t: string; overall: number }> },
        selected: null,
        cohortLabel: "—",
      };
    }

    const baselineNow = new Date(snapshots[0]?.createdAtIso ?? 0).getTime();
    const historyFromSnapshots = snapshots.map((s) => ({
      id: s.id,
      createdAtLabel: formatAgoShort(s.createdAtIso, baselineNow),
      overall: Math.round(s.overall),
      harmony: Number((s.pillarScores.harmony / 10).toFixed(1)),
      angularity: Number((s.pillarScores.angularity / 10).toFixed(1)),
      dimorphism: Number((s.pillarScores.dimorphism / 10).toFixed(1)),
      features: Number((s.pillarScores.features / 10).toFixed(1)),
      thumbnailUrl: s.frontPhotoUrl ?? null,
    }));

    const dayMs = 24 * 60 * 60 * 1000;
    const inLastDays = (iso: string, days: number) =>
      new Date(iso).getTime() >= baselineNow - days * dayMs;

    const overalls = snapshots.map((s) => s.overall).filter((n) => Number.isFinite(n));
    const overallAvg = Math.round(overalls.reduce((acc, v) => acc + v, 0) / Math.max(1, overalls.length));
    const bestOverall = Math.round(overalls.reduce((m, v) => Math.max(m, v), 0));

    const last7 = snapshots.filter((s) => inLastDays(s.createdAtIso, 7));
    const prev7 = snapshots.filter((s) => !inLastDays(s.createdAtIso, 7) && inLastDays(s.createdAtIso, 14));
    const avg = (arr: AnalysisSnapshot[]) =>
      arr.length ? arr.reduce((acc, s) => acc + s.overall, 0) / arr.length : null;
    const overallAvgDelta =
      last7.length && prev7.length ? Math.round((avg(last7) ?? 0) - (avg(prev7) ?? 0)) : undefined;

    const kpisFromSnapshots = {
      overallAvg,
      overallAvgDelta,
      bestOverall,
      analysesCount: snapshots.length,
      last7Days: last7.length,
    };

    const seriesFromSnapshots = {
      overall: snapshots
        .slice()
        .sort((a, b) => (a.createdAtIso || "").localeCompare(b.createdAtIso || ""))
        .slice(-30)
        .map((s) => ({ t: s.createdAtIso, overall: Math.round(s.overall) })),
    };

    const selectedSnapshot = effectiveSelectedId
      ? snapshots.find((s) => s.id === effectiveSelectedId) ?? null
      : null;
    const selectedFromSnapshots = selectedSnapshot
      ? {
          id: selectedSnapshot.id,
          name: `Analysis ${selectedSnapshot.id}`,
          createdAtIso: selectedSnapshot.createdAtIso,
          createdAtLabel: formatAgoShort(selectedSnapshot.createdAtIso, baselineNow),
          overall: Math.round(selectedSnapshot.overall),
          pillars: {
            harmony: Number((selectedSnapshot.pillarScores.harmony / 10).toFixed(1)),
            angularity: Number((selectedSnapshot.pillarScores.angularity / 10).toFixed(1)),
            dimorphism: Number((selectedSnapshot.pillarScores.dimorphism / 10).toFixed(1)),
            features: Number((selectedSnapshot.pillarScores.features / 10).toFixed(1)),
          },
          notes: `Cohort: ${selectedSnapshot.cohortKey}.`,
        }
      : null;

    const cohortLabel = selectedSnapshot?.cohortKey ?? snapshots[0]?.cohortKey ?? "—";

    return {
      history: historyFromSnapshots,
      kpis: kpisFromSnapshots,
      series: seriesFromSnapshots,
      selected: selectedFromSnapshots,
      cohortLabel,
    };
  }, [effectiveSelectedId, snapshots]);

  if (!snapshotsReady) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <div className="space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="rounded-xl border-gray-200/50 p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded bg-gray-900/10" />
                  <div className="h-7 w-16 rounded bg-gray-900/10" />
                  <div className="h-3 w-20 rounded bg-gray-900/10" />
                </div>
              </Card>
            ))}
          </section>

          <section className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            <div className="flex-1 min-w-0 space-y-4">
              <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                <div className="animate-pulse space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-4 w-32 rounded bg-gray-900/10" />
                    <div className="h-9 w-24 rounded bg-gray-900/10" />
                  </div>
                  <div className="h-10 w-24 rounded bg-gray-900/10" />
                  <div className="h-3 w-2/3 rounded bg-gray-900/10" />
                  <div className="space-y-3 pt-2">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="h-3 w-20 rounded bg-gray-900/10" />
                        <div className="h-2 flex-1 rounded bg-gray-900/10" />
                        <div className="h-3 w-8 rounded bg-gray-900/10" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="rounded-xl border-gray-200/50 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="h-3 w-24 rounded bg-gray-900/10 animate-pulse" />
                    <div className="mt-2 h-2 w-44 rounded bg-gray-900/10 animate-pulse" />
                  </div>
                  <div className="h-6 w-24 rounded bg-gray-900/10 animate-pulse" />
                </div>
                <div className="px-4 sm:px-6 py-6">
                  <div
                    className="h-48 rounded-xl border border-gray-200/50 bg-gradient-to-b from-gray-50 to-white animate-pulse"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, rgba(17, 24, 39, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(17, 24, 39, 0.04) 1px, transparent 1px)",
                      backgroundSize: "48px 48px",
                    }}
                  />
                </div>
              </Card>

              <Card className="rounded-xl border-gray-200/50 overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                  <div className="h-3 w-32 rounded bg-gray-900/10 animate-pulse" />
                  <div className="mt-2 h-2 w-52 rounded bg-gray-900/10 animate-pulse" />
                </div>
                <div className="divide-y divide-gray-100">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="px-4 sm:px-6 py-4 animate-pulse">
                      <div className="flex items-center justify-between gap-4">
                        <div className="h-3 w-56 rounded bg-gray-900/10" />
                        <div className="h-3 w-16 rounded bg-gray-900/10" />
                      </div>
                      <div className="mt-2 h-2 w-44 rounded bg-gray-900/10" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <aside className="w-full lg:w-[360px] flex-shrink-0 space-y-4">
              {[0, 1].map((i) => (
                <Card key={i} className="rounded-xl border-gray-200/50 p-4 sm:p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="h-3 w-28 rounded bg-gray-900/10" />
                      <div className="h-6 w-16 rounded bg-gray-900/10" />
                    </div>
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="flex items-center justify-between gap-4">
                        <div className="h-3 w-24 rounded bg-gray-900/10" />
                        <div className="h-3 w-20 rounded bg-gray-900/10" />
                      </div>
                    ))}
                    <div className="h-9 w-32 rounded bg-gray-900/10" />
                  </div>
                </Card>
              ))}
            </aside>
          </section>
        </div>
      </div>
    );
  }

  if (!snapshots.length) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
        <Card className="rounded-xl border-gray-200/50 p-6">
          <div className="text-sm font-medium text-gray-900">No analyses yet</div>
          <div className="mt-1 text-sm text-gray-600">
            Run an analysis to populate your dashboard history.
          </div>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              Run analysis
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
        </Card>
      </div>
    );
  }

  const latest = history[0] ?? null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-[var(--bp-content-py)] sm:py-[var(--bp-content-py-sm)]">
      <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Avg Overall"
            value={`${kpis.overallAvg}`}
            hint="Last 30 days"
            badge={kpis.overallAvgDelta ? `${kpis.overallAvgDelta > 0 ? "+" : ""}${kpis.overallAvgDelta}` : undefined}
          />
          <KpiCard label="Best Overall" value={`${kpis.bestOverall}`} hint="All time" />
          <KpiCard label="Analyses" value={`${kpis.analysesCount}`} hint="Total" />
          <KpiCard label="Last 7 days" value={`${kpis.last7Days}`} hint="New analyses" />
        </section>

        <section className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          <div className="flex-1 min-w-0 space-y-4">
            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: "transparent",
                        color: "#72838c",
                        letterSpacing: "0.08em",
                        border: "1px dashed rgba(114, 131, 140, 0.3)",
                      }}
                    >
                      LATEST ANALYSIS
                    </span>
                    {latest ? (
                      <span className="text-xs text-gray-500">{latest.createdAtLabel} ago</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <div className="text-4xl font-semibold tracking-tight text-gray-900">
                      {latest ? latest.overall : "—"}
                    </div>
                    <div className="pb-1 text-sm font-medium text-gray-500">/ 100</div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Snapshot of your latest scores across the four pillars.
                  </div>
                </div>

                {latest ? (
                  <Link
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                    href={`/ui/dashboard/${latest.id}`}
                  >
                    Open
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
                ) : null}
              </div>

              <div className="mt-6 space-y-3">
                <PillarRow label="Harmony" value={latest?.harmony ?? 0} />
                <PillarRow label="Angularity" value={latest?.angularity ?? 0} />
                <PillarRow label="Dimorphism" value={latest?.dimorphism ?? 0} />
                <PillarRow label="Features" value={latest?.features ?? 0} />
              </div>
            </Card>

            <Card className="rounded-xl border-gray-200/50 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Overall Trend</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Trend derived from saved snapshots.
                  </div>
                </div>
                <Badge className="shrink-0">Last 30 days</Badge>
              </div>

              <div className="px-4 sm:px-6 py-6">
                <div className="space-y-3">
                  <LineAreaChart
                    points={series.overall.map((p) => ({ t: p.t, value: p.overall }))}
                    height={192}
                    showAxes={false}
                    valueLabel="Overall"
                  />
                </div>
              </div>
            </Card>

            <Card className="rounded-xl border-gray-200/50 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Recent Analyses</div>
                  <div className="mt-1 text-xs text-gray-500">Click an item to open details.</div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {history.map((item) => (
                  <Link
                    key={item.id}
                    href={`/ui/dashboard/${item.id}`}
                    className={cn(
                      "block px-4 sm:px-6 py-4 transition-colors",
                      item.id === effectiveSelectedId ? "bg-gray-50" : "hover:bg-gray-50",
                    )}
                    aria-current={item.id === effectiveSelectedId ? "page" : undefined}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          Analysis {item.id}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{
                              background: "transparent",
                              color: "#72838c",
                              letterSpacing: "0.08em",
                              border: "1px dashed rgba(114, 131, 140, 0.3)",
                            }}
                          >
                            OVR
                          </span>
                          <span className="font-medium text-gray-700">{item.overall}/100</span>
                          <span className="text-gray-300">•</span>
                          <span>{item.createdAtLabel} ago</span>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-3">
                        <MiniPill label="H" value={item.harmony} />
                        <MiniPill label="A" value={item.angularity} dashed />
                        <MiniPill label="D" value={item.dimorphism} dashed />
                        <MiniPill label="F" value={item.features} dashed />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <aside className="w-full lg:w-[360px] flex-shrink-0 space-y-4">
            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Overview</div>
                  <div className="mt-1 text-xs text-gray-500">Derived from saved snapshots.</div>
                </div>
                <Badge>Blackpill</Badge>
              </div>

              <div className="mt-5 space-y-3">
                <LineItem label="Cohort" value={cohortLabel} />
                <LineItem label="Plan" value="Free" />
                <LineItem label="Retention" value="Enabled" />
              </div>
            </Card>

            <Card className="rounded-xl border-gray-200/50 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Selected Analysis</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {selected ? `Selected: ${selected.id}` : "Select an analysis from History."}
                  </div>
                </div>
                {selected ? <Badge>Active</Badge> : <Badge className="bg-gray-50 text-gray-600">None</Badge>}
              </div>

              {selected ? (
                <div className="mt-5 space-y-4">
                  <div className="text-sm text-gray-700">{selected.notes}</div>
                  <div className="space-y-2">
                    <PillarRow label="Harmony" value={selected.pillars.harmony} compact />
                    <PillarRow label="Angularity" value={selected.pillars.angularity} compact />
                    <PillarRow label="Dimorphism" value={selected.pillars.dimorphism} compact />
                    <PillarRow label="Features" value={selected.pillars.features} compact />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/results/${selected.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      Open Results
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
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="rounded-xl border border-gray-200/50 bg-gradient-to-b from-gray-50 to-white p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-3 w-2/3 rounded bg-gray-900/10" />
                      <div className="h-3 w-1/2 rounded bg-gray-900/10" />
                      <div className="h-2 w-full rounded bg-gray-900/10" />
                      <div className="h-2 w-5/6 rounded bg-gray-900/10" />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </aside>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
}) {
  return (
    <Card className="rounded-xl border-gray-200/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
        </div>
        {badge ? (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700 shrink-0">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-gray-500">{hint}</div>
    </Card>
  );
}

function PillarRow({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / 10) * 100)));

  return (
    <div className={cn("flex items-center gap-3", compact ? "" : "py-1")}>
      <div className="w-24 text-sm text-gray-600">{label}</div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gray-900/70" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-10 text-right text-sm font-medium text-gray-700">{value.toFixed(1)}</div>
    </div>
  );
}

function MiniPill({ label, value, dashed }: { label: string; value: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="text-[9px] font-semibold px-1 py-0.5 rounded-md"
        style={
          dashed
            ? { background: "transparent", color: "#72838c", border: "1px dashed rgba(114, 131, 140, 0.3)" }
            : { background: "rgba(114, 131, 140, 0.1)", color: "#72838c" }
        }
      >
        {label}
      </span>
      <span className="text-xs font-medium text-gray-600">{value.toFixed(1)}</span>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
