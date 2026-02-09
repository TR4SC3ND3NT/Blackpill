import type { AnalysisSnapshot } from "@/lib/analysisHistory";

export type AnalyticsTimeRange = "7d" | "30d" | "90d";

export const ANALYTICS_TIME_RANGES: AnalyticsTimeRange[] = ["7d", "30d", "90d"];

export type AnalyticsPoint = {
  t: string;
  value: number;
};

export type AnalyticsBreakdownRow = {
  label: string;
  value: string;
  delta: string;
};

export type AnalyticsModel = {
  seriesOverall: AnalyticsPoint[];
  breakdownRows: AnalyticsBreakdownRow[];
  cohortLabel: string | null;
};

const dayMs = 24 * 60 * 60 * 1000;

const fmtDeltaInt = (delta: number) => `${delta >= 0 ? "+" : ""}${delta}`;
const fmtDelta1 = (delta: number) => `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;

export function computeAnalyticsFromSnapshots(
  snapshots: AnalysisSnapshot[],
  timeRange: AnalyticsTimeRange,
): AnalyticsModel {
  if (!snapshots.length) {
    return { seriesOverall: [], breakdownRows: [], cohortLabel: null };
  }

  const baselineNow = new Date(snapshots[0]?.createdAtIso ?? 0).getTime();
  const days = timeRange === "7d" ? 7 : timeRange === "90d" ? 90 : 30;
  const cutoff = baselineNow - days * dayMs;

  const filtered = snapshots
    .filter((s) => new Date(s.createdAtIso).getTime() >= cutoff)
    .slice()
    .sort((a, b) => (a.createdAtIso || "").localeCompare(b.createdAtIso || ""));

  const seriesOverall: AnalyticsPoint[] = filtered.map((s) => ({
    t: s.createdAtIso,
    value: Math.round(s.overall),
  }));

  const latest = filtered[filtered.length - 1] ?? snapshots[0];
  const prev = filtered.length >= 2 ? filtered[filtered.length - 2] : null;

  const overallDelta = prev ? Math.round(latest.overall - prev.overall) : 0;

  const to10 = (v: number) => v / 10;
  const delta10 = (a: number, b: number | null) => (b == null ? 0 : to10(a) - to10(b));

  const breakdownRows: AnalyticsBreakdownRow[] = [
    {
      label: "Overall",
      value: `${Math.round(latest.overall)} / 100`,
      delta: fmtDeltaInt(overallDelta),
    },
    {
      label: "Harmony",
      value: `${to10(latest.pillarScores.harmony).toFixed(1)} / 10`,
      delta: fmtDelta1(delta10(latest.pillarScores.harmony, prev?.pillarScores.harmony ?? null)),
    },
    {
      label: "Angularity",
      value: `${to10(latest.pillarScores.angularity).toFixed(1)} / 10`,
      delta: fmtDelta1(delta10(latest.pillarScores.angularity, prev?.pillarScores.angularity ?? null)),
    },
    {
      label: "Dimorphism",
      value: `${to10(latest.pillarScores.dimorphism).toFixed(1)} / 10`,
      delta: fmtDelta1(delta10(latest.pillarScores.dimorphism, prev?.pillarScores.dimorphism ?? null)),
    },
    {
      label: "Features",
      value: `${to10(latest.pillarScores.features).toFixed(1)} / 10`,
      delta: fmtDelta1(delta10(latest.pillarScores.features, prev?.pillarScores.features ?? null)),
    },
  ];

  return {
    seriesOverall,
    breakdownRows,
    cohortLabel: latest.cohortKey ?? null,
  };
}

