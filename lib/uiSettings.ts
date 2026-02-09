export type UiSettings = {
  language: string;
  units: string;
  defaultCohort: string;
  shareAnonymizedAnalytics: boolean;
  allowModelImprovement: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
};

export const DEFAULT_UI_SETTINGS: UiSettings = {
  language: "English (US)",
  units: "Metric",
  defaultCohort: "asian_male_young",
  shareAnonymizedAnalytics: true,
  allowModelImprovement: false,
  compactMode: false,
  reducedMotion: false,
};

const LS_KEY = "bp.uiSettings.v1";
const EVENT_NAME = "bp:uiSettings";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const safeJsonParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const normalize = (value: unknown): Partial<UiSettings> => {
  if (!value || typeof value !== "object") return {};
  const v = value as Partial<Record<keyof UiSettings, unknown>>;

  const out: Partial<UiSettings> = {};
  if (typeof v.language === "string") out.language = v.language;
  if (typeof v.units === "string") out.units = v.units;
  if (typeof v.defaultCohort === "string") out.defaultCohort = v.defaultCohort;
  if (typeof v.shareAnonymizedAnalytics === "boolean") out.shareAnonymizedAnalytics = v.shareAnonymizedAnalytics;
  if (typeof v.allowModelImprovement === "boolean") out.allowModelImprovement = v.allowModelImprovement;
  if (typeof v.compactMode === "boolean") out.compactMode = v.compactMode;
  if (typeof v.reducedMotion === "boolean") out.reducedMotion = v.reducedMotion;
  return out;
};

export function loadUiSettings(): UiSettings {
  if (!isBrowser()) return DEFAULT_UI_SETTINGS;
  const parsed = safeJsonParse(window.localStorage.getItem(LS_KEY));
  const normalized = normalize(parsed);
  return { ...DEFAULT_UI_SETTINGS, ...normalized };
}

export function saveUiSettings(patch: Partial<UiSettings>): UiSettings {
  if (!isBrowser()) return { ...DEFAULT_UI_SETTINGS, ...patch };
  const current = loadUiSettings();
  const next = { ...current, ...patch };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT_NAME));
  return next;
}

export function subscribeUiSettings(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(EVENT_NAME, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(EVENT_NAME, handler);
  };
}

export function applyUiSettingsClasses(settings: UiSettings): void {
  if (!isBrowser()) return;

  const root = document.querySelector<HTMLElement>(".bp");
  const targets: Array<HTMLElement> = [document.documentElement];
  if (root) targets.push(root);

  for (const el of targets) {
    el.classList.toggle("bp-compact", Boolean(settings.compactMode));
    el.classList.toggle("bp-reduce-motion", Boolean(settings.reducedMotion));
  }
}

