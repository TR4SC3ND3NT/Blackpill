"use client";

import type { Landmark, PoseEstimate } from "./types";

type VisionModule = typeof import("@mediapipe/tasks-vision");

type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BBoxFallbackMethod =
  | "cropped"
  | "cropped-downscale-640"
  | "cropped-downscale-512"
  | "failed";

type LegacyDetectMethod =
  | "normal"
  | "flip"
  | "padded"
  | "padded-flip"
  | "rotate-90"
  | "rotate-180"
  | "rotate-270"
  | "failed";

export type LandmarksWithBBoxResult = {
  landmarks: Landmark[];
  method: BBoxFallbackMethod;
  bboxFound: boolean;
  bbox?: BBox;
  scaleApplied: number;
  pose: PoseEstimate;
  transformed: boolean;
};

export type LandmarksDetectionResult = {
  landmarks: Landmark[];
  method: "normal" | "failed";
  pose: PoseEstimate;
  transformed: boolean;
};

type FaceDetectionLike = {
  categories?: Array<{ score?: number }>;
  boundingBox?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
};

type RawLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type BBoxAttempt = {
  method: Exclude<BBoxFallbackMethod, "failed">;
  downscaleLongSide?: 640 | 512;
};

export type MediapipeStatusReporter = (status: string) => void;

type DetectionRuntimeOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  onStatus?: MediapipeStatusReporter;
  expectedView?: "front" | "side";
};

const REMOTE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const REMOTE_FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-assets/face_landmarker.task";
const REMOTE_FACE_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const LOCAL_WASM_URL = "/mediapipe/wasm";
const LOCAL_FACE_LANDMARKER_MODEL = "/mediapipe/models/face_landmarker.task";
const LOCAL_FACE_DETECTOR_MODEL = "/mediapipe/models/blaze_face_short_range.tflite";
const DEFAULT_STAGE_TIMEOUT_MS = 20_000;
const LOCAL_ASSET_PROBE_TIMEOUT_MS = 2_500;
const FACE_CROP_PADDING_STEPS = [0.3, 0.4, 0.55, 0.75];
const CROP_LANDMARK_SCALES: Array<640 | 512 | 384> = [640, 512, 384];

const BBOX_ATTEMPTS: BBoxAttempt[] = [
  { method: "cropped" },
  { method: "cropped-downscale-640", downscaleLongSide: 640 },
  { method: "cropped-downscale-512", downscaleLongSide: 512 },
];

let visionPromise: Promise<VisionModule> | null = null;
let filesetPromise: Promise<unknown> | null = null;
let landmarkerPromise:
  | Promise<import("@mediapipe/tasks-vision").FaceLandmarker>
  | null = null;
let detectorPromise: Promise<import("@mediapipe/tasks-vision").FaceDetector> | null =
  null;
let detectQueue: Promise<unknown> = Promise.resolve();
let warmupPromise: Promise<void> | null = null;
const localAssetPathCache = new Map<string, Promise<string>>();

const toAbortError = () => {
  const error = new Error("Operation aborted.");
  error.name = "AbortError";
  return error;
};

const reportStatus = (options?: DetectionRuntimeOptions, status?: string) => {
  if (!status) return;
  options?.onStatus?.(status);
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return;
  throw toAbortError();
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const withSignal = async <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) throw toAbortError();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(toAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
};

let timerCounter = 0;
const withTimer = async <T>(label: string, task: () => Promise<T>) => {
  const timerLabel = `[mediapipe] ${label}#${++timerCounter}`;
  console.time(timerLabel);
  try {
    return await task();
  } finally {
    console.timeEnd(timerLabel);
  }
};

