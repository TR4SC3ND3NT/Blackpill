export type UiNewAnalysisDraft = {
  frontDataUrl: string | null;
  sideDataUrl: string | null;
  cohortKey: string | null;
};

const LS_KEY = "bp.ui.newAnalysisDraft.v1";
const EVENT_NAME = "bp:uiNewAnalysisDraft";

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeJsonParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const normalize = (value: unknown): UiNewAnalysisDraft => {
  const v = (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const frontDataUrl = typeof v.frontDataUrl === "string" ? v.frontDataUrl : null;
  const sideDataUrl = typeof v.sideDataUrl === "string" ? v.sideDataUrl : null;
  const cohortKey = typeof v.cohortKey === "string" ? v.cohortKey : null;
  return { frontDataUrl, sideDataUrl, cohortKey };
};

export function loadUiNewAnalysisDraft(): UiNewAnalysisDraft {
  if (!isBrowser()) return { frontDataUrl: null, sideDataUrl: null, cohortKey: null };
  return normalize(safeJsonParse(window.localStorage.getItem(LS_KEY)));
}

export function saveUiNewAnalysisDraft(patch: Partial<UiNewAnalysisDraft>): void {
  if (!isBrowser()) return;
  const current = loadUiNewAnalysisDraft();
  const next: UiNewAnalysisDraft = {
    frontDataUrl: patch.frontDataUrl ?? current.frontDataUrl,
    sideDataUrl: patch.sideDataUrl ?? current.sideDataUrl,
    cohortKey: patch.cohortKey ?? current.cohortKey,
  };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearUiNewAnalysisDraft(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeUiNewAnalysisDraft(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

