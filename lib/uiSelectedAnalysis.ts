const LS_KEY = "bp.ui.selectedAnalysisId.v1";
const EVENT_NAME = "bp:uiSelectedAnalysisId";

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function loadSelectedAnalysisId(): string | null {
  if (!isBrowser()) return null;
  const id = window.localStorage.getItem(LS_KEY);
  return id && typeof id === "string" ? id : null;
}

export function saveSelectedAnalysisId(id: string | null | undefined): void {
  if (!isBrowser()) return;
  if (!id) window.localStorage.removeItem(LS_KEY);
  else window.localStorage.setItem(LS_KEY, id);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeSelectedAnalysisId(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