const probeLocalAsset = async (assetPath: string) => {
  if (typeof window === "undefined") return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_ASSET_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(assetPath, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const resolveAssetPath = (
  localPath: string,
  remotePath: string,
  probePath: string = localPath
) => {
  const key = `${localPath}::${remotePath}::${probePath}`;
  const cached = localAssetPathCache.get(key);
  if (cached) return cached;

  const resolver = (async () => {
    const hasLocal = await probeLocalAsset(probePath);
    const resolved = hasLocal ? localPath : remotePath;
    console.info(
      `[mediapipe] asset ${localPath} -> ${hasLocal ? "local" : "remote fallback"}`
    );
    return resolved;
  })();

  localAssetPathCache.set(key, resolver);
  return resolver;
};

const getWasmUrl = () =>
  resolveAssetPath(
    LOCAL_WASM_URL,
    REMOTE_WASM_URL,
    `${LOCAL_WASM_URL}/vision_wasm_internal.wasm`
  );

const getLandmarkerModelPath = () =>
  resolveAssetPath(LOCAL_FACE_LANDMARKER_MODEL, REMOTE_FACE_LANDMARKER_MODEL);

const getDetectorModelPath = () =>
  resolveAssetPath(LOCAL_FACE_DETECTOR_MODEL, REMOTE_FACE_DETECTOR_MODEL);

const mapLoadError = (error: unknown, stage: string) => {
  if (error instanceof Error && error.name === "AbortError") {
    return error;
  }
  const message =
    error instanceof Error ? error.message : `Unknown error while loading ${stage}.`;
  return new Error(
    `Failed to load MediaPipe ${stage}. ${message} Check network or local assets in public/mediapipe.`
  );
};

const FRONT_VALID_LIMITS = { yaw: 20, pitch: 20 };
const SIDE_VALID_LIMITS = { yawMin: 55, pitch: 20 };
const ROLL_WARNING_LIMIT = 30;

const classifyViewFromYaw = (yaw: number): PoseEstimate["view"] => {
  const absYaw = Math.abs(yaw);
  if (absYaw <= 15) return "front";
  if (absYaw < 60) return "three_quarter";
  if (absYaw >= 60) return "side";
  return "unknown";
};

const withPoseValidity = (
  yaw: number,
  pitch: number,
  roll: number,
  source: PoseEstimate["source"],
  matrix: number[] | null,
  confidence: number,
  selectedLabel?: string,
  candidates?: PoseEstimate["candidates"]
): PoseEstimate => {
  const absYaw = Math.abs(yaw);
  const absPitch = Math.abs(pitch);
  return {
    yaw,
    pitch,
    roll,
    source,
    matrix,
    confidence: clamp01(confidence),
    view: classifyViewFromYaw(yaw),
    validFront: absYaw <= FRONT_VALID_LIMITS.yaw && absPitch <= FRONT_VALID_LIMITS.pitch,
    validSide: absYaw >= SIDE_VALID_LIMITS.yawMin && absPitch <= SIDE_VALID_LIMITS.pitch,
    selectedLabel,
    candidates,
  };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const emptyPose = () => withPoseValidity(0, 0, 0, "none", null, 0);

const parseMatrix = (matrixLike: unknown): number[] | null => {
  const raw =
    typeof matrixLike === "object" && matrixLike != null && "data" in matrixLike
      ? (matrixLike as { data?: unknown }).data
      : matrixLike;
  if (!Array.isArray(raw)) return null;
  const matrix = raw.map((value) => Number(value));
  if (matrix.length < 16 || matrix.some((value) => !Number.isFinite(value))) return null;
  return matrix.slice(0, 16);
};

type Rotation3 = {
  r00: number;
  r01: number;
  r02: number;
  r10: number;
  r11: number;
  r12: number;
  r20: number;
  r21: number;
  r22: number;
};

type PoseCandidate = {
  label: string;
  yaw: number;
  pitch: number;
  roll: number;
  score: number;
};

const buildRotationRowMajor = (matrix: number[]): Rotation3 => ({
  r00: matrix[0],
  r01: matrix[1],
  r02: matrix[2],
  r10: matrix[4],
  r11: matrix[5],
  r12: matrix[6],
  r20: matrix[8],
  r21: matrix[9],
  r22: matrix[10],
});

const buildRotationColumnMajor = (matrix: number[]): Rotation3 => ({
  r00: matrix[0],
  r01: matrix[4],
  r02: matrix[8],
  r10: matrix[1],
  r11: matrix[5],
  r12: matrix[9],
  r20: matrix[2],
  r21: matrix[6],
  r22: matrix[10],
});

const transposeRotation = (rotation: Rotation3): Rotation3 => ({
  r00: rotation.r00,
  r01: rotation.r10,
  r02: rotation.r20,
  r10: rotation.r01,
  r11: rotation.r11,
  r12: rotation.r21,
  r20: rotation.r02,
  r21: rotation.r12,
  r22: rotation.r22,
});

const normalizeVector = (x: number, y: number, z: number) => {
  const length = Math.hypot(x, y, z);
  if (!length || !Number.isFinite(length)) {
    return { x: 0, y: 0, z: 1, length: 0 };
  }
  return {
    x: x / length,
    y: y / length,
    z: z / length,
    length,
  };
};

const radToDeg = (value: number) => (value * 180) / Math.PI;

const poseFromRotation = (rotation: Rotation3) => {
  const forward = normalizeVector(rotation.r02, rotation.r12, rotation.r22);
  const up = normalizeVector(rotation.r01, rotation.r11, rotation.r21);

  const yaw = radToDeg(Math.atan2(forward.x, forward.z));
  const pitch = radToDeg(Math.atan2(-forward.y, Math.hypot(forward.x, forward.z)));
  const roll = radToDeg(Math.atan2(up.x, up.y));

  const orthogonality =
    Math.abs(rotation.r00 * rotation.r01 + rotation.r10 * rotation.r11 + rotation.r20 * rotation.r21) +
    Math.abs(rotation.r00 * rotation.r02 + rotation.r10 * rotation.r12 + rotation.r20 * rotation.r22) +
    Math.abs(rotation.r01 * rotation.r02 + rotation.r11 * rotation.r12 + rotation.r21 * rotation.r22);

  return {
    yaw,
    pitch,
    roll,
    orthogonality,
    forwardMagnitude: forward.length,
  };
};

const clipAngle = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value > 180) return ((value + 180) % 360) - 180;
  if (value < -180) return ((value - 180) % 360) + 180;
  return value;
};

const scorePoseCandidate = (
  candidate: { yaw: number; pitch: number; roll: number },
  fallback: PoseEstimate,
  expectedView?: "front" | "side"
) => {
  const absYaw = Math.abs(candidate.yaw);
  const absPitch = Math.abs(candidate.pitch);
  const absRoll = Math.abs(candidate.roll);

  let score = 0;
  score -= Math.max(0, absPitch - 65) * 2.4;
  score -= Math.max(0, absYaw - 95) * 1.8;
  score -= Math.max(0, absRoll - 120) * 0.8;
  score -= Math.max(0, absRoll - ROLL_WARNING_LIMIT) * 0.12;

  const fallbackAbsYaw = Math.abs(fallback.yaw);
  const fallbackAbsPitch = Math.abs(fallback.pitch);
  score -= Math.abs(absYaw - fallbackAbsYaw) * 0.32;
  score -= Math.abs(absPitch - fallbackAbsPitch) * 0.26;

  if (expectedView === "front") {
    score += absYaw <= FRONT_VALID_LIMITS.yaw ? 42 : 0;
    score += absPitch <= FRONT_VALID_LIMITS.pitch ? 28 : 0;
    score -= Math.max(0, absYaw - FRONT_VALID_LIMITS.yaw) * 1.3;
    score -= Math.max(0, absPitch - FRONT_VALID_LIMITS.pitch) * 1.1;
  } else if (expectedView === "side") {
    score += absYaw >= SIDE_VALID_LIMITS.yawMin ? 44 : -24;
    score += absPitch <= SIDE_VALID_LIMITS.pitch ? 26 : -18;
    score -= Math.abs(absYaw - 78) * 0.75;
    score -= Math.max(0, absPitch - SIDE_VALID_LIMITS.pitch) * 1.45;
  } else {
    score -= Math.abs(absPitch) * 0.25;
  }

  return score;
};

export const extractPoseCandidatesFromMatrix = (
  matrix: number[],
  fallback: PoseEstimate,
  expectedView?: "front" | "side"
) => {
  const candidatesInput = [
    { label: "row-major", rotation: buildRotationRowMajor(matrix) },
    { label: "row-major-inverse", rotation: transposeRotation(buildRotationRowMajor(matrix)) },
    { label: "column-major", rotation: buildRotationColumnMajor(matrix) },
    {
      label: "column-major-inverse",
      rotation: transposeRotation(buildRotationColumnMajor(matrix)),
    },
  ];

  const candidates: PoseCandidate[] = candidatesInput
    .map(({ label, rotation }) => {
      const candidate = poseFromRotation(rotation);
      if (![candidate.yaw, candidate.pitch, candidate.roll].every(Number.isFinite)) {
        return null;
      }
      const yaw = clipAngle(candidate.yaw);
      const pitch = clipAngle(candidate.pitch);
      const roll = clipAngle(candidate.roll);
      const score =
        scorePoseCandidate({ yaw, pitch, roll }, fallback, expectedView) -
        candidate.orthogonality * 90;
      return {
        label,
        yaw,
        pitch,
        roll,
        score,
      };
    })
    .filter((candidate): candidate is PoseCandidate => candidate != null)
    .sort((a, b) => b.score - a.score);

  return candidates;
};

const fallbackPoseFromPoints = (points: RawLandmark[]): PoseEstimate => {
  if (!points.length) {
    return withPoseValidity(0, 0, 0, "none", null, 0);
  }

  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;

  const left = points.filter((point) => point.x < centerX);
  const right = points.filter((point) => point.x >= centerX);
  const upper = points.filter((point) => point.y < centerY);
  const lower = points.filter((point) => point.y >= centerY);

  const averageZ = (items: RawLandmark[]) =>
    items.length
      ? items.reduce((sum, point) => sum + (Number.isFinite(point.z ?? 0) ? point.z ?? 0 : 0), 0) /
        items.length
      : 0;

  const yaw = Math.max(-90, Math.min(90, (averageZ(right) - averageZ(left)) * 180));
  const pitch = Math.max(-90, Math.min(90, (averageZ(lower) - averageZ(upper)) * 180));
  const leftMost = points.reduce((current, point) => (point.x < current.x ? point : current), points[0]);
  const rightMost = points.reduce(
    (current, point) => (point.x > current.x ? point : current),
    points[0]
  );
  const roll = Math.max(
    -90,
    Math.min(
      90,
      (Math.atan2(rightMost.y - leftMost.y, rightMost.x - leftMost.x) * 180) / Math.PI
    )
  );

  return withPoseValidity(yaw, pitch, roll, "fallback", null, 0.45, "fallback");
};

export const resolvePoseFromMatrix = (
  matrixLike: unknown,
  fallback: PoseEstimate,
  expectedView?: "front" | "side"
): PoseEstimate => {
  const matrix = parseMatrix(matrixLike);
  if (!matrix) return fallback;

  const candidates = extractPoseCandidatesFromMatrix(matrix, fallback, expectedView);
  const best = candidates[0];
  if (!best) return fallback;

  const confidence = clamp01(
    0.62 +
      (best.score >= 0 ? Math.min(best.score / 180, 0.28) : Math.max(best.score / 220, -0.34))
  );

  return withPoseValidity(
    best.yaw,
    best.pitch,
    best.roll,
    "matrix",
    matrix,
    confidence,
    best.label,
    candidates.slice(0, 4)
  );
};

const extractPoseFromDetection = (
  matrixLike: unknown,
  points: RawLandmark[],
  expectedView?: "front" | "side"
): PoseEstimate => {
  const fallback = fallbackPoseFromPoints(points);
  return resolvePoseFromMatrix(matrixLike, fallback, expectedView);
};

const getVision = async () => {
  if (!visionPromise) {
    visionPromise = import("@mediapipe/tasks-vision");
  }
  return visionPromise;
};

export const getFileset = async (options: DetectionRuntimeOptions = {}) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  reportStatus(options, "Loading WASM...");
  throwIfAborted(options.signal);

  if (!filesetPromise) {
    filesetPromise = (async () => {
      const [vision, wasmUrl] = await Promise.all([getVision(), getWasmUrl()]);
      return withTimer("FilesetResolver.forVisionTasks", async () =>
        vision.FilesetResolver.forVisionTasks(wasmUrl)
      );
    })();
  }

  try {
    const withGuards = withSignal(
      withTimeout(filesetPromise as Promise<unknown>, timeoutMs, "Loading WASM"),
      options.signal
    );
    return await withGuards;
  } catch (error) {
    filesetPromise = null;
    throw mapLoadError(error, "WASM runtime");
  }
};

