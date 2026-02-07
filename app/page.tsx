"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "./page.module.css";
import {
  detectLandmarks,
  detectLandmarksWithBBoxFallback,
  warmupMediapipe,
  loadImageFromDataUrl,
} from "@/lib/mediapipe";
import { fetchJson, wait } from "@/lib/api";
import type { Landmark, PhotoQuality } from "@/lib/types";

type ImageState = {
  dataUrl: string;
  width: number;
  height: number;
};

type ProcessingStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  note?: string;
};

type ExpectedView = "front" | "side";

type UploadDebug = {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  minSidePx: number;
  blurVariance?: number;
  absYaw?: number;
  dataUrlLength: number;
  dataUrlPrefix: string;
  method?: string;
  landmarkCount?: number;
  bboxFound?: boolean;
  bbox?: { x: number; y: number; width: number; height: number };
  scaleApplied?: number;
  poseYaw?: number;
  posePitch?: number;
  poseRoll?: number;
  detectedView?: PhotoQuality["detectedView"];
  landmarksSource: string;
  evaluateSource: string;
  error?: string;
};

type LandmarkPreviewData = {
  frontLandmarks: Landmark[];
  sideLandmarks: Landmark[];
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  sideMethod: string;
  sideBboxFound: boolean;
  sideBbox?: { x: number; y: number; width: number; height: number };
  sideScaleApplied: number;
  warnings: string[];
  sideWarning?: string;
};

const initialProcessing: ProcessingStep[] = [
  { key: "landmarks", label: "Detecting landmarks", status: "pending" },
  { key: "orientation", label: "Estimating side orientation", status: "pending" },
  { key: "background", label: "Refining background", status: "pending" },
  { key: "analysis", label: "Creating analysis", status: "pending" },
  { key: "save", label: "Saving landmark package", status: "pending" },
];

const compressImage = async (file: File) => {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1024,
    initialQuality: 0.82,
    useWebWorker: true,
  });
  const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
  const image = await loadImageFromDataUrl(dataUrl);
  return { dataUrl, width: image.width, height: image.height };
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeLandmarksForImage = (
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

const estimatePose = (
  points: Array<{ x: number; y: number; z: number }>
): { yaw: number; pitch: number; roll: number; detectedView: PhotoQuality["detectedView"] } => {
  if (!points.length) {
    return { yaw: 0, pitch: 0, roll: 0, detectedView: "unknown" };
  }

  const centerX = points.reduce((sum, pt) => sum + pt.x, 0) / points.length;
  const centerY = points.reduce((sum, pt) => sum + pt.y, 0) / points.length;

  const left = points.filter((pt) => pt.x < centerX);
  const right = points.filter((pt) => pt.x >= centerX);
  const upper = points.filter((pt) => pt.y < centerY);
  const lower = points.filter((pt) => pt.y >= centerY);

  const avgZ = (list: Array<{ z: number }>) =>
    list.length ? list.reduce((sum, pt) => sum + (pt.z ?? 0), 0) / list.length : 0;

  const yaw = clamp((avgZ(right) - avgZ(left)) * 180, -90, 90);
  const pitch = clamp((avgZ(lower) - avgZ(upper)) * 180, -90, 90);

  const leftmost = points.reduce((min, pt) => (pt.x < min.x ? pt : min), points[0]);
  const rightmost = points.reduce(
    (max, pt) => (pt.x > max.x ? pt : max),
    points[0]
  );
  const roll = clamp(
    (Math.atan2(rightmost.y - leftmost.y, rightmost.x - leftmost.x) * 180) /
      Math.PI,
    -90,
    90
  );

  const absYaw = Math.abs(yaw);
  const detectedView = absYaw < 15 ? "front" : absYaw > 35 ? "side" : "unknown";

  return { yaw, pitch, roll, detectedView };
};

const computeBlurVariance = async (dataUrl: string) => {
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

const MIN_SIDE_PX = 600;
const BLUR_THRESHOLD = 40;
const PREVIEW_STAGE_TIMEOUT_MS = 20_000;

const evaluatePhoto = async (
  label: string,
  dataUrl: string,
  landmarks: Landmark[],
  width: number,
  height: number,
  expectedView: ExpectedView
): Promise<{ ok: boolean; errors: string[]; warnings: string[]; quality: PhotoQuality }> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const hasLandmarks = landmarks.length > 0;
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
  }

  const minSidePx = Math.min(width, height);
  if (minSidePx < MIN_SIDE_PX) {
    errors.push(`${label} photo is too small (min ${MIN_SIDE_PX}px).`);
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
      errors.push(`${label} photo is not a full face (cropped).`);
    }
  }

  let blurVariance = 0;
  try {
    blurVariance = await computeBlurVariance(dataUrl);
  } catch {
    blurVariance = 0;
  }
  if (blurVariance < BLUR_THRESHOLD) {
    errors.push(`${label} photo is too blurry.`);
  }

  const { yaw, pitch, roll, detectedView } = estimatePose(normalized);
  const absYaw = Math.abs(yaw);
  if (hasLandmarks) {
    if (expectedView === "front" && absYaw > 35) {
      warnings.push("Front photo is not a frontal view.");
    }
    if (expectedView === "side" && absYaw < 15) {
      warnings.push("Side photo is not a true profile.");
    }
    if (expectedView === "side") {
      const validRatio = normalized.length ? valid.length / normalized.length : 0;
      if (landmarks.length < 200 || validRatio < 0.7) {
        warnings.push("Profile angle/visibility insufficient.");
      }
    }
  }

  const qualityLevel = errors.length || warnings.length ? "low" : "ok";

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    quality: {
      poseYaw: yaw,
      posePitch: pitch,
      poseRoll: roll,
      detectedView,
      faceInFrame,
      minSidePx,
      blurVariance,
      landmarkCount: landmarks.length,
      quality: qualityLevel,
      issues: [...errors, ...warnings],
    },
  };
};

