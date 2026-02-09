import type { FaceRecord, MetricDiagnostic } from "@/lib/types";

export type AnalysisSnapshotMetric = Pick<
  MetricDiagnostic,
  "id" | "title" | "pillar" | "view" | "value" | "score" | "confidence" | "errorBar"
>;

export type AnalysisSnapshot = {
  id: string;
  createdAtIso: string;
  updatedAtIso?: string | null;
  cohortKey: string;
  gender: string;
  race: string;

  // Scores use the same scale as FaceRecord: 0..100.
  overall: number;
  pillarScores: {
    harmony: number;
    angularity: number;
    dimorphism: number;
    features: number;
  };

  // Optional diagnostic payload for richer analytics / exports.
  metrics?: AnalysisSnapshotMetric[];
};

export type AnalysisHistoryStats = {
  totalCount: number;
  thisMonthCount: number;
  lastActiveIso: string | null;
};

const LS_KEY = "bp.analysisSnapshots.v1";
const EVENT_NAME = "bp:analysisSnapshots";
const MAX_SNAPSHOTS = 100;

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

const normalizeSnapshot = (value: unknown): AnalysisSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<AnalysisSnapshot> & { pillarScores?: Partial<AnalysisSnapshot["pillarScores"]> };
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.createdAtIso !== "string" || !v.createdAtIso) return null;
  if (typeof v.cohortKey !== "string" || !v.cohortKey) return null;

  const overall = toNumber(v.overall);
  const harmony = toNumber(v.pillarScores?.harmony);
  const angularity = toNumber(v.pillarScores?.angularity);
  const dimorphism = toNumber(v.pillarScores?.dimorphism);
  const features = toNumber(v.pillarScores?.features);

  if (
    overall == null ||
    harmony == null ||
    angularity == null ||
    dimorphism == null ||
    features == null
  ) {
    return null;
  }

  return {
    id: v.id,
    createdAtIso: v.createdAtIso,
    updatedAtIso: v.updatedAtIso ?? null,
    cohortKey: v.cohortKey,
    gender: typeof v.gender === "string" ? v.gender : "unspecified",
    race: typeof v.race === "string" ? v.race : "unspecified",
    overall,
    pillarScores: {
      harmony,
      angularity,
      dimorphism,
      features,
    },
    metrics: Array.isArray(v.metrics) ? (v.metrics as AnalysisSnapshotMetric[]) : undefined,
  };
};

export function loadSnapshots(): AnalysisSnapshot[] {
  if (!isBrowser()) return [];
  const parsed = safeJsonParse(window.localStorage.getItem(LS_KEY));
  if (!Array.isArray(parsed)) return [];
  const normalized = parsed.map(normalizeSnapshot).filter((s): s is AnalysisSnapshot => Boolean(s));
  // Newest first (stable).
  return normalized
    .sort((a, b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""))
    .slice(0, MAX_SNAPSHOTS);
}

export function getSnapshot(id: string): AnalysisSnapshot | null {
  if (!id) return null;
  return loadSnapshots().find((s) => s.id === id) ?? null;
}

export function saveSnapshot(snapshot: AnalysisSnapshot): void {
  if (!isBrowser()) return;
  const current = loadSnapshots();
  const idx = current.findIndex((s) => s.id === snapshot.id);
  const next = idx >= 0 ? [...current.slice(0, idx), snapshot, ...current.slice(idx + 1)] : [snapshot, ...current];
  const limited = next
    .sort((a, b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""))
    .slice(0, MAX_SNAPSHOTS);

  window.localStorage.setItem(LS_KEY, JSON.stringify(limited));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function deleteSnapshot(id: string): void {
  if (!isBrowser()) return;
  if (!id) return;
  const current = loadSnapshots();
  const next = current.filter((s) => s.id !== id);
  if (next.length === current.length) return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearSnapshots(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function saveSnapshotFromFace(face: FaceRecord): void {
  if (!face?.id) return;

  // `cohortKey` is stored on the quality objects (see scoring + home flow).
  const fromQuality =
    (face.frontQuality as unknown as { cohortKey?: string } | null | undefined)?.cohortKey ??
    (face.sideQuality as unknown as { cohortKey?: string } | null | undefined)?.cohortKey;

  const ethnicity = (face.race || "white").replace(/-/g, "_");
  const gender = face.gender || "male";
  const derived = `${ethnicity}_${gender}_young`;

  const metrics = Array.isArray(face.metricDiagnostics)
    ? face.metricDiagnostics.map((m) => ({
        id: m.id,
        title: m.title,
        pillar: m.pillar,
        view: m.view,
        value: m.value,
        score: m.score,
        confidence: m.confidence,
        errorBar: m.errorBar ?? null,
      }))
    : undefined;

  saveSnapshot({
    id: face.id,
    createdAtIso: face.createdAt,
    updatedAtIso: face.updatedAt ?? null,
    cohortKey: fromQuality || derived,
    gender: face.gender,
    race: face.race,
    overall: face.overallScore,
    pillarScores: {
      harmony: face.harmonyScore,
      angularity: face.angularityScore,
      dimorphism: face.dimorphismScore,
      features: face.featuresScore,
    },
    metrics,
  });
}

export function getStats(snapshots = loadSnapshots()): AnalysisHistoryStats {
  const totalCount = snapshots.length;
  const lastActiveIso = snapshots[0]?.createdAtIso ?? null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const thisMonthCount = snapshots.filter((s) => {
    const d = new Date(s.createdAtIso);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;

  return { totalCount, thisMonthCount, lastActiveIso };
}

export function subscribeSnapshots(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  // `storage` only fires across tabs; custom event covers same-tab updates.
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

export function formatAgoShort(iso: string, now: number): string {
  const createdAt = new Date(iso).getTime();
  const diffMs = Math.max(0, now - createdAt);
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);

  if (week >= 1) return `${week}w`;
  if (day >= 1) return `${day}d`;
  if (hr >= 1) return `${hr}h`;
  if (min >= 1) return `${min}m`;
  return `${sec}s`;
}
