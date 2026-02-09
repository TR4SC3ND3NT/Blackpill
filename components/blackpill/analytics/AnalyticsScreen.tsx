"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/blackpill/Badge";
import { Card } from "@/components/blackpill/Card";
import { TimeRangeButtons } from "@/components/blackpill/analytics/TimeRangeButtons";
import { AppShell } from "@/components/blackpill/shell/AppShell";
import type { AnalysisSnapshot } from "@/lib/analysisHistory";
import { loadSnapshots, subscribeSnapshots } from "@/lib/analysisHistory";
import {
  computeAnalyticsFromSnapshots,
  type AnalyticsTimeRange,
} from "@/lib/analyticsFromSnapshots";
import { cn } from "@/lib/cn";

const rangeLabel = (range: AnalyticsTimeRange) => {
  switch (range) {
    case "7d":
      return "Last 7 days";
    case "90d":
      return "Last 90 days";
    case "30d":
    default:
      return "Last 30 days";
  }
};

export function AnalyticsScreen() {
  const [snapshots, setSnapshots] = useState<AnalysisSnapshot[]>(() => loadSnapshots());
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("30d");

  useEffect(() => {
    return subscribeSnapshots(() => setSnapshots(loadSnapshots()));
  }, []);

  const analytics = useMemo(
    () => computeAnalyticsFromSnapshots(snapshots, timeRange),
    [snapshots, timeRange],
  );

  const values = analytics.seriesOverall.map((p) => p.value);
  const latest = values.length ? values[values.length - 1] : 0;
  const prev = values.length >= 2 ? values[values.length - 2] : latest;
  const delta1 = latest - prev;
  const avg = values.length
    ? Math.round(values.reduce((acc, v) => acc + v, 0) / Math.max(1, values.length))
    : 0;
  const best = values.reduce((m, v) => Math.max(m, v), 0);

  const latestSnapshot = snapshots[0] ?? null;
  const metricStrengths = useMemo(() => {
    const metrics = latestSnapshot?.metrics ?? [];
    const scored = metrics
      .map((m) => ({ title: m.title, score: typeof m.score === "number" ? m.score : null }))
      .filter((m): m is { title: string; score: number } => m.score != null && Number.isFinite(m.score));
    return scored.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [latestSnapshot]);

  const metricWeaknesses = useMemo(() => {
    const metrics = latestSnapshot?.metrics ?? [];
    const scored = metrics
      .map((m) => ({ title: m.title, score: typeof m.score === "number" ? m.score : null }))
      .filter((m): m is { title: string; score: number } => m.score != null && Number.isFinite(m.score));
    return scored.sort((a, b) => a.score - b.score).slice(0, 3);
  }, [latestSnapshot]);

  const histogram = useMemo(() => {
    if (!values.length) return null;
    const bins = 6;
    const min = 0;
    const max = 100;
    const size = (max - min) / bins;
    const counts = new Array<number>(bins).fill(0);
    for (const v of values) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / size)));
      counts[idx] += 1;
    }
    const peak = Math.max(1, ...counts);
    return counts.map((c) => Math.round((c / peak) * 64));
  }, [values]);

  return (
    <AppShell
      title="Analytics"
      subtitle="Trends and breakdowns"
      rightSlot={<TimeRangeButtons value={timeRange} onChange={setTimeRange} />}
    >
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        {!snapshots.length ? (
          <Card className="rounded-xl border-gray-200/60 p-6">
            <div className="text-sm font-medium text-gray-900">No analytics yet</div>
            <div className="mt-1 text-sm text-gray-600">
              Run an analysis to generate snapshot history for trends.
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
        ) : (
          <div className="space-y-6">
            <section className="flex flex-col sm:flex-row gap-3">
              <KpiCard
                label="Latest overall"
                value={`${latest}`}
                hint="Most recent snapshot"
                badge={`${delta1 >= 0 ? "+" : ""}${delta1}`}
              />
              <KpiCard label="Avg overall" value={`${avg}`} hint={rangeLabel(timeRange)} />
              <KpiCard label="Best overall" value={`${best}`} hint="Within range" />
              <KpiCard label="Analyses" value={`${snapshots.length}`} hint="Saved snapshots" />
            </section>

            <section className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              <div className="flex-1 min-w-0 space-y-4">
                <Card className="rounded-xl border-gray-200/60 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Overall trend</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Derived from your saved analysis snapshots.
                      </div>
                    </div>
                    <Badge className="shrink-0">{rangeLabel(timeRange)}</Badge>
                  </div>

                  <div className="px-4 sm:px-6 py-6">
                    <div className="rounded-xl border border-gray-200/60 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
                      <div
                        className="h-64 relative"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right, rgba(17, 24, 39, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(17, 24, 39, 0.04) 1px, transparent 1px)",
                          backgroundSize: "48px 48px",
                        }}
                      >
                        <div className="absolute inset-0 flex items-end px-4 pb-4">
                          <div className="flex items-end gap-2 w-full">
                            {analytics.seriesOverall.slice(-18).map((p) => (
                              <div key={p.t} className="flex-1 min-w-0">
                                <div
                                  className="w-full rounded-md bg-gray-900/10"
                                  style={{
                                    height: `${Math.max(10, Math.round((p.value / 100) * 160))}px`,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Active cohort: {analytics.cohortLabel ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">Blackpill</div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-xl border-gray-200/60 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Breakdown</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Latest snapshot vs previous within range.
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {analytics.breakdownRows.map((row) => (
                      <div key={row.label} className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900">{row.label}</div>
                            <div className="mt-1 text-xs text-gray-500">{row.value}</div>
                          </div>
                          <div
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              row.delta.trim().startsWith("-") ? "text-red-600" : "text-emerald-600",
                            )}
                          >
                            {row.delta}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <aside className="w-full lg:w-[360px] flex-shrink-0 space-y-4">
                <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Top strengths</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Based on the latest diagnostic metrics.
                      </div>
                    </div>
                    <Badge>Derived</Badge>
                  </div>
                  <div className="mt-4 divide-y divide-gray-100">
                    {(metricStrengths.length ? metricStrengths : [{ title: "No metrics available", score: 0 }]).map(
                      (m) => (
                        <div key={m.title} className="py-3 flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-700 truncate">{m.title}</span>
                          {metricStrengths.length ? (
                            <span className="text-sm font-medium text-gray-900 tabular-nums">{Math.round(m.score)}</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-500">—</span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </Card>

                <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Top weaknesses</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Lowest-scoring metrics in the latest snapshot.
                      </div>
                    </div>
                    <Badge className="bg-gray-50 text-gray-600">Derived</Badge>
                  </div>
                  <div className="mt-4 divide-y divide-gray-100">
                    {(metricWeaknesses.length ? metricWeaknesses : [{ title: "No metrics available", score: 0 }]).map(
                      (m) => (
                        <div key={m.title} className="py-3 flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-700 truncate">{m.title}</span>
                          {metricWeaknesses.length ? (
                            <span className="text-sm font-medium text-gray-900 tabular-nums">{Math.round(m.score)}</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-500">—</span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </Card>

                <Card className="rounded-xl border-gray-200/60 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">Distribution</div>
                      <div className="mt-1 text-xs text-gray-500">Overall distribution within range.</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-200/60 bg-gradient-to-b from-gray-50 to-white p-4">
                    <div className="flex items-end gap-2 h-20">
                      {(histogram ?? [18, 34, 52, 41, 28, 20]).map((h, i) => (
                        <div key={i} className="flex-1 min-w-0">
                          <div className="w-full bg-gray-900/10 rounded-md" style={{ height: `${h}px` }} />
                        </div>
                      ))}
                    </div>
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
    <Card className="rounded-xl border-gray-200/60 p-4 flex-1">
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