const buildUploadDebug = async (
  label: "front" | "side",
  image: ImageState
): Promise<UploadDebug> => {
  const dataUrlPrefix = image.dataUrl.slice(0, 32);
  const sourceLabel = `${label}Image.dataUrl`;
  const natural = await loadImageFromDataUrl(image.dataUrl);
  const naturalWidth = natural.naturalWidth || natural.width || image.width;
  const naturalHeight = natural.naturalHeight || natural.height || image.height;
  const minSidePx = Math.min(naturalWidth, naturalHeight);
  const base: UploadDebug = {
    width: image.width,
    height: image.height,
    naturalWidth,
    naturalHeight,
    minSidePx,
    dataUrlLength: image.dataUrl.length,
    dataUrlPrefix,
    landmarksSource: `${sourceLabel} (len=${image.dataUrl.length})`,
    evaluateSource: `${sourceLabel} (len=${image.dataUrl.length})`,
  };

  try {
    let detection: {
      landmarks: Landmark[];
      method: string;
      bboxFound: boolean;
      bbox?: { x: number; y: number; width: number; height: number };
      scaleApplied: number;
    };
    if (label === "side") {
      detection = await detectLandmarksWithBBoxFallback(image.dataUrl, {
        timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
      });
    } else {
      const frontLandmarks = await detectLandmarks(image.dataUrl, {
        timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
      });
      detection = {
        landmarks: frontLandmarks,
        method: frontLandmarks.length ? "normal" : "failed",
        bboxFound: false,
        bbox: undefined,
        scaleApplied: 1,
      };
    }
    const landmarks = detection.landmarks;
    const normalized = normalizeLandmarksForImage(
      landmarks,
      image.width,
      image.height
    );
    const { yaw, pitch, roll, detectedView } = estimatePose(normalized);
    const blurVariance = await computeBlurVariance(image.dataUrl);
    return {
      ...base,
      method: detection.method,
      landmarkCount: landmarks.length,
      bboxFound: detection.bboxFound,
      bbox: detection.bbox,
      scaleApplied: detection.scaleApplied,
      poseYaw: yaw,
      absYaw: Math.abs(yaw),
      posePitch: pitch,
      poseRoll: roll,
      detectedView,
      blurVariance,
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "Landmark detection failed.",
    };
  }
};

