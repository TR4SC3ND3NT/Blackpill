export type ReportExportStatus = "Complete" | "Queued" | "Failed";

export type ReportExport = {
  id: string;
  createdAtIso: string;
  analysisId: string;
  cohortKey: string | null;
  overall: number | null;
  status: ReportExportStatus;
  fileName: string;
};

const LS_KEY = "bp.reportExports.v1";
const EVENT_NAME = "bp:reportExports";
const MAX_REPORTS = 200;

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeJsonParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeReport = (value: unknown): ReportExport | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ReportExport>;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.createdAtIso !== "string" || !v.createdAtIso) return null;
  if (typeof v.analysisId !== "string" || !v.analysisId) return null;
  if (typeof v.fileName !== "string" || !v.fileName) return null;

  const overall = v.overall == null ? null : toNumber(v.overall);
  const status: ReportExportStatus =
    v.status === "Queued" || v.status === "Failed" || v.status === "Complete" ? v.status : "Complete";

  return {
    id: v.id,
    createdAtIso: v.createdAtIso,
    analysisId: v.analysisId,
    cohortKey: typeof v.cohortKey === "string" ? v.cohortKey : null,
    overall,
    status,
    fileName: v.fileName,
  };
};

export function loadReportExports(): ReportExport[] {
  if (!isBrowser()) return [];
  const parsed = safeJsonParse(window.localStorage.getItem(LS_KEY));
  if (!Array.isArray(parsed)) return [];
  const normalized = parsed.map(normalizeReport).filter((r): r is ReportExport => Boolean(r));
  return normalized
    .sort((a, b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""))
    .slice(0, MAX_REPORTS);
}

export function addReportExport(report: ReportExport): void {
  if (!isBrowser()) return;
  const current = loadReportExports();
  const next = [report, ...current].slice(0, MAX_REPORTS);
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeReportExports(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

