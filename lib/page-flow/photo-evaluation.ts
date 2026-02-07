import { loadImageFromDataUrl } from "@/lib/mediapipe";
import type {
  Landmark,
  PhotoQuality,
  PoseEstimate,
  ReasonCode,
} from "@/lib/types";
import type { ExpectedView } from "./types";

export const MIN_SIDE_PX = 600;
export const BLUR_THRESHOLD = 40;
export const PREVIEW_STAGE_TIMEOUT_MS = 20_000;

export const DEFAULT_POSE: PoseEstimate = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  source: "none",
  matrix: null,
  confidence: 0,
  view: "unknown",
  validFront: false,
  validSide: false,
};

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const normalizeLandmarksForImage = (
  points: Landmark[],
  width: number,
  height: number
) => {
  if (!points.length) return [];
  const maxX = Math.max(...points.map((pt) => pt.x));
  const maxY = Math.max(...points.map((pt) => pt.y));
  const normalized = maxX <= 2 && maxY <= 2;
  if (normalized) {
    return points.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z ?? 0 }));
  }
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  return points.map((pt) => ({
    x: pt.x / safeW,
    y: pt.y / safeH,
    z: pt.z ?? 0,
  }));
};

export const computeBlurVariance = async (dataUrl: string) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const maxSide = Math.max(image.width, image.height);
  const scale = maxSide > 256 ? 256 / maxSide : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lap =
        gray[idx - width] +
        gray[idx + width] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
};

export type EvaluatePhotoResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  quality: PhotoQuality;
};

export const evaluatePhoto = async (
  label: string,
  dataUrl: string,
  landmarks: Landmark[],
  width: number,
  height: number,
  expectedView: ExpectedView,
  poseInput?: PoseEstimate,
  transformed = false
): Promise<EvaluatePhotoResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const reasonCodes = new Set<ReasonCode>();
  const hasLandmarks = landmarks.length > 0;
  const pose = poseInput ?? DEFAULT_POSE;
  const normalized = normalizeLandmarksForImage(landmarks, width, height);
  const valid = normalized.filter(
    (pt) =>
      Number.isFinite(pt.x) &&
      Number.isFinite(pt.y) &&
      pt.x >= 0 &&
      pt.x <= 1 &&
      pt.y >= 0 &&
      pt.y <= 1
  );

  if (!hasLandmarks) {
    errors.push(`${label} photo: face not detected.`);
    reasonCodes.add("low_landmark_conf");
  }

  const minSidePx = Math.min(width, height);
  if (minSidePx < MIN_SIDE_PX) {
    warnings.push(`${label} photo is too small (min ${MIN_SIDE_PX}px).`);
    reasonCodes.add("low_landmark_conf");
  }

  let faceInFrame = false;
  if (normalized.length) {
    const xs = normalized.map((pt) => pt.x);
    const ys = normalized.map((pt) => pt.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const margin = 0.04;
    faceInFrame =
      minX > margin && maxX < 1 - margin && minY > margin && maxY < 1 - margin;
    if (!faceInFrame) {
      warnings.push(`${label} photo is not a full face (cropped).`);
      reasonCodes.add("out_of_frame");
    }
  }

  let blurVariance = 0;
  try {
    blurVariance = await computeBlurVariance(dataUrl);
  } catch {
    blurVariance = 0;
  }
  if (blurVariance < BLUR_THRESHOLD) {
    warnings.push(`${label} photo is too blurry.`);
    reasonCodes.add("blur");
  }

  const absYaw = Math.abs(pose.yaw);
  const absPitch = Math.abs(pose.pitch);
  const absRoll = Math.abs(pose.roll);
  const detectedView: PhotoQuality["detectedView"] =
    absYaw <= 15 ? "front" : absYaw < 60 ? "three_quarter" : "side";
  const viewValid = expectedView === "front" ? pose.validFront : absYaw >= 25;
  let viewWeight = expectedView === "side" ? smoothstep(25, 65, absYaw) : 1;

  if (hasLandmarks && !viewValid) {
    reasonCodes.add("bad_pose");
    if (expectedView === "side") {
      reasonCodes.add("not_enough_yaw");
      reasonCodes.add("side_disabled");
      viewWeight = 0;
    }
    if (expectedView === "front") {
      warnings.push("Front photo is not a frontal view.");
    } else {
      warnings.push("Side angle is too frontal for profile metrics.");
    }
  }

  if (expectedView === "side" && hasLandmarks && absYaw >= 25 && absYaw < 60) {
    reasonCodes.add("side_ok_three_quarter");
  }

  if (hasLandmarks && expectedView === "side" && absPitch > 20) {
    reasonCodes.add("excessive_pitch");
    warnings.push("Side pitch is high; profile confidence reduced.");
  }

  if (hasLandmarks && absRoll > 30) {
    reasonCodes.add("excessive_roll");
    warnings.push("Head is tilted; metrics are roll-corrected.");
  }

  if (hasLandmarks) {
    if (expectedView === "side") {
      const validRatio = normalized.length ? valid.length / normalized.length : 0;
      if (landmarks.length < 200 || validRatio < 0.7) {
        warnings.push("Profile angle/visibility insufficient.");
        reasonCodes.add("occlusion");
      }
      if (validRatio < 0.8) {
        reasonCodes.add("low_landmark_conf");
      }
    }
  }

  if (transformed) {
    reasonCodes.add("transformed_detection");
  }

  const validRatio = normalized.length ? valid.length / normalized.length : 0;
  if (hasLandmarks && validRatio < 0.75) {
    reasonCodes.add("low_landmark_conf");
  }

  let confidence = hasLandmarks
    ? clamp(
        expectedView === "side"
          ? 0.55 + (pose.confidence || 0) * 0.35
          : 0.6 + (pose.confidence || 0) * 0.4,
        0,
        1
      )
    : 0;
  if (expectedView === "side") {
    confidence *= 0.45 + viewWeight * 0.55;
    if (absPitch > 20) confidence *= clamp(1 - (absPitch - 20) / 28, 0.45, 1);
  }
  if (!viewValid) confidence *= 0.72;
  if (!faceInFrame) confidence *= 0.8;
  if (blurVariance < BLUR_THRESHOLD) confidence *= 0.78;
  if (minSidePx < MIN_SIDE_PX) confidence *= 0.82;
  if (transformed) confidence *= 0.72;
  if (validRatio > 0 && validRatio < 0.8) confidence *= 0.82;
  confidence = clamp(confidence, 0, 1);

  const qualityLevel = errors.length || warnings.length ? "low" : "ok";

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    quality: {
      poseYaw: pose.yaw,
      posePitch: pose.pitch,
      poseRoll: pose.roll,
      detectedView,
      faceInFrame,
      minSidePx,
      blurVariance,
      landmarkCount: landmarks.length,
      quality: qualityLevel,
      confidence,
      pose,
      expectedView,
      viewValid,
      viewWeight,
      reasonCodes: Array.from(reasonCodes),
      issues: [...errors, ...warnings],
    },
  };
};