const mergeIssues = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs / 1000}s timeout.`));
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

const withAbort = async <T,>(promise: Promise<T>, signal?: AbortSignal) => {
  if (!signal) return promise;
  if (signal.aborted) {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    throw error;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const error = new Error("Operation aborted.");
      error.name = "AbortError";
      reject(error);
    };
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

const withAbortAndTimeout = async <T,>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  label: string
) => withAbort(withTimeout(promise, timeoutMs, label), signal);

const LandmarkPreviewImage = ({
  image,
  landmarks,
  alt,
}: {
  image: ImageState;
  landmarks: Landmark[];
  alt: string;
}) => {
  const normalized = useMemo(
    () => normalizeLandmarksForImage(landmarks, image.width, image.height),
    [landmarks, image.width, image.height]
  );
  const aspectRatio = `${Math.max(1, image.width)} / ${Math.max(1, image.height)}`;

  return (
    <div className={styles.landmarkPreviewWrap} style={{ aspectRatio }}>
      <img src={image.dataUrl} alt={alt} />
      <svg className={styles.landmarkOverlay} viewBox="0 0 1 1" preserveAspectRatio="none">
        {normalized.map((point, index) => (
          <circle
            key={`${index}-${point.x.toFixed(4)}-${point.y.toFixed(4)}`}
            cx={point.x}
            cy={point.y}
            r={0.004}
          />
        ))}
      </svg>
      {!normalized.length ? (
        <div className={styles.landmarkEmpty}>No landmarks detected.</div>
      ) : null}
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [frontImage, setFrontImage] = useState<ImageState | null>(null);
  const [sideImage, setSideImage] = useState<ImageState | null>(null);
  const [frontDebug, setFrontDebug] = useState<UploadDebug | null>(null);
  const [sideDebug, setSideDebug] = useState<UploadDebug | null>(null);
  const [frontDebugLoading, setFrontDebugLoading] = useState(false);
  const [sideDebugLoading, setSideDebugLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [race, setRace] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] =
    useState<ProcessingStep[]>(initialProcessing);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<LandmarkPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [warmupStatus, setWarmupStatus] = useState<string | null>(null);
  const [warmupError, setWarmupError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const hasRunRef = useRef(false);
  const previewRequestKeyRef = useRef<string | null>(null);
  const warmupTriggeredRef = useRef(false);

  const stepItems = useMemo(
    () => [
      {
        label: "Gender",
        status: step === 0 ? "active" : step > 0 ? "done" : "inactive",
      },
      {
        label: "Ethnicity",
        status: step === 1 ? "active" : step > 1 ? "done" : "inactive",
      },
      {
        label: "Upload",
        status: step === 2 ? "active" : step > 2 ? "done" : "inactive",
      },
      {
        label: "Consent",
        status: step === 3 ? "active" : step > 3 ? "done" : "inactive",
      },
      {
        label: "Landmarks",
        status: step === 4 ? "active" : step > 4 ? "done" : "inactive",
      },
      {
        label: "Processing",
        status: step === 5 ? "active" : step > 5 ? "done" : "inactive",
      },
      {
        label: "Results",
        status: step > 5 ? "done" : "inactive",
      },
    ],
    [step]
  );

  const progressPercent = useMemo(() => {
    const total = processingSteps.length;
    const done = processingSteps.filter((item) => item.status === "done").length;
    const running = processingSteps.some((item) => item.status === "running");
    const bonus = running ? 0.35 : 0;
    return Math.min(100, Math.round(((done + bonus) / total) * 100));
  }, [processingSteps]);

  const updateProcessing = useCallback(
    (key: string, status: ProcessingStep["status"], note?: string) => {
      setProcessingSteps((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, status, note: note ?? item.note } : item
        )
      );
    },
    []
  );

  const handleFile = async (
    file: File | undefined,
    setter: (value: ImageState | null) => void
  ) => {
    if (!file) return;
    setError(null);
    setPreviewError(null);
    setPreviewData(null);
    setPreviewStatus(null);
    setWarmupError(null);
    setWarmupStatus(null);
    warmupTriggeredRef.current = false;
    previewRequestKeyRef.current = null;
    try {
      const processed = await compressImage(file);
      setter(processed);
    } catch {
      setError("Failed to process the image. Try a different photo.");
    }
  };

  useEffect(() => {
    setPreviewData(null);
    setPreviewError(null);
    setPreviewStatus(null);
    previewRequestKeyRef.current = null;
  }, [frontImage?.dataUrl, sideImage?.dataUrl]);

  useEffect(() => {
    let active = true;
    if (!frontImage || step !== 2) {
      setFrontDebug(null);
      return undefined;
    }
    setFrontDebugLoading(true);
    buildUploadDebug("front", frontImage)
      .then((debug) => {
        if (active) setFrontDebug(debug);
      })
      .finally(() => {
        if (active) setFrontDebugLoading(false);
      });
    return () => {
      active = false;
    };
  }, [frontImage, step]);

  useEffect(() => {
    let active = true;
    if (!sideImage || step !== 2) {
      setSideDebug(null);
      return undefined;
    }
    setSideDebugLoading(true);
    buildUploadDebug("side", sideImage)
      .then((debug) => {
        if (active) setSideDebug(debug);
      })
      .finally(() => {
        if (active) setSideDebugLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sideImage, step]);

  useEffect(() => {
    if (!frontImage || !sideImage) return;
    if (!consent && step < 3) return;
    if (warmupTriggeredRef.current) return;

    let active = true;
    const controller = new AbortController();
    warmupTriggeredRef.current = true;
    setWarmupError(null);
    setWarmupStatus("Loading WASM...");

    const timerLabel = `[preview] warmup-${Date.now()}`;
    console.time(timerLabel);
    withAbortAndTimeout(
      warmupMediapipe({
        timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
        signal: controller.signal,
        onStatus: (status) => {
          if (!active) return;
          setWarmupStatus(status);
        },
      }),
      controller.signal,
      PREVIEW_STAGE_TIMEOUT_MS,
      "MediaPipe warmup"
    )
      .then(() => {
        if (!active) return;
        setWarmupStatus("MediaPipe ready.");
      })
      .catch((reason) => {
        if (!active || isAbortError(reason)) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "Could not load MediaPipe runtime/models.";
        setWarmupError(message);
        setWarmupStatus(null);
        warmupTriggeredRef.current = false;
      })
      .finally(() => {
        console.timeEnd(timerLabel);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [frontImage, sideImage, consent, step]);

  const prepareLandmarkPreview = useCallback(async (
    signal?: AbortSignal
  ): Promise<LandmarkPreviewData> => {
    if (!frontImage || !sideImage) {
      throw new Error("Please upload both photos.");
    }

    const stageTimeout = PREVIEW_STAGE_TIMEOUT_MS;
    setPreviewStatus("Loading WASM...");
    await withAbortAndTimeout(
      warmupMediapipe({
        timeoutMs: stageTimeout,
        signal,
        onStatus: (status) => setPreviewStatus(status),
      }),
      signal,
      stageTimeout,
      "Preview warmup"
    );

    setPreviewStatus("Running landmarker...");
    const [front, sideDetection] = await withAbortAndTimeout(
      Promise.all([
        detectLandmarks(frontImage.dataUrl, {
          signal,
          timeoutMs: stageTimeout,
          onStatus: (status) => setPreviewStatus(status),
        }),
        detectLandmarksWithBBoxFallback(sideImage.dataUrl, {
          signal,
          timeoutMs: stageTimeout,
          onStatus: (status) => setPreviewStatus(status),
        }),
      ]),
      signal,
      stageTimeout,
      "Landmark detection"
    );
    const side = sideDetection.landmarks;

    setPreviewStatus("Evaluating quality...");
    const [frontCheck, sideCheck] = await Promise.all([
      evaluatePhoto(
        "Front",
        frontImage.dataUrl,
        front,
        frontImage.width,
        frontImage.height,
        "front"
      ),
      evaluatePhoto(
        "Side",
        sideImage.dataUrl,
        side,
        sideImage.width,
        sideImage.height,
        "side"
      ),
    ]);

    if (!frontCheck.ok) {
      throw new Error(frontCheck.errors.join(" "));
    }

    let sideQuality: PhotoQuality = sideCheck.quality;
    const warnings: string[] = [...frontCheck.warnings, ...sideCheck.warnings];
    let sideWarning: string | undefined;

    if (!side.length) {
      sideWarning = "Side face not detected - try another angle.";
      sideQuality = {
        ...sideQuality,
        quality: "low",
        issues: mergeIssues([...sideQuality.issues, sideWarning]),
      };
    } else if (!sideCheck.ok) {
      sideQuality = {
        ...sideQuality,
        quality: "low",
        issues: mergeIssues([...sideQuality.issues, ...sideCheck.errors]),
      };
      warnings.push(...sideCheck.errors);
    }

    return {
      frontLandmarks: front,
      sideLandmarks: side,
      frontQuality: frontCheck.quality,
      sideQuality,
      sideMethod: sideDetection.method,
      sideBboxFound: sideDetection.bboxFound,
      sideBbox: sideDetection.bbox,
      sideScaleApplied: sideDetection.scaleApplied,
      warnings: mergeIssues(warnings),
      sideWarning,
    };
  }, [frontImage, sideImage]);

  useEffect(() => {
    if (step !== 4 || !frontImage || !sideImage) {
      return undefined;
    }

    const requestKey = `${frontImage.dataUrl.slice(0, 32)}:${frontImage.dataUrl.length}|${sideImage.dataUrl.slice(0, 32)}:${sideImage.dataUrl.length}`;
    if (previewRequestKeyRef.current === requestKey) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    previewRequestKeyRef.current = requestKey;
    setPreviewLoading(true);
    setPreviewError(null);
    setError(null);
    setPreviewStatus("Loading WASM...");

    const timerLabel = `[preview] detect-${Date.now()}`;
    console.time(timerLabel);

    prepareLandmarkPreview(controller.signal)
      .then((result) => {
        if (!active) return;
        setPreviewData(result);
        setPreviewStatus("Preview ready.");
        if (result.sideWarning) {
          setError(result.sideWarning);
        } else if (result.warnings.length) {
          setError(`Quality warning: ${result.warnings.join(" ")}`);
        }
      })
      .catch((reason) => {
        if (!active || isAbortError(reason)) return;
        const message =
          reason instanceof Error ? reason.message : "Landmark preview failed.";
        setPreviewError(message);
        setError(message);
        setPreviewStatus(null);
      })
      .finally(() => {
        console.timeEnd(timerLabel);
        if (active) {
          setPreviewLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
      setPreviewLoading(false);
      setPreviewStatus(null);
    };
  }, [step, frontImage, sideImage, prepareLandmarkPreview]);

  const runPipeline = useCallback(async () => {
    if (!frontImage || !sideImage) return;
    if (inFlightRef.current) return;
    if (!gender || !race) {
      setError("Please complete gender and ethnicity selection first.");
      return;
    }

    inFlightRef.current = true;
    setProcessingSteps(initialProcessing);
    setError(null);

    let frontLandmarks: Landmark[] = [];
    let sideLandmarks: Landmark[] = [];
    let frontSegmented = frontImage.dataUrl;
    let sideSegmented = sideImage.dataUrl;
    let frontQuality: PhotoQuality | null = null;
    let sideQuality: PhotoQuality | null = null;

    try {
      updateProcessing("landmarks", "running");
      try {
        if (previewData) {
          frontLandmarks = previewData.frontLandmarks;
          sideLandmarks = previewData.sideLandmarks;
          frontQuality = previewData.frontQuality;
          sideQuality = previewData.sideQuality;
          const warnings = previewData.warnings.join(" ");

          if (!sideLandmarks.length) {
            const sideMessage = "Side face not detected - try another angle.";
            setError(sideMessage);
            updateProcessing(
              "landmarks",
              "done",
              warnings
                ? `${sideMessage} ${warnings}`
                : `${sideMessage} Continuing with low-confidence side analysis.`
            );
          } else {
            const methodNote = `Landmarks prepared (${previewData.sideMethod}).`;
            updateProcessing(
              "landmarks",
              "done",
              warnings ? `Quality warning: ${warnings}` : methodNote
            );
          }
        } else {
          const [front, side] = await Promise.all([
            detectLandmarks(frontImage.dataUrl, {
              timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
            }),
            detectLandmarksWithBBoxFallback(sideImage.dataUrl, {
              timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
            }),
          ]);
          frontLandmarks = front;
          sideLandmarks = side.landmarks;
          const [frontCheck, sideCheck] = await Promise.all([
            evaluatePhoto(
              "Front",
              frontImage.dataUrl,
              frontLandmarks,
              frontImage.width,
              frontImage.height,
              "front"
            ),
            evaluatePhoto(
              "Side",
              sideImage.dataUrl,
              sideLandmarks,
              sideImage.width,
              sideImage.height,
              "side"
            ),
          ]);

          frontQuality = frontCheck.quality;
          sideQuality = sideCheck.quality;

          if (!frontCheck.ok) {
            const message = frontCheck.errors.join(" ");
            setError(message);
            updateProcessing("landmarks", "error", "Photo quality check failed.");
            return;
          }

          const sideNotDetected = sideLandmarks.length === 0;
          const warningsList = [...frontCheck.warnings, ...sideCheck.warnings];
          if (sideNotDetected) {
            const sideMessage = "Side face not detected - try another angle.";
            setError(sideMessage);
            sideQuality = {
              ...sideCheck.quality,
              quality: "low",
              issues: mergeIssues([...sideCheck.quality.issues, sideMessage]),
            };
            const note = warningsList.length
              ? `${sideMessage} ${warningsList.join(" ")}`
              : `${sideMessage} Continuing with low-confidence side analysis.`;
            updateProcessing("landmarks", "done", note);
          } else {
            if (!sideCheck.ok) {
              warningsList.push(...sideCheck.errors);
              sideQuality = {
                ...sideCheck.quality,
                quality: "low",
                issues: mergeIssues([...sideCheck.quality.issues, ...sideCheck.errors]),
              };
            }

            updateProcessing(
              "landmarks",
              "done",
              warningsList.length
                ? `Quality warning: ${mergeIssues(warningsList).join(" ")}`
                : `Landmarks prepared (${side.method}).`
            );
          }
        }
      } catch {
        updateProcessing("landmarks", "error", "Face detection failed.");
        setError("Face detection failed. Please try clearer photos.");
        return;
      }

      updateProcessing("orientation", "running");
      try {
        await fetchJson("/api/side-landmarks", {
          method: "POST",
          body: JSON.stringify({
            mediapipeLandmarks: sideLandmarks,
            imageWidth: sideImage.width,
            imageHeight: sideImage.height,
          }),
        });
        updateProcessing("orientation", "done");
      } catch {
        updateProcessing("orientation", "error", "Orientation fallback enabled.");
      }

      updateProcessing("background", "running");
      try {
        const [frontRes, sideRes] = await Promise.all([
          fetchJson<{ success: boolean; image: string }>("/api/background-removal", {
            method: "POST",
            body: JSON.stringify({ image: frontImage.dataUrl, quality: 0.8 }),
          }),
          fetchJson<{ success: boolean; image: string }>("/api/background-removal", {
            method: "POST",
            body: JSON.stringify({ image: sideImage.dataUrl, quality: 0.8 }),
          }),
        ]);
        frontSegmented = frontRes.image ?? frontSegmented;
        sideSegmented = sideRes.image ?? sideSegmented;
        updateProcessing("background", "done");
      } catch {
        updateProcessing("background", "error", "Background retained.");
      }

      updateProcessing("analysis", "running");
      const create = await fetchJson<{ success: boolean; faceId: string }>("/api/faces", {
        method: "POST",
        body: JSON.stringify({
          frontPhotoUrl: frontImage.dataUrl,
          sidePhotoUrl: sideImage.dataUrl,
          frontPhotoSegmentedUrl: frontSegmented,
          sidePhotoSegmentedUrl: sideSegmented,
          frontLandmarks,
          sideLandmarks,
          mediapipeLandmarks: frontLandmarks,
          frontQuality,
          sideQuality,
          gender,
          race,
        }),
      });
      updateProcessing("analysis", "done");

      updateProcessing("save", "running");
      try {
        await Promise.all([
          fetchJson(`/api/faces/${create.faceId}/mediapipe`, {
            method: "POST",
            body: JSON.stringify({
              kind: "front",
              landmarks: frontLandmarks,
            }),
          }),
          fetchJson(`/api/faces/${create.faceId}/mediapipe`, {
            method: "POST",
            body: JSON.stringify({
              kind: "side",
              landmarks: sideLandmarks,
            }),
          }),
        ]);
        updateProcessing("save", "done");
      } catch {
        updateProcessing("save", "error", "Failed to save landmarks.");
      }

      await wait(300);
      router.push(`/results/${create.faceId}`);
    } catch {
      setError("Something went wrong while creating the analysis. Please retry.");
      updateProcessing("analysis", "error");
    } finally {
      setIsProcessing(false);
      inFlightRef.current = false;
    }
  }, [frontImage, sideImage, gender, race, previewData, router, updateProcessing]);

  useEffect(() => {
    if (step !== 5) {
      hasRunRef.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (step === 5 && !hasRunRef.current) {
      hasRunRef.current = true;
      setIsProcessing(true);
      runPipeline();
    }
  }, [step, runPipeline]);

  const canProceed = frontImage && sideImage;
  const formatNumber = (value?: number, digits = 1) =>
    value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);
  const formatCount = (value?: number) =>
    value == null || Number.isNaN(value) ? "--" : Math.round(value).toString();
  const formatBool = (value?: boolean) =>
    value == null ? "--" : value ? "yes" : "no";
  const formatBbox = (
    bbox?: { x: number; y: number; width: number; height: number }
  ) =>
    bbox
      ? `${Math.round(bbox.x)} ${Math.round(bbox.y)} ${Math.round(
          bbox.width
        )} ${Math.round(bbox.height)}`
      : "--";
  const formatSource = (debug: UploadDebug | null, kind: "landmarks" | "evaluate") =>
    debug
      ? `${kind === "landmarks" ? debug.landmarksSource : debug.evaluateSource} [${debug.method ?? "--"}] | ${debug.dataUrlPrefix}...`
      : "--";

  return (
    <main className={styles.homeShell}>
      <div className={styles.homeContainer}>
        <div className={styles.header}>
          <div className={styles.title}>Blackpill</div>
          <div className={styles.subtitle}>
            Upload front and side photos, review consent, then we run a quick landmark
            analysis to generate structured scores and assessments.
          </div>
        </div>

        <div className={styles.homeStepper}>
          {stepItems.map((item) => (
            <div
              key={item.label}
              className={`${styles.homeStep} ${
                item.status === "active"
                  ? styles.homeStepActive
                  : item.status === "done"
                    ? styles.homeStepDone
                    : ""
              }`}
            >
              <span className={styles.homeStepDot} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="gender"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.grid}`}>
                <div>
                  <strong>Select your gender</strong>
                  <div className={styles.note}>
                    This helps us calibrate symmetry and ratio benchmarks.
                  </div>
                </div>
                <div className={styles.choiceGrid}>
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.choiceButton} ${
                        gender === option.value ? styles.choiceButtonActive : ""
                      }`}
                      onClick={() => {
                        setGender(option.value);
                        setError(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {error ? <div className={styles.error}>{error}</div> : null}
                <div className={styles.actions}>
                  <Button
                    onClick={() => {
                      if (!gender) {
                        setError("Please select a gender to continue.");
                        return;
                      }
                      setError(null);
                      setStep(1);
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {step === 1 ? (
            <motion.div
              key="ethnicity"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.grid}`}>
                <div>
                  <strong>Select your ethnicity</strong>
                  <div className={styles.note}>
                    Choose the closest match to align feature comparisons.
                  </div>
                </div>
                <div className={styles.choiceGrid}>
                  {[
                    { value: "asian", label: "Asian" },
                    { value: "black", label: "Black / African" },
                    { value: "latino", label: "Hispanic / Latino" },
                    { value: "middle-eastern", label: "Middle Eastern" },
                    { value: "white", label: "White / Caucasian" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.choiceButton} ${
                        race === option.value ? styles.choiceButtonActive : ""
                      }`}
                      onClick={() => {
                        setRace(option.value);
                        setError(null);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {error ? <div className={styles.error}>{error}</div> : null}
                <div className={styles.actions}>
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!race) {
                        setError("Please select an ethnicity to continue.");
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.grid}`}>
                <div className={styles.uploadGrid}>
                  <div className={styles.uploadCard}>
                    <div>
                      <strong>Front Photo</strong>
                      <div className={styles.note}>
                        Straight-on, eyes open, even lighting.
                      </div>
                    </div>
                    {frontImage ? (
                      <>
                        <div className={styles.preview}>
                          <img src={frontImage.dataUrl} alt="Front preview" />
                        </div>
                        <div className={styles.debugPanel}>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>natural</span>
                            <span className={styles.debugValue}>
                              {frontDebug?.naturalWidth ?? frontImage.width}×
                              {frontDebug?.naturalHeight ?? frontImage.height}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>min side</span>
                            <span className={styles.debugValue}>
                              {formatCount(frontDebug?.minSidePx)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>landmarks</span>
                            <span className={styles.debugValue}>
                              {formatCount(frontDebug?.landmarkCount)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>method</span>
                            <span className={styles.debugValue}>
                              {frontDebug?.method ?? "--"}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>bbox found</span>
                            <span className={styles.debugValue}>
                              {formatBool(frontDebug?.bboxFound)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>bbox (x y w h)</span>
                            <span className={styles.debugValue}>
                              {formatBbox(frontDebug?.bbox)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>scale</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.scaleApplied, 2)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose yaw</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.poseYaw)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>abs yaw</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.absYaw)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose pitch</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.posePitch)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose roll</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.poseRoll)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>detected view</span>
                            <span className={styles.debugValue}>
                              {frontDebug?.detectedView ?? "--"}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>blur var</span>
                            <span className={styles.debugValue}>
                              {formatNumber(frontDebug?.blurVariance)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>landmarks src</span>
                            <span className={styles.debugMono}>
                              {formatSource(frontDebug, "landmarks")}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>evaluate src</span>
                            <span className={styles.debugMono}>
                              {formatSource(frontDebug, "evaluate")}
                            </span>
                          </div>
                          {frontDebugLoading ? (
                            <div className={styles.debugHint}>detecting...</div>
                          ) : null}
                          {frontDebug?.error ? (
                            <div className={styles.debugError}>
                              {frontDebug.error}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    <input
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleFile(event.target.files?.[0], setFrontImage)
                      }
                    />
                  </div>

                  <div className={styles.uploadCard}>
                    <div>
                      <strong>Side Photo</strong>
                      <div className={styles.note}>Clear profile, chin neutral.</div>
                    </div>
                    {sideImage ? (
                      <>
                        <div className={styles.preview}>
                          <img src={sideImage.dataUrl} alt="Side preview" />
                        </div>
                        <div className={styles.debugPanel}>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>natural</span>
                            <span className={styles.debugValue}>
                              {sideDebug?.naturalWidth ?? sideImage.width}×
                              {sideDebug?.naturalHeight ?? sideImage.height}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>min side</span>
                            <span className={styles.debugValue}>
                              {formatCount(sideDebug?.minSidePx)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>landmarks</span>
                            <span className={styles.debugValue}>
                              {formatCount(sideDebug?.landmarkCount)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>method</span>
                            <span className={styles.debugValue}>
                              {sideDebug?.method ?? "--"}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>bbox found</span>
                            <span className={styles.debugValue}>
                              {formatBool(sideDebug?.bboxFound)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>bbox (x y w h)</span>
                            <span className={styles.debugValue}>
                              {formatBbox(sideDebug?.bbox)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>scale</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.scaleApplied, 2)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose yaw</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.poseYaw)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>abs yaw</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.absYaw)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose pitch</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.posePitch)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>pose roll</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.poseRoll)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>detected view</span>
                            <span className={styles.debugValue}>
                              {sideDebug?.detectedView ?? "--"}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>blur var</span>
                            <span className={styles.debugValue}>
                              {formatNumber(sideDebug?.blurVariance)}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>landmarks src</span>
                            <span className={styles.debugMono}>
                              {formatSource(sideDebug, "landmarks")}
                            </span>
                          </div>
                          <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>evaluate src</span>
                            <span className={styles.debugMono}>
                              {formatSource(sideDebug, "evaluate")}
                            </span>
                          </div>
                          {sideDebugLoading ? (
                            <div className={styles.debugHint}>detecting...</div>
                          ) : null}
                          {sideDebug?.error ? (
                            <div className={styles.debugError}>{sideDebug.error}</div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    <input
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleFile(event.target.files?.[0], setSideImage)
                      }
                    />
                  </div>
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canProceed}
                  >
                    Continue to Consent
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFrontImage(null);
                      setSideImage(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {step === 3 ? (
            <motion.div
              key="consent"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.grid}`}>
                <div className={styles.consentBox}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  <div>
                    <strong>I consent to processing</strong>
                    <div className={styles.note}>
                      Photos are used only to generate your analysis session and are
                      stored locally in this MVP. You can reset at any time.
                    </div>
                  </div>
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!consent) {
                        setError("Please confirm consent to continue.");
                        return;
                      }
                      setPreviewError(null);
                      setPreviewData(null);
                      setPreviewStatus(null);
                      previewRequestKeyRef.current = null;
                      setError(null);
                      setStep(4);
                    }}
                  >
                    Preview Landmarks
                  </Button>
                </div>
                {warmupStatus ? (
                  <div className={styles.hint}>MediaPipe warmup: {warmupStatus}</div>
                ) : null}
                {warmupError ? <div className={styles.error}>{warmupError}</div> : null}
              </Card>
            </motion.div>
          ) : null}

          {step === 4 ? (
            <motion.div
              key="landmark-preview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.grid}`}>
                <div>
                  <strong>Landmark Preview</strong>
                  <div className={styles.note}>
                    Here is how landmarks were placed on both photos. Continue to run the
                    full analysis.
                  </div>
                </div>

                {previewData ? (
                  <div className={styles.landmarkReviewGrid}>
                    <div className={styles.landmarkCard}>
                      <div className={styles.landmarkTitleRow}>
                        <strong>Front</strong>
                        <span className={styles.debugValue}>
                          {previewData.frontLandmarks.length} points
                        </span>
                      </div>
                      <LandmarkPreviewImage
                        image={frontImage as ImageState}
                        landmarks={previewData.frontLandmarks}
                        alt="Front landmarks preview"
                      />
                      <div className={styles.debugPanel}>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>method</span>
                          <span className={styles.debugValue}>normal</span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>quality</span>
                          <span className={styles.debugValue}>
                            {previewData.frontQuality.quality}
                          </span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>pose yaw</span>
                          <span className={styles.debugValue}>
                            {formatNumber(previewData.frontQuality.poseYaw)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.landmarkCard}>
                      <div className={styles.landmarkTitleRow}>
                        <strong>Side</strong>
                        <span className={styles.debugValue}>
                          {previewData.sideLandmarks.length} points
                        </span>
                      </div>
                      <LandmarkPreviewImage
                        image={sideImage as ImageState}
                        landmarks={previewData.sideLandmarks}
                        alt="Side landmarks preview"
                      />
                      <div className={styles.debugPanel}>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>method</span>
                          <span className={styles.debugValue}>
                            {previewData.sideMethod}
                          </span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>bbox found</span>
                          <span className={styles.debugValue}>
                            {formatBool(previewData.sideBboxFound)}
                          </span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>bbox (x y w h)</span>
                          <span className={styles.debugValue}>
                            {formatBbox(previewData.sideBbox)}
                          </span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>scale</span>
                          <span className={styles.debugValue}>
                            {formatNumber(previewData.sideScaleApplied, 2)}
                          </span>
                        </div>
                        <div className={styles.debugRow}>
                          <span className={styles.debugLabel}>quality</span>
                          <span className={styles.debugValue}>
                            {previewData.sideQuality.quality}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {previewStatus ? (
                  <div className={styles.note}>Status: {previewStatus}</div>
                ) : null}
                {previewLoading ? <div className={styles.note}>Preparing preview...</div> : null}
                {previewError ? <div className={styles.error}>{previewError}</div> : null}

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!previewData) {
                        setError("Landmark preview is not ready yet.");
                        return;
                      }
                      setError(null);
                      setStep(5);
                    }}
                    disabled={!previewData || previewLoading}
                  >
                    Continue to Analysis
                  </Button>
                  {previewError ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPreviewError(null);
                        setPreviewData(null);
                        setPreviewStatus(null);
                        previewRequestKeyRef.current = null;
                      }}
                    >
                      Retry
                    </Button>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ) : null}

          {step === 5 ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
            >
              <Card className={`${styles.homeCard} ${styles.progressWrap}`}>
                <div>
                  <strong>Processing</strong>
                  <div className={styles.note}>
                    We are running on-device landmarking and preparing your analysis.
                  </div>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className={styles.shimmer} />
                  </div>
                </div>

                <div className={styles.statusList}>
                  {processingSteps.map((item) => (
                    <div key={item.key} className={styles.statusItem}>
                      <span
                        className={`${styles.statusDot} ${
                          item.status === "running"
                            ? styles.statusRunning
                            : item.status === "done"
                              ? styles.statusDone
                              : item.status === "error"
                                ? styles.statusError
                                : ""
                        }`}
                      />
                      <span>{item.label}</span>
                      {item.note ? (
                        <span className={styles.hint}>({item.note})</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                  <Button
                    variant="ghost"
                    onClick={() => setStep(4)}
                    disabled={isProcessing}
                  >
                    Back
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