export const getFaceLandmarker = async (options: DetectionRuntimeOptions = {}) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  reportStatus(options, "Loading models...");
  throwIfAborted(options.signal);

  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const [vision, fileset, modelAssetPath] = await Promise.all([
        getVision(),
        getFileset(options),
        getLandmarkerModelPath(),
      ]);
      const fileSetForLandmarker =
        fileset as Parameters<typeof vision.FaceLandmarker.createFromOptions>[0];

      const create = (delegate: "GPU" | "CPU") =>
        withTimer(`FaceLandmarker.createFromOptions(${delegate})`, () =>
          vision.FaceLandmarker.createFromOptions(fileSetForLandmarker, {
            baseOptions: {
              modelAssetPath,
              delegate,
            },
            runningMode: "IMAGE",
            numFaces: 1,
            minFaceDetectionConfidence: 0.1,
            minFacePresenceConfidence: 0.1,
            minTrackingConfidence: 0.1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          })
        );

      try {
        return await create("GPU");
      } catch (error) {
        console.warn("MediaPipe GPU delegate failed, falling back to CPU.", error);
        return create("CPU");
      }
    })();
  }

  try {
    const withGuards = withSignal(
      withTimeout(
        landmarkerPromise as Promise<import("@mediapipe/tasks-vision").FaceLandmarker>,
        timeoutMs,
        "Loading FaceLandmarker model"
      ),
      options.signal
    );
    return await withGuards;
  } catch (error) {
    landmarkerPromise = null;
    throw mapLoadError(error, "FaceLandmarker model");
  }
};

