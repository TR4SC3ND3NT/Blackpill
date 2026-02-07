import "server-only";
import fs from "fs";
import path from "path";
import type { FaceRecord } from "./types";
import { computeScores } from "./scoring";
import { normalizeLandmarks, type LandmarkInput } from "./landmarks";

type StoreShape = Map<string, FaceRecord>;

const globalForStore = globalThis as unknown as {
  faceStore?: StoreShape;
  faceStoreLoaded?: boolean;
  faceStorePersistTimer?: ReturnType<typeof setTimeout> | null;
};

const store: StoreShape = globalForStore.faceStore ?? new Map();

if (!globalForStore.faceStore) {
  globalForStore.faceStore = store;
}

const persistEnabled = process.env.FACE_STORE_PERSIST === "1";
const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "faces.json");

const loadPersisted = () => {
  if (!persistEnabled) return;
  if (globalForStore.faceStoreLoaded) return;
  globalForStore.faceStoreLoaded = true;
  try {
    if (!fs.existsSync(dataFile)) return;
    const raw = fs.readFileSync(dataFile, "utf8");
    const entries = JSON.parse(raw) as Array<[string, FaceRecord]>;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [id, record] = entry;
      if (record && typeof record === "object") {
        store.set(id, record as FaceRecord);
      }
    }
  } catch (error) {
    console.warn("Failed to load persisted faces store.", error);
  }
};

const schedulePersist = () => {
  if (!persistEnabled) return;
  if (globalForStore.faceStorePersistTimer) {
    clearTimeout(globalForStore.faceStorePersistTimer);
  }
  globalForStore.faceStorePersistTimer = setTimeout(() => {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const payload = JSON.stringify([...store.entries()], null, 2);
      fs.writeFileSync(dataFile, payload, "utf8");
    } catch (error) {
      console.warn("Failed to persist faces store.", error);
    }
  }, 300);
};

loadPersisted();

const setRecord = (id: string, record: FaceRecord) => {
  store.set(id, record);
  schedulePersist();
};

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `face_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const createFace = (input: {
  gender: string;
  race: string;
  frontPhotoUrl: string;
  sidePhotoUrl: string;
  frontPhotoSegmentedUrl?: string | null;
  sidePhotoSegmentedUrl?: string | null;
  frontLandmarks?: LandmarkInput;
  sideLandmarks?: LandmarkInput;
  mediapipeLandmarks?: LandmarkInput;
  frontQuality?: FaceRecord["frontQuality"];
  sideQuality?: FaceRecord["sideQuality"];
  manualLandmarks?: FaceRecord["manualLandmarks"];
}) => {
  const id = generateId();
  const createdAt = new Date().toISOString();
  const frontLandmarks = normalizeLandmarks(input.frontLandmarks);
  const sideLandmarks = normalizeLandmarks(input.sideLandmarks);
  const mediapipeLandmarks = normalizeLandmarks(input.mediapipeLandmarks);
  const effectiveFrontLandmarks = mediapipeLandmarks.length
    ? mediapipeLandmarks
    : frontLandmarks;
  const scores = computeScores({
    frontLandmarks: effectiveFrontLandmarks,
    sideLandmarks,
    frontQuality: input.frontQuality ?? null,
    sideQuality: input.sideQuality ?? null,
    manualLandmarks: input.manualLandmarks ?? null,
  });

  const record: FaceRecord = {
    id,
    createdAt,
    updatedAt: createdAt,
    gender: input.gender,
    race: input.race,
    unlocked: true,
    overallScore: scores.overallScore,
    harmonyScore: scores.harmonyScore,
    frontHarmonyScore: scores.frontHarmonyScore,
    sideHarmonyScore: scores.sideHarmonyScore,
    dimorphismScore: scores.dimorphismScore,
    angularityScore: scores.angularityScore,
    featuresScore: scores.featuresScore,
    overallConfidence: scores.overallConfidence,
    overallErrorBar: scores.overallErrorBar,
    harmonyConfidence: scores.harmonyConfidence,
    angularityConfidence: scores.angularityConfidence,
    dimorphismConfidence: scores.dimorphismConfidence,
    featuresConfidence: scores.featuresConfidence,
    angularityAssessments: scores.angularityAssessments,
    dimorphismAssessments: scores.dimorphismAssessments,
    featuresAssessments: scores.featuresAssessments,
    metricDiagnostics: scores.metricDiagnostics,
    frontPhotoUrl: input.frontPhotoUrl,
    sidePhotoUrl: input.sidePhotoUrl,
    frontPhotoSegmentedUrl: input.frontPhotoSegmentedUrl ?? null,
    sidePhotoSegmentedUrl: input.sidePhotoSegmentedUrl ?? null,
    useTransparentImages: false,
    frontLandmarks: frontLandmarks.length ? frontLandmarks : null,
    sideLandmarks: sideLandmarks.length ? sideLandmarks : null,
    mediapipeLandmarks: mediapipeLandmarks.length ? mediapipeLandmarks : null,
    frontQuality: input.frontQuality ?? null,
    sideQuality: input.sideQuality ?? null,
    manualLandmarks: input.manualLandmarks ?? null,
  };

  setRecord(id, record);
  return record;
};

export const getFace = (id: string) => {
  return store.get(id) ?? null;
};

export const saveMediapipeLandmarks = (
  id: string,
  landmarks: LandmarkInput,
  kind: "front" | "side" = "front"
) => {
  const record = store.get(id);
  if (!record) return null;
  const normalized = normalizeLandmarks(landmarks);
  if (kind === "side") {
    record.sideLandmarks = normalized.length ? normalized : null;
  } else {
    record.mediapipeLandmarks = normalized.length ? normalized : null;
  }
  record.updatedAt = new Date().toISOString();
  setRecord(id, record);
  return record;
};
