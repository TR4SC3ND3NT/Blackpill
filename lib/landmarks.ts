import type { Landmark } from "./types";

type LandmarkRecord = Record<string, Landmark>;

export type LandmarkInput = Landmark[] | LandmarkRecord | null | undefined;

export const normalizeLandmarks = (input: LandmarkInput): Landmark[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === "object") return Object.values(input);
  return [];
};