export const getFaceDetector = async (options: DetectionRuntimeOptions = {}) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  reportStatus(options, "Loading models...");
  throwIfAborted(options.signal);

  if (!detectorPromise) {
    detectorPromise = (async () => {
      const [vision, fileset, modelAssetPath] = await Promise.all([
        getVision(),
        getFileset(options),
        getDetectorModelPath(),
      ]);
      const fileSetForDetector =
        fileset as Parameters<typeof vision.FaceDetector.createFromOptions>[0];

      const create = (delegate: "GPU" | "CPU") =>
        withTimer(`FaceDetector.createFromOptions(${delegate})`, () =>
          vision.FaceDetector.createFromOptions(fileSetForDetector, {
            baseOptions: {
              modelAssetPath,
              delegate,
            },
            runningMode: "IMAGE",
            minDetectionConfidence: 0.2,
            minSuppressionThreshold: 0.3,
          })
        );

      try {
        return await create("GPU");
      } catch (error) {
        console.warn(
          "MediaPipe FaceDetector GPU delegate failed, falling back to CPU.",
          error
        );
        return create("CPU");
      }
    })();
  }

  try {
    const withGuards = withSignal(
      withTimeout(
        detectorPromise as Promise<import("@mediapipe/tasks-vision").FaceDetector>,
        timeoutMs,
        "Loading FaceDetector model"
      ),
      options.signal
    );
    return await withGuards;
  } catch (error) {
    detectorPromise = null;
    throw mapLoadError(error, "FaceDetector model");
  }
};

export const warmupMediapipe = async (options: DetectionRuntimeOptions = {}) => {
  if (!warmupPromise) {
    warmupPromise = (async () => {
      console.time("[mediapipe] warmup");
      try {
        reportStatus(options, "Loading WASM...");
        await getFileset(options);
        reportStatus(options, "Loading models...");
        await Promise.all([getFaceLandmarker(options), getFaceDetector(options)]);
        reportStatus(options, "MediaPipe ready.");
      } finally {
        console.timeEnd("[mediapipe] warmup");
      }
    })();
  }

  try {
    await withSignal(
      withTimeout(warmupPromise, options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS, "Warmup"),
      options.signal
    );
  } catch (error) {
    warmupPromise = null;
    throw mapLoadError(error, "warmup");
  }
};

