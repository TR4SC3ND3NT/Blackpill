import type { AnalysisSnapshot } from "@/lib/analysisHistory";

export type SnapshotReportPayload = {
  kind: "blackpill-report-v1";
  exportedAtIso: string;
  snapshot: AnalysisSnapshot;
};

const csvEscape = (value: string) => {
  // RFC4180-ish: quote cells containing comma, quote, or newlines.
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, "\"\"");
  return needsQuotes ? `"${escaped}"` : escaped;
};

const toCsvCell = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export function buildSnapshotReportPayload(snapshot: AnalysisSnapshot, exportedAtIso: string): SnapshotReportPayload {
  return {
    kind: "blackpill-report-v1",
    exportedAtIso,
    snapshot,
  };
}

export function snapshotMetricsToCsv(snapshot: AnalysisSnapshot): string {
  const header = ["metricId", "title", "pillar", "view", "value", "score", "confidence", "errorBar"];
  const rows: string[] = [header.map(csvEscape).join(",")];

  const metrics = snapshot.metrics ?? [];
  for (const m of metrics) {
    rows.push(
      [
        m.id,
        m.title,
        m.pillar,
        m.view,
        toCsvCell(m.value),
        toCsvCell(m.score),
        toCsvCell(m.confidence),
        toCsvCell(m.errorBar ?? ""),
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }

  if (!metrics.length) {
    // Keep the CSV non-empty (useful for pipelines expecting a header + at least one row).
    rows.push(["", "No metrics available", "", "", "", "", "", ""].map(csvEscape).join(","));
  }

  return rows.join("\n");
}

