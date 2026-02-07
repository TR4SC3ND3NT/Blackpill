"use client";

import type { Landmark } from "./types";

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

type BBoxAttempt = {
  method: Exclude<BBoxFallbackMethod, "failed">;
  downscaleLongSide?: 640 | 512;
};

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-assets/face_landmarker.task";
const FACE_DETECTOR_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
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

const getVision = async () => {
  if (!visionPromise) {
    visionPromise = import("@mediapipe/tasks-vision");
  }
  return visionPromise;
};

const getFileset = async () => {
  if (filesetPromise) return filesetPromise;

  filesetPromise = (async () => {
    const vision = await getVision();
    return vision.FilesetResolver.forVisionTasks(WASM_URL);
  })();

  return filesetPromise;
};

export const getFaceLandmarker = async () => {
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const [vision, fileset] = await Promise.all([getVision(), getFileset()]);
    const fileSetForLandmarker =
      fileset as Parameters<typeof vision.FaceLandmarker.createFromOptions>[0];

    const create = (delegate: "GPU" | "CPU") =>
      vision.FaceLandmarker.createFromOptions(fileSetForLandmarker, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate,
        },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.1,
        minFacePresenceConfidence: 0.1,
        minTrackingConfidence: 0.1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

    try {
      return await create("GPU");
    } catch (error) {
      console.warn("MediaPipe GPU delegate failed, falling back to CPU.", error);
      return create("CPU");
    }
  })();

  return landmarkerPromise;
};

const getFaceDetector = async () => {
  if (detectorPromise) return detectorPromise;

  detectorPromise = (async () => {
    const [vision, fileset] = await Promise.all([getVision(), getFileset()]);
    const fileSetForDetector =
      fileset as Parameters<typeof vision.FaceDetector.createFromOptions>[0];

    const create = (delegate: "GPU" | "CPU") =>
      vision.FaceDetector.createFromOptions(fileSetForDetector, {
        baseOptions: {
          modelAssetPath: FACE_DETECTOR_MODEL,
          delegate,
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.2,
        minSuppressionThreshold: 0.3,
      });

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

  return detectorPromise;
};

export const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = dataUrl;
  });

const mapPoints = (
  points: Array<{ x: number; y: number; z?: number; visibility?: number }>
): Landmark[] =>
  points.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
  }));

const withQueue = async <T>(task: () => Promise<T>) => {
  const run = detectQueue.then(task, task);
  detectQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

const detectOnSource = async (source: TexImageSource) => {
  const landmarker = await getFaceLandmarker();
  const input = source as Parameters<typeof landmarker.detect>[0];
  const result = landmarker.detect(input);
  return result.faceLandmarks?.[0] ?? [];
};

const detectFacesOnSource = async (source: TexImageSource): Promise<FaceDetectionLike[]> => {
  const detector = await getFaceDetector();
  const input = source as Parameters<typeof detector.detect>[0];
  const result = detector.detect(input);
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

const detectCropLandmarks = async (cropCanvas: HTMLCanvasElement) => {
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
    const direct = await detectOnSource(candidate);
    if (direct.length) {
      return direct;
    }

    const flipped = createFlippedCanvasFromSource(
      candidate,
      candidate.width,
      candidate.height
    );
    if (flipped) {
      const flippedPoints = await detectOnSource(flipped);
      if (flippedPoints.length) {
        return mapFlippedCropPoints(flippedPoints);
      }
    }

    for (const deg of [90, 270, 180] as const) {
      const rotated = createRotatedCanvasFromSource(
        candidate,
        candidate.width,
        candidate.height,
        deg
      );
      if (!rotated) continue;
      const rotatedPoints = await detectOnSource(rotated);
      if (rotatedPoints.length) {
        return mapFromRotate(rotatedPoints, deg);
      }
    }
  }

  return [];
};

export const detectLandmarks = async (dataUrl: string): Promise<Landmark[]> =>
  withQueue(async () => {
    const image = await loadImageFromDataUrl(dataUrl);
    const points = await detectOnSource(image);
    return mapPoints(points);
  });

export const detectLandmarksWithBBoxFallback = async (
  dataUrl: string
): Promise<LandmarksWithBBoxResult> =>
  withQueue(async () => {
    const image = await loadImageFromDataUrl(dataUrl);
    const { w: originalWidth, h: originalHeight } = getSize(image);

    if (!originalWidth || !originalHeight) {
      return {
        landmarks: [],
        method: "failed",
        bboxFound: false,
        scaleApplied: 1,
      };
    }

    let bboxFound = false;
    let lastBBox: BBox | undefined;
    let lastScaleApplied = 1;

    for (const attempt of BBOX_ATTEMPTS) {
      const scaled = createScaledSource(image, attempt.downscaleLongSide);
      if (!scaled || !scaled.width || !scaled.height) {
        continue;
      }

      lastScaleApplied = scaled.scaleApplied;
      const detections = await detectFacesOnSource(scaled.source);
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

        const points = await detectCropLandmarks(cropCanvas);
        if (!points.length) {
          continue;
        }

        const mapped = mapFromCropToOriginal(
          points,
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
        };
      }
    }

    return {
      landmarks: [],
      method: "failed",
      bboxFound,
      bbox: lastBBox,
      scaleApplied: lastScaleApplied,
    };
  });

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
    if (points.length) {
      return { landmarks: mapPoints(points), method: "normal" };
    }

    if (options.allowFlip) {
      const flipped = createFlippedCanvas(image);
      if (flipped) {
        const flippedPoints = await detectOnSource(flipped);
        if (flippedPoints.length) {
          const mapped = flippedPoints.map((point) => ({
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
        if (paddedPoints.length) {
          return {
            landmarks: mapFromPadded(
              paddedPoints,
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
          if (paddedPoints.length) {
            return {
              landmarks: mapFromPadded(
                paddedPoints,
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
      if (rotatedPoints.length) {
        return { landmarks: mapFromRotate(rotatedPoints, 90), method: "rotate-90" };
      }
    }

    const rotate270 = createRotatedCanvas(image, 270);
    if (rotate270) {
      const rotatedPoints = await detectOnSource(rotate270.canvas);
      if (rotatedPoints.length) {
        return { landmarks: mapFromRotate(rotatedPoints, 270), method: "rotate-270" };
      }
    }

    const rotate180 = createRotatedCanvas(image, 180);
    if (rotate180) {
      const rotatedPoints = await detectOnSource(rotate180.canvas);
      if (rotatedPoints.length) {
        return { landmarks: mapFromRotate(rotatedPoints, 180), method: "rotate-180" };
      }
    }

    return { landmarks: [], method: "failed" };
  });