export const loadImageFromDataUrl = async (
  dataUrl: string,
  options: DetectionRuntimeOptions = {}
) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  throwIfAborted(options.signal);
  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = dataUrl;
  });
  return withSignal(
    withTimeout(imagePromise, timeoutMs, "Loading image source"),
    options.signal
  );
};

const mapPoints = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>
): Landmark[] =>
  points.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
  }));

const withQueue = async <T>(
  task: () => Promise<T>,
  options: DetectionRuntimeOptions = {},
  label = "queued-task"
) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;
  const guardedTask = async () => {
    throwIfAborted(options.signal);
    const run = task();
    return withSignal(withTimeout(run, timeoutMs, label), options.signal);
  };
  const run = detectQueue.then(guardedTask, guardedTask);
  detectQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const detectOnSource = async (
  source: TexImageSource,
  options: DetectionRuntimeOptions = {}
) => {
  reportStatus(options, "Running landmarker...");
  throwIfAborted(options.signal);
  const landmarker = await getFaceLandmarker(options);
  const input = source as Parameters<typeof landmarker.detect>[0];
  const result = await withTimer("FaceLandmarker.detect", async () =>
    Promise.resolve(landmarker.detect(input))
  );
  throwIfAborted(options.signal);
  const points = (result.faceLandmarks?.[0] ?? []) as RawLandmark[];
  const matrixLike = result.facialTransformationMatrixes?.[0];
  return {
    points,
    pose: extractPoseFromDetection(matrixLike, points, options.expectedView),
  };
};

const detectFacesOnSource = async (
  source: TexImageSource,
  options: DetectionRuntimeOptions = {}
): Promise<FaceDetectionLike[]> => {
  reportStatus(options, "Detecting face bbox...");
  throwIfAborted(options.signal);
  const detector = await getFaceDetector(options);
  const input = source as Parameters<typeof detector.detect>[0];
  const result = await withTimer("FaceDetector.detect", async () =>
    Promise.resolve(detector.detect(input))
  );
  throwIfAborted(options.signal);
  return (result.detections ?? []) as FaceDetectionLike[];
};

const getSize = (image: HTMLImageElement) => {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  return { w, h };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createScaledSource = (
  image: HTMLImageElement,
  downscaleLongSide?: 640 | 512
): {
  source: TexImageSource;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  scaleApplied: number;
} | null => {
  const { w, h } = getSize(image);
  if (!w || !h) return null;

  if (!downscaleLongSide) {
    return {
      source: image,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      scaleApplied: 1,
    };
  }

  const longSide = Math.max(w, h);
  const scale = longSide > downscaleLongSide ? downscaleLongSide / longSide : 1;
  const scaledWidth = Math.max(1, Math.round(w * scale));
  const scaledHeight = Math.max(1, Math.round(h * scale));

  if (scaledWidth === w && scaledHeight === h) {
    return {
      source: image,
      width: w,
      height: h,
      scaleX: 1,
      scaleY: 1,
      scaleApplied: 1,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, scaledWidth, scaledHeight);

  return {
    source: canvas,
    width: scaledWidth,
    height: scaledHeight,
    scaleX: scaledWidth / w,
    scaleY: scaledHeight / h,
    scaleApplied: scale,
  };
};

const getBBoxFromDetection = (detection: FaceDetectionLike): BBox | null => {
  const bbox = detection.boundingBox;
  if (!bbox) return null;
  const x = Number.isFinite(bbox.originX) ? bbox.originX : 0;
  const y = Number.isFinite(bbox.originY) ? bbox.originY : 0;
  const width = Number.isFinite(bbox.width) ? bbox.width : 0;
  const height = Number.isFinite(bbox.height) ? bbox.height : 0;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
};

const pickBestBoundingBox = (detections: FaceDetectionLike[]) => {
  let bestBox: BBox | null = null;
  let bestScore = -Infinity;

  for (const detection of detections) {
    const bbox = getBBoxFromDetection(detection);
    if (!bbox) continue;

    const confidence = detection.categories?.[0]?.score ?? 0;
    const areaBoost = (bbox.width * bbox.height) / 1_000_000;
    const score = confidence + areaBoost;

    if (score > bestScore) {
      bestScore = score;
      bestBox = bbox;
    }
  }

  return bestBox;
};

const expandBoundingBox = (
  bbox: BBox,
  sourceWidth: number,
  sourceHeight: number,
  paddingRatio: number
) => {
  const padX = bbox.width * paddingRatio;
  const padY = bbox.height * paddingRatio;

  const x1 = clamp(Math.floor(bbox.x - padX), 0, Math.max(sourceWidth - 1, 0));
  const y1 = clamp(Math.floor(bbox.y - padY), 0, Math.max(sourceHeight - 1, 0));
  const x2 = clamp(
    Math.ceil(bbox.x + bbox.width + padX),
    x1 + 1,
    Math.max(sourceWidth, 1)
  );
  const y2 = clamp(
    Math.ceil(bbox.y + bbox.height + padY),
    y1 + 1,
    Math.max(sourceHeight, 1)
  );

  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1),
  };
};

const createCropCanvas = (
  source: TexImageSource,
  crop: { x: number; y: number; width: number; height: number }
) => {
  if (crop.width <= 0 || crop.height <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return null;

  ctx.drawImage(
    source as CanvasImageSource,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return canvas;
};

const createFlippedCanvasFromSource = (
  source: CanvasImageSource,
  width: number,
  height: number
) => {
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(-1, 0, 0, 1, width, 0);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
};

const createDownscaledCanvas = (
  source: CanvasImageSource,
  width: number,
  height: number,
  maxLongSide: 640 | 512 | 384
) => {
  if (!width || !height) return null;
  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) {
    return null;
  }
  const scale = maxLongSide / longSide;
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  if (!scaledWidth || !scaledHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, scaledWidth, scaledHeight);
  return canvas;
};

const createRotatedCanvasFromSource = (
  source: CanvasImageSource,
  width: number,
  height: number,
  deg: 90 | 180 | 270
) => {
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (deg === 90 || deg === 270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.save();
  if (deg === 90) {
    ctx.translate(height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, 0, 0, width, height);
  } else if (deg === 180) {
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0, width, height);
  } else {
    ctx.translate(0, width);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(source, 0, 0, width, height);
  }
  ctx.restore();
  return canvas;
};

const mapFlippedCropPoints = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>
) =>
  points.map((point) => ({
    x: 1 - point.x,
    y: point.y,
    z: point.z ?? 0,
    visibility: point.visibility ?? 0,
  }));

const getPointAt = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  index: number
) => (index >= 0 && index < points.length ? points[index] : null);

const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => Math.hypot(a.x - b.x, a.y - b.y);

const hasFaceLikeSpread = (
  points: RawLandmark[],
  expectedView?: "front" | "side",
  transformed = false
) => {
  if (points.length < 100) return false;
  const xs = points.map((point) => point.x).filter(Number.isFinite);
  const ys = points.map((point) => point.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return false;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const area = spanX * spanY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const thresholdShift = transformed ? 0.03 : 0;

  if (expectedView === "side") {
    if (spanX < 0.24 + thresholdShift || spanY < 0.34 + thresholdShift) return false;
    if (area < 0.12 + thresholdShift) return false;
  } else {
    if (spanX < 0.28 + thresholdShift || spanY < 0.36 + thresholdShift) return false;
    if (area < 0.16 + thresholdShift) return false;
  }

  if (centerX < 0.15 || centerX > 0.85 || centerY < 0.12 || centerY > 0.9) return false;

  const leftEye = getPointAt(points, 33);
  const rightEye = getPointAt(points, 263);
  const brow = getPointAt(points, 168);
  const chin = getPointAt(points, 152);
  const nose = getPointAt(points, 1);
  const mouthLeft = getPointAt(points, 61);
  const mouthRight = getPointAt(points, 291);

  if (!leftEye || !rightEye || !brow || !chin || !nose || !mouthLeft || !mouthRight) {
    return false;
  }

  const eyeDistance = distance(leftEye, rightEye);
  const browChinDistance = distance(brow, chin);
  const mouthDistance = distance(mouthLeft, mouthRight);
  const noseToChin = distance(nose, chin);

  if (eyeDistance < 0.08 + thresholdShift) return false;
  if (browChinDistance < 0.2 + thresholdShift) return false;
  if (mouthDistance < 0.04) return false;
  if (noseToChin < 0.12) return false;

  return true;
};

const remapFlippedPose = (pose: PoseEstimate): PoseEstimate => {
  if (pose.source === "none") return pose;
  const candidates = pose.candidates?.map((candidate) => ({
    ...candidate,
    yaw: -candidate.yaw,
    roll: -candidate.roll,
  }));

  return withPoseValidity(
    -pose.yaw,
    pose.pitch,
    -pose.roll,
    pose.source === "matrix" ? "matrix" : "fallback",
    null,
    pose.confidence * 0.72,
    pose.selectedLabel ? `${pose.selectedLabel}-flipped` : "flipped",
    candidates
  );
};

const mapFromCropToOriginal = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  crop: { x: number; y: number; width: number; height: number },
  scaleX: number,
  scaleY: number,
  originalWidth: number,
  originalHeight: number
): Landmark[] =>
  points.map((point) => {
    const xOnScaled = crop.x + point.x * crop.width;
    const yOnScaled = crop.y + point.y * crop.height;
    const xOriginal = xOnScaled / Math.max(scaleX, 1e-8);
    const yOriginal = yOnScaled / Math.max(scaleY, 1e-8);

    return {
      x: clamp(xOriginal / Math.max(originalWidth, 1), 0, 1),
      y: clamp(yOriginal / Math.max(originalHeight, 1), 0, 1),
      z: point.z,
      visibility: point.visibility,
    };
  });

const detectCropLandmarks = async (
  cropCanvas: HTMLCanvasElement,
  options: DetectionRuntimeOptions = {}
) => {
  const candidates: HTMLCanvasElement[] = [cropCanvas];

  for (const maxLongSide of CROP_LANDMARK_SCALES) {
    const downscaled = createDownscaledCanvas(
      cropCanvas,
      cropCanvas.width,
      cropCanvas.height,
      maxLongSide
    );
    if (!downscaled) continue;
    candidates.push(downscaled);
  }

  for (const candidate of candidates) {
    throwIfAborted(options.signal);
    const direct = await detectOnSource(candidate, options);
    if (direct.points.length && hasFaceLikeSpread(direct.points, options.expectedView, false)) {
      return {
        points: direct.points,
        pose: direct.pose,
        transformed: false,
      };
    }

    const flipped = createFlippedCanvasFromSource(
      candidate,
      candidate.width,
      candidate.height
    );
    if (flipped) {
      const flippedPoints = await detectOnSource(flipped, options);
      const mapped = mapFlippedCropPoints(flippedPoints.points);
      if (
        flippedPoints.points.length &&
        hasFaceLikeSpread(mapped, options.expectedView, true) &&
        (options.expectedView !== "side" || Math.abs(flippedPoints.pose.yaw) >= 35)
      ) {
        return {
          points: mapped,
          pose: remapFlippedPose(flippedPoints.pose),
          transformed: true,
        };
      }
    }

    if (options.expectedView === "side") {
      continue;
    }

    for (const deg of [90, 270, 180] as const) {
      const rotated = createRotatedCanvasFromSource(
        candidate,
        candidate.width,
        candidate.height,
        deg
      );
      if (!rotated) continue;
      const rotatedPoints = await detectOnSource(rotated, options);
      const mapped = mapFromRotate(rotatedPoints.points, deg);
      if (
        rotatedPoints.points.length &&
        hasFaceLikeSpread(mapped, options.expectedView, true)
      ) {
        return {
          points: mapped,
          pose: fallbackPoseFromPoints(mapped),
          transformed: true,
        };
      }
    }
  }

  return {
    points: [] as RawLandmark[],
    pose: emptyPose(),
    transformed: false,
  };
};

export const detectLandmarks = async (
  dataUrl: string,
  options: DetectionRuntimeOptions = {}
): Promise<LandmarksDetectionResult> =>
  withQueue(async () => {
    const image = await loadImageFromDataUrl(dataUrl, options);
    const detection = await detectOnSource(image, options);
    const landmarks = mapPoints(detection.points);
    return {
      landmarks,
      method: landmarks.length ? "normal" : "failed",
      pose: detection.pose,
      transformed: false,
    };
  }, options, "detectLandmarks");

export const detectLandmarksWithBBoxFallback = async (
  dataUrl: string,
  options: DetectionRuntimeOptions = {}
): Promise<LandmarksWithBBoxResult> =>
  withQueue(async () => {
    const image = await loadImageFromDataUrl(dataUrl, options);
    const { w: originalWidth, h: originalHeight } = getSize(image);

    if (!originalWidth || !originalHeight) {
      return {
        landmarks: [],
        method: "failed",
        bboxFound: false,
        scaleApplied: 1,
        pose: emptyPose(),
        transformed: false,
      };
    }

    let bboxFound = false;
    let lastBBox: BBox | undefined;
    let lastScaleApplied = 1;

    for (const attempt of BBOX_ATTEMPTS) {
      throwIfAborted(options.signal);
      const scaled = createScaledSource(image, attempt.downscaleLongSide);
      if (!scaled || !scaled.width || !scaled.height) {
        continue;
      }

      lastScaleApplied = scaled.scaleApplied;
      const detections = await detectFacesOnSource(scaled.source, options);
      const bboxOnScaled = pickBestBoundingBox(detections);
      if (!bboxOnScaled) {
        continue;
      }

      bboxFound = true;
      const bboxOnOriginal: BBox = {
        x: bboxOnScaled.x / Math.max(scaled.scaleX, 1e-8),
        y: bboxOnScaled.y / Math.max(scaled.scaleY, 1e-8),
        width: bboxOnScaled.width / Math.max(scaled.scaleX, 1e-8),
        height: bboxOnScaled.height / Math.max(scaled.scaleY, 1e-8),
      };
      lastBBox = bboxOnOriginal;

      for (const padding of FACE_CROP_PADDING_STEPS) {
        const expandedOnOriginal = expandBoundingBox(
          bboxOnOriginal,
          originalWidth,
          originalHeight,
          padding
        );
        const cropCanvas = createCropCanvas(image, expandedOnOriginal);
        if (!cropCanvas || !cropCanvas.width || !cropCanvas.height) {
          continue;
        }

        const cropDetection = await detectCropLandmarks(cropCanvas, options);
        if (!cropDetection.points.length) {
          continue;
        }

        const mapped = mapFromCropToOriginal(
          cropDetection.points,
          expandedOnOriginal,
          1,
          1,
          originalWidth,
          originalHeight
        );
        if (!mapped.length) {
          continue;
        }

        return {
          landmarks: mapped,
          method: attempt.method,
          bboxFound: true,
          bbox: bboxOnOriginal,
          scaleApplied: scaled.scaleApplied,
          pose: cropDetection.pose,
          transformed: cropDetection.transformed,
        };
      }
    }

    return {
      landmarks: [],
      method: "failed",
      bboxFound,
      bbox: lastBBox,
      scaleApplied: lastScaleApplied,
      pose: emptyPose(),
      transformed: false,
    };
  }, options, "detectLandmarksWithBBoxFallback");

const createFlippedCanvas = (image: HTMLImageElement) => {
  const { w, h } = getSize(image);
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(-1, 0, 0, 1, w, 0);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
};

const createPaddedCanvas = (image: HTMLImageElement, flip = false) => {
  const { w, h } = getSize(image);
  if (!w || !h) return null;
  const size = Math.max(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const offsetX = (size - w) / 2;
  const offsetY = (size - h) / 2;
  if (flip) {
    ctx.setTransform(-1, 0, 0, 1, size, 0);
    ctx.drawImage(image, offsetX, offsetY, w, h);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(image, offsetX, offsetY, w, h);
  }
  return { canvas, size, offsetX, offsetY, w, h, flip };
};

const mapFromPadded = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  size: number,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  flipped: boolean
): Landmark[] => {
  const mapped = points.map((point) => {
    const xCanvas = point.x * size;
    const yCanvas = point.y * size;
    const xOriginal = flipped ? size - xCanvas - offsetX : xCanvas - offsetX;
    const yOriginal = yCanvas - offsetY;
    return {
      x: xOriginal / width,
      y: yOriginal / height,
      z: point.z,
      visibility: point.visibility,
    };
  });
  return mapped;
};

const createRotatedCanvas = (image: HTMLImageElement, deg: 90 | 180 | 270) => {
  const { w, h } = getSize(image);
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (deg === 90 || deg === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.save();
  if (deg === 90) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, 0, 0, w, h);
  } else if (deg === 180) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    ctx.drawImage(image, 0, 0, w, h);
  } else {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(image, 0, 0, w, h);
  }
  ctx.restore();
  return { canvas, w, h, deg };
};

const mapFromRotate = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  deg: 90 | 180 | 270
): Landmark[] =>
  points.map((point) => {
    const x = point.x;
    const y = point.y;
    if (deg === 90) {
      return { x: y, y: 1 - x, z: point.z, visibility: point.visibility };
    }
    if (deg === 270) {
      return { x: 1 - y, y: x, z: point.z, visibility: point.visibility };
    }
    return { x: 1 - x, y: 1 - y, z: point.z, visibility: point.visibility };
  });

export const detectLandmarksWithFallback = async (
  dataUrl: string,
  options: { allowFlip?: boolean; allowPad?: boolean } = {}
): Promise<{ landmarks: Landmark[]; method: LegacyDetectMethod }> =>
  withQueue(async () => {
    const image = await loadImageFromDataUrl(dataUrl);
    const points = await detectOnSource(image);
    if (points.points.length) {
      return { landmarks: mapPoints(points.points), method: "normal" };
    }

    if (options.allowFlip) {
      const flipped = createFlippedCanvas(image);
      if (flipped) {
        const flippedPoints = await detectOnSource(flipped);
        if (flippedPoints.points.length) {
          const mapped = flippedPoints.points.map((point) => ({
            x: 1 - point.x,
            y: point.y,
            z: point.z,
            visibility: point.visibility,
          }));
          return { landmarks: mapped, method: "flip" };
        }
      }
    }

    if (options.allowPad) {
      const padded = createPaddedCanvas(image, false);
      if (padded) {
        const paddedPoints = await detectOnSource(padded.canvas);
        if (paddedPoints.points.length) {
          return {
            landmarks: mapFromPadded(
              paddedPoints.points,
              padded.size,
              padded.offsetX,
              padded.offsetY,
              padded.w,
              padded.h,
              false
            ),
            method: "padded",
          };
        }
      }

      if (options.allowFlip) {
        const paddedFlip = createPaddedCanvas(image, true);
        if (paddedFlip) {
          const paddedPoints = await detectOnSource(paddedFlip.canvas);
          if (paddedPoints.points.length) {
            return {
              landmarks: mapFromPadded(
                paddedPoints.points,
                paddedFlip.size,
                paddedFlip.offsetX,
                paddedFlip.offsetY,
                paddedFlip.w,
                paddedFlip.h,
                true
              ),
              method: "padded-flip",
            };
          }
        }
      }
    }

    const rotate90 = createRotatedCanvas(image, 90);
    if (rotate90) {
      const rotatedPoints = await detectOnSource(rotate90.canvas);
      if (rotatedPoints.points.length) {
        return {
          landmarks: mapFromRotate(rotatedPoints.points, 90),
          method: "rotate-90",
        };
      }
    }

    const rotate270 = createRotatedCanvas(image, 270);
    if (rotate270) {
      const rotatedPoints = await detectOnSource(rotate270.canvas);
      if (rotatedPoints.points.length) {
        return {
          landmarks: mapFromRotate(rotatedPoints.points, 270),
          method: "rotate-270",
        };
      }
    }

    const rotate180 = createRotatedCanvas(image, 180);
    if (rotate180) {
      const rotatedPoints = await detectOnSource(rotate180.canvas);
      if (rotatedPoints.points.length) {
        return {
          landmarks: mapFromRotate(rotatedPoints.points, 180),
          method: "rotate-180",
        };
      }
    }

    return { landmarks: [], method: "failed" };
  });
