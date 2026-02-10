"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ManualLandmarkPoint, PhotoQuality } from "@/lib/types";
import {
  LANDMARK_REGISTRY_BY_ID,
  countManualCompletion,
  getReferenceSources,
  initManualLandmarks,
  type LandmarkCalibrationView,
} from "@/lib/landmark-registry";
import Button from "@/components/Button";
import styles from "./landmark-calibrator.module.css";

type ImageState = {
  dataUrl: string;
  width: number;
  height: number;
};

type CalibrationResult = {
  manualPoints: ManualLandmarkPoint[];
};

type Props = {
  frontImage: ImageState;
  sideImage: ImageState;
  frontLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  sideLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  initialPoints?: ManualLandmarkPoint[] | null;
  onBack: () => void;
  onComplete: (result: CalibrationResult) => void;
};

type CalibrationPhase =
  | "front_steps"
  | "front_summary"
  | "side_steps"
  | "side_summary";

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeLandmarksForImage = (
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number
) => {
  if (!points.length) return [];
  const maxX = Math.max(...points.map((pt) => pt.x));
  const maxY = Math.max(...points.map((pt) => pt.y));
  const normalized = maxX <= 2 && maxY <= 2;
  if (normalized) {
    return points.map((pt) => ({ x: pt.x, y: pt.y }));
  }
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  return points.map((pt) => ({
    x: pt.x / safeW,
    y: pt.y / safeH,
  }));
};

const computeBBox = (points: Array<{ x: number; y: number }>): BBox | null => {
  const valid = points.filter(
    (pt) =>
      Number.isFinite(pt.x) &&
      Number.isFinite(pt.y) &&
      pt.x >= 0 &&
      pt.x <= 1 &&
      pt.y >= 0 &&
      pt.y <= 1
  );
  if (!valid.length) return null;
  const xs = valid.map((pt) => pt.x);
  const ys = valid.map((pt) => pt.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1e-6, maxX - minX),
    height: Math.max(1e-6, maxY - minY),
  };
};

const fitSquareWithPadding = (bbox: BBox, padding: number): ViewBox => {
  const pad = clamp(padding, 0.04, 0.22);
  const size = clamp(Math.max(bbox.width, bbox.height) + pad * 2, 0.2, 1);

  const half = size / 2;
  const cx = clamp((bbox.minX + bbox.maxX) / 2, half, 1 - half);
  const cy = clamp((bbox.minY + bbox.maxY) / 2, half, 1 - half);

  return {
    x: clamp(cx - half, 0, 1 - size),
    y: clamp(cy - half, 0, 1 - size),
    width: size,
    height: size,
  };
};

const smartFaceViewBox = (params: {
  landmarks: Array<{ x: number; y: number }>;
  imageWidth: number;
  imageHeight: number;
}): ViewBox => {
  const normalized = normalizeLandmarksForImage(params.landmarks, params.imageWidth, params.imageHeight);
  const bbox = computeBBox(normalized);
  if (!bbox) return { x: 0, y: 0, width: 1, height: 1 };
  // Pad so the face fills ~70-80% of the viewport.
  const padding = Math.max(bbox.width, bbox.height) * 0.15;
  // Use a square viewBox in normalized space so the rendered view keeps the photo's aspect ratio.
  return fitSquareWithPadding(bbox, padding);
};

const hasLowConfidenceWarning = (point: ManualLandmarkPoint) => {
  if (point.confidence < 0.58) return true;
  return point.reasonCodes.some((reason) =>
    ["manual_recommended", "hair_occlusion", "occlusion", "edge_point"].includes(reason)
  );
};

const toIndicesForView = (
  points: ManualLandmarkPoint[],
  view: LandmarkCalibrationView
): number[] =>
  points.reduce<number[]>((acc, point, index) => {
    if (point.view === view) acc.push(index);
    return acc;
  }, []);

const isStepPhase = (phase: CalibrationPhase) =>
  phase === "front_steps" || phase === "side_steps";

const viewFromPhase = (phase: CalibrationPhase): LandmarkCalibrationView =>
  phase.startsWith("side") ? "side" : "front";

const isValidPoint = (point: ManualLandmarkPoint | null) => {
  if (!point) return false;
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
};

export default function LandmarkCalibrator({
  frontImage,
  sideImage,
  frontLandmarks,
  sideLandmarks,
  frontQuality,
  sideQuality,
  initialPoints,
  onBack,
  onComplete,
}: Props) {
  const seededPoints = useMemo(
    () =>
      initialPoints && initialPoints.length
        ? initialPoints
        : initManualLandmarks({
            frontLandmarks,
            sideLandmarks,
            frontQuality,
            sideQuality,
          }),
    [initialPoints, frontLandmarks, sideLandmarks, frontQuality, sideQuality]
  );

  const [points, setPoints] = useState<ManualLandmarkPoint[]>(seededPoints);
  const [phase, setPhase] = useState<CalibrationPhase>("front_steps");
  const [frontCursor, setFrontCursor] = useState(0);
  const [sideCursor, setSideCursor] = useState(0);
  const [activeTab, setActiveTab] = useState<"photo" | "howto">("photo");
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<{
    key: string;
    missing: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 4>(1);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const initialMapRef = useRef<Map<string, ManualLandmarkPoint>>(
    new Map(seededPoints.map((point) => [point.id, { ...point }]))
  );

  const frontIndices = useMemo(() => toIndicesForView(points, "front"), [points]);
  const sideIndices = useMemo(() => toIndicesForView(points, "side"), [points]);

  const sideReadyForCalibration = useMemo(
    () => sideQuality.landmarkCount > 0 && sideQuality.viewWeight > 0.1,
    [sideQuality]
  );

  const currentView = viewFromPhase(phase);
  const activeIndices = currentView === "front" ? frontIndices : sideIndices;
  const currentCursor = currentView === "front" ? frontCursor : sideCursor;

  const activeGlobalIndex =
    isStepPhase(phase) && activeIndices.length
      ? activeIndices[Math.max(0, Math.min(activeIndices.length - 1, currentCursor))]
      : -1;

  const activePoint = activeGlobalIndex >= 0 ? points[activeGlobalIndex] : null;

  const activeImage =
    currentView === "side"
      ? sideImage
      : frontImage;

  const smartBaseViewBox = useMemo<ViewBox>(() => {
    if (!isStepPhase(phase)) return { x: 0, y: 0, width: 1, height: 1 };
    const landmarks = currentView === "side" ? sideLandmarks : frontLandmarks;
    if (!landmarks.length) return { x: 0, y: 0, width: 1, height: 1 };
    return smartFaceViewBox({
      landmarks,
      imageWidth: activeImage.width,
      imageHeight: activeImage.height,
    });
  }, [phase, currentView, frontLandmarks, sideLandmarks, activeImage.width, activeImage.height]);

  const pointsForCurrentView = useMemo(
    () => points.filter((point) => point.view === currentView),
    [points, currentView]
  );

  const activeDefinition = useMemo(() => {
    if (!activePoint) return null;
    return LANDMARK_REGISTRY_BY_ID.get(activePoint.id) ?? null;
  }, [activePoint]);

  const completionFront = useMemo(() => countManualCompletion(points, "front"), [points]);
  const completionSide = useMemo(() => countManualCompletion(points, "side"), [points]);

  const summaryReady =
    completionFront.ready &&
    (sideReadyForCalibration && sideIndices.length > 0 ? completionSide.ready : true);

  const activeViewBox = useMemo<ViewBox>(() => {
    if (!isStepPhase(phase) || !activePoint) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }

    const base = smartBaseViewBox;
    const width = base.width / zoomLevel;
    const height = base.height / zoomLevel;
    const halfW = width / 2;
    const halfH = height / 2;

    const minCx = base.x + halfW;
    const maxCx = base.x + base.width - halfW;
    const minCy = base.y + halfH;
    const maxCy = base.y + base.height - halfH;
    const cx = clamp(activePoint.x, minCx, maxCx);
    const cy = clamp(activePoint.y, minCy, maxCy);

    return {
      x: clamp(cx - halfW, 0, 1 - width),
      y: clamp(cy - halfH, 0, 1 - height),
      width,
      height,
    };
  }, [phase, activePoint, zoomLevel, smartBaseViewBox]);

  const updatePoint = useCallback((index: number, patch: Partial<ManualLandmarkPoint>) => {
    setPoints((prev) =>
      prev.map((point, idx) => (idx === index ? { ...point, ...patch } : point))
    );
  }, []);

  const movePointTo = useCallback((x: number, y: number) => {
    if (!isStepPhase(phase) || !activePoint || activeGlobalIndex < 0) return;
    updatePoint(activeGlobalIndex, {
      x: clamp01(x),
      y: clamp01(y),
      source: "manual",
      confidence: Math.max(activePoint.confidence, 0.93),
      reasonCodes: Array.from(new Set([...activePoint.reasonCodes, "manual_adjusted"])),
      confirmed: false,
    });
    setError(null);
  }, [phase, activePoint, activeGlobalIndex, updatePoint]);

  const moveByPixels = useCallback((dxPx: number, dyPx: number) => {
    if (!isStepPhase(phase) || !activePoint || !activeImage) return;
    movePointTo(
      activePoint.x + dxPx / Math.max(1, activeImage.width),
      activePoint.y + dyPx / Math.max(1, activeImage.height)
    );
  }, [phase, activePoint, activeImage, movePointTo]);

  const setByPointerEvent = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isStepPhase(phase)) return;
    const container = stageRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // SVG uses `preserveAspectRatio="xMidYMid meet"` to prevent image stretching; account for
    // potential letterboxing when mapping pointer coords -> viewBox coords.
    const imageW = Math.max(1, activeImage.width);
    const imageH = Math.max(1, activeImage.height);
    const viewBoxW = Math.max(1e-6, activeViewBox.width * imageW);
    const viewBoxH = Math.max(1e-6, activeViewBox.height * imageH);

    const scale = Math.min(rect.width / viewBoxW, rect.height / viewBoxH);
    const renderW = viewBoxW * scale;
    const renderH = viewBoxH * scale;
    const offsetX = (rect.width - renderW) / 2;
    const offsetY = (rect.height - renderH) / 2;

    const xIn = event.clientX - rect.left - offsetX;
    const yIn = event.clientY - rect.top - offsetY;
    if (xIn < 0 || xIn > renderW || yIn < 0 || yIn > renderH) return;

    const relX = xIn / renderW;
    const relY = yIn / renderH;
    const x = activeViewBox.x + relX * activeViewBox.width;
    const y = activeViewBox.y + relY * activeViewBox.height;

    movePointTo(x, y);
  }, [
    phase,
    activeImage.width,
    activeImage.height,
    activeViewBox.x,
    activeViewBox.y,
    activeViewBox.width,
    activeViewBox.height,
    movePointTo,
  ]);

  const goBack = useCallback(() => {
    setError(null);
    if (phase === "front_steps") {
      onBack();
      return;
    }

    if (phase === "front_summary") {
      setPhase("front_steps");
      setFrontCursor(Math.max(0, frontIndices.length - 1));
      return;
    }

    if (phase === "side_steps") {
      setPhase("front_summary");
      return;
    }

    if (phase === "side_summary") {
      if (sideIndices.length > 0) {
        setPhase("side_steps");
        setSideCursor(Math.max(0, sideIndices.length - 1));
      } else {
        setPhase("front_summary");
      }
    }
  }, [phase, onBack, frontIndices.length, sideIndices.length]);

  const goPreviousPoint = useCallback(() => {
    setError(null);
    if (phase === "front_steps") {
      if (frontCursor > 0) {
        setFrontCursor((idx) => Math.max(0, idx - 1));
      }
      return;
    }
    if (phase === "side_steps") {
      if (sideCursor > 0) {
        setSideCursor((idx) => Math.max(0, idx - 1));
      } else {
        setPhase("front_summary");
      }
    }
  }, [phase, frontCursor, sideCursor]);

  const acceptCurrentAndAdvance = useCallback(() => {
    if (!isStepPhase(phase) || !activePoint || activeGlobalIndex < 0) return;
    if (!isValidPoint(activePoint)) {
      setError("Current landmark is invalid. Reset or place it inside the photo bounds.");
      return;
    }

    updatePoint(activeGlobalIndex, {
      confirmed: true,
      source: activePoint.source === "manual" ? "manual" : "auto_confirmed",
    });

    setError(null);

    if (phase === "front_steps") {
      if (frontCursor >= frontIndices.length - 1) {
        setPhase("front_summary");
      } else {
        setFrontCursor((idx) => Math.min(frontIndices.length - 1, idx + 1));
      }
      return;
    }

    if (phase === "side_steps") {
      if (sideCursor >= sideIndices.length - 1) {
        setPhase("side_summary");
      } else {
        setSideCursor((idx) => Math.min(sideIndices.length - 1, idx + 1));
      }
    }
  }, [
    phase,
    activePoint,
    activeGlobalIndex,
    updatePoint,
    frontCursor,
    frontIndices.length,
    sideCursor,
    sideIndices.length,
  ]);

  const resetCurrent = useCallback(() => {
    if (!isStepPhase(phase) || !activePoint || activeGlobalIndex < 0) return;
    const initial = initialMapRef.current.get(activePoint.id);
    if (!initial) return;
    updatePoint(activeGlobalIndex, { ...initial });
    setError(null);
  }, [phase, activePoint, activeGlobalIndex, updatePoint]);

  const openSidePhase = () => {
    if (!completionFront.ready) {
      setError("Complete required FRONT landmarks before continuing to profile.");
      return;
    }

    setError(null);

    if (!sideIndices.length || !sideReadyForCalibration) {
      setPhase("side_summary");
      return;
    }

    setPhase("side_steps");
    setSideCursor(0);
  };

  const finishCalibration = () => {
    if (!summaryReady) {
      setError("Complete all required landmarks before continuing to analysis.");
      return;
    }
    onComplete({ manualPoints: points });
  };

  useEffect(() => {
    if (!isStepPhase(phase) || !activePoint) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }

      const stepPx = event.shiftKey ? 4 : 1;

      if (event.key === "Enter") {
        event.preventDefault();
        acceptCurrentAndAdvance();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        goPreviousPoint();
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetCurrent();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveByPixels(0, -stepPx);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveByPixels(0, stepPx);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveByPixels(-stepPx, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveByPixels(stepPx, 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    phase,
    activePoint,
    activeGlobalIndex,
    frontCursor,
    sideCursor,
    frontIndices.length,
    sideIndices.length,
    acceptCurrentAndAdvance,
    goPreviousPoint,
    moveByPixels,
    resetCurrent,
  ]);

  const stepCounterText =
    phase === "front_steps"
      ? `${frontCursor + 1} of ${Math.max(1, frontIndices.length)}`
      : phase === "side_steps"
        ? `${sideCursor + 1} of ${Math.max(1, sideIndices.length)}`
        : phase === "front_summary"
          ? `Front summary (${completionFront.totalConfirmed}/${completionFront.total})`
          : `Side summary (${completionSide.totalConfirmed}/${completionSide.total})`;

  const progressRatio =
    phase === "front_steps"
      ? (frontCursor + 1) / Math.max(1, frontIndices.length)
      : phase === "side_steps"
        ? (sideCursor + 1) / Math.max(1, sideIndices.length)
        : phase === "front_summary"
          ? completionFront.totalConfirmed / Math.max(1, completionFront.total)
          : completionSide.totalConfirmed / Math.max(1, completionSide.total || 1);

  const referenceSources =
    activeDefinition && isStepPhase(phase)
      ? getReferenceSources(activeDefinition).sources
      : [];

  const referenceSrc = referenceSources[0] ?? "";
  const referenceKey = activePoint ? `${activePoint.id}:${referenceSrc}` : "";

  const summaryTitle =
    phase === "front_summary"
      ? "Front Calibration Summary"
      : phase === "side_summary"
        ? "Profile Calibration Summary"
        : "";

  const summarySubtitle =
    phase === "front_summary"
      ? "Review your finalized FRONT landmarks before starting profile calibration."
      : phase === "side_summary"
        ? "Review your finalized SIDE landmarks. Continue only when this looks correct."
        : "";

  const imageWidthForRadius = Math.max(1, activeImage.width);
  const pointRadius = isStepPhase(phase)
    ? Math.max(0.00042, activeViewBox.width * 0.00145) * imageWidthForRadius
    : 0.00095 * imageWidthForRadius;

  const imageWidth = Math.max(1, activeImage.width);
  const imageHeight = Math.max(1, activeImage.height);
  const viewBoxX = activeViewBox.x * imageWidth;
  const viewBoxY = activeViewBox.y * imageHeight;
  const viewBoxW = activeViewBox.width * imageWidth;
  const viewBoxH = activeViewBox.height * imageHeight;

  const canGoPreviousPoint =
    phase === "front_steps"
      ? frontCursor > 0
      : phase === "side_steps"
        ? sideCursor > 0 || frontIndices.length > 0
        : false;

  if (!points.length) {
    return <div className={styles.empty}>Preparing landmark calibration...</div>;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.stageWrap}>
        <div className={styles.phaseBadge}>
          {phase.startsWith("front") ? "FRONT" : "SIDE"}
          {isStepPhase(phase)
            ? " LANDMARK STEP"
            : " REVIEW"}
        </div>

        <div
          className={`${styles.stage} ${isStepPhase(phase) ? styles.stageInteractive : ""}`}
          ref={stageRef}
          onPointerDown={(event) => {
            if (!isStepPhase(phase)) return;
            setDragging(true);
            setByPointerEvent(event);
          }}
          onPointerMove={(event) => {
            if (!isStepPhase(phase) || !dragging) return;
            setByPointerEvent(event);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          style={{
            aspectRatio: `${Math.max(1, activeImage.width)} / ${Math.max(1, activeImage.height)}`,
          }}
        >
          <svg
            className={styles.overlay}
            viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <image href={activeImage.dataUrl} x="0" y="0" width={imageWidth} height={imageHeight} />

            {isStepPhase(phase) && activePoint ? (
              <circle
                cx={activePoint.x * imageWidth}
                cy={activePoint.y * imageHeight}
                r={pointRadius * 1.5}
                className={styles.pointActive}
              />
            ) : null}

            {!isStepPhase(phase)
              ? pointsForCurrentView.map((point) => (
                  <circle
                    key={point.id}
                    cx={point.x * imageWidth}
                    cy={point.y * imageHeight}
                    r={pointRadius}
                    className={point.confirmed ? styles.pointConfirmed : styles.pointPending}
                  />
                ))
              : null}
          </svg>
        </div>

        <div className={styles.stageFooter}>
          {isStepPhase(phase) && activePoint ? (
            <>
              <div className={styles.stageMeta}>
                <span className={styles.badge}>{activePoint.view.toUpperCase()}</span>
                <span>{activePoint.name}</span>
                <span className={styles.muted}>Auto confidence: {Math.round(activePoint.confidence * 100)}%</span>
              </div>
              {hasLowConfidenceWarning(activePoint) ? (
                <div className={styles.warning}>Low confidence. Verify and adjust if needed.</div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.stageMeta}>
                <span className={styles.badge}>{phase.startsWith("front") ? "FRONT" : "SIDE"}</span>
                <span>{summaryTitle}</span>
              </div>
              <div className={styles.noteText}>{summarySubtitle}</div>
              {phase === "side_summary" && (!sideIndices.length || !sideReadyForCalibration) ? (
                <div className={styles.warning}>
                  Side landmarks are unavailable/low-confidence. Side metrics may remain insufficient.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <aside className={styles.sidebar}>
        <div className={styles.progressCard}>
          <div className={styles.progressHead}>
            <span>{stepCounterText}</span>
            <span>{Math.round(progressRatio * 100)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${Math.round(progressRatio * 100)}%` }} />
          </div>

          {isStepPhase(phase) && activePoint ? (
            <>
              <h3 className={styles.pointTitle}>{activePoint.name}</h3>
              <div className={styles.pointSubtitle}>{activeDefinition?.subtitle ?? ""}</div>
            </>
          ) : (
            <>
              <h3 className={styles.pointTitle}>{summaryTitle}</h3>
              <div className={styles.pointSubtitle}>{summarySubtitle}</div>
            </>
          )}
        </div>

        {isStepPhase(phase) && activePoint ? (
          <div className={styles.tabCard}>
            <div className={styles.tabHeader}>
              <button
                type="button"
                className={`${styles.tabButton} ${activeTab === "photo" ? styles.tabButtonActive : ""}`}
                onClick={() => setActiveTab("photo")}
              >
                Photo
              </button>
              <button
                type="button"
                className={`${styles.tabButton} ${activeTab === "howto" ? styles.tabButtonActive : ""}`}
                onClick={() => setActiveTab("howto")}
              >
                How to Find
              </button>
            </div>

            {activeTab === "photo" ? (
              <>
                <div className={styles.referencePreviewStatic}>
                  {referenceSrc ? (
                    <img
                      key={`${activePoint.id}:${referenceSrc}`}
                      src={referenceSrc}
                      alt={`Reference for ${activePoint.name}`}
                      className={styles.referenceImg}
                      data-fallback-index="1"
                      onError={(event) => {
                        const target = event.currentTarget as HTMLImageElement;
                        const nextIndex = Number(target.dataset.fallbackIndex || "1");
                        if (nextIndex >= referenceSources.length) {
                          const missing =
                            referenceSources[referenceSources.length - 1] ?? target.src;
                          if (process.env.NODE_ENV !== "production") {
                            setReferenceError({ key: referenceKey, missing });
                          }
                          return;
                        }
                        target.dataset.fallbackIndex = String(nextIndex + 1);
                        target.src = referenceSources[nextIndex] ?? "";
                      }}
                    />
                  ) : (
                    <div className={styles.muted}>No static reference found for this point.</div>
                  )}
                </div>
                {referenceError?.key === referenceKey &&
                process.env.NODE_ENV !== "production" ? (
                  <div className={styles.error}>
                    Missing reference asset: {referenceError.missing}
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.howToWrap}>
                <p>{activeDefinition?.howToFind ?? "Use the most central visible anatomical point."}</p>
                <div className={styles.reasonList}>
                  {activePoint.reasonCodes.length ? (
                    activePoint.reasonCodes.map((reason) => (
                      <span key={reason} className={styles.reasonChip}>
                        {reason}
                      </span>
                    ))
                  ) : (
                    <span className={styles.reasonChip}>no-flags</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className={styles.shortcutCard}>
          <div className={styles.shortcutTitle}>Controls</div>
          <div className={styles.shortcutRow}>
            <code>Drag / Arrows</code>
            <span>Move point</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>Enter</code>
            <span>Next (accept current)</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>Backspace</code>
            <span>Previous</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>R</code>
            <span>Reset current point</span>
          </div>
        </div>

        {isStepPhase(phase) ? (
          <div className={styles.zoomCard}>
            <div className={styles.shortcutTitle}>Zoom</div>
            <div className={styles.zoomButtons}>
              {[1, 2, 4].map((zoom) => (
                <button
                  key={zoom}
                  type="button"
                  className={`${styles.zoomButton} ${zoomLevel === zoom ? styles.zoomButtonActive : ""}`}
                  onClick={() => setZoomLevel(zoom as 1 | 2 | 4)}
                >
                  {zoom}x
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.actions}>
          {isStepPhase(phase) ? (
            <>
              <div className={styles.actionRow}>
                <Button variant="ghost" className={styles.secondaryAction} onClick={goBack}>
                  Back
                </Button>
                <Button className={styles.primaryAction} onClick={acceptCurrentAndAdvance}>
                  Next
                </Button>
              </div>
              <div className={styles.actionRow}>
                <Button
                  variant="ghost"
                  className={styles.secondaryAction}
                  onClick={goPreviousPoint}
                  disabled={!canGoPreviousPoint}
                >
                  Previous Point
                </Button>
                <Button variant="ghost" className={styles.secondaryAction} onClick={resetCurrent}>
                  Reset Point
                </Button>
              </div>
            </>
          ) : null}

          {phase === "front_summary" ? (
            <div className={styles.actionRow}>
              <Button variant="ghost" className={styles.secondaryAction} onClick={goBack}>
                Back
              </Button>
              <Button className={styles.primaryAction} onClick={openSidePhase}>
                Continue to Side/Profile
              </Button>
            </div>
          ) : null}

          {phase === "side_summary" ? (
            <div className={styles.actionRow}>
              <Button variant="ghost" className={styles.secondaryAction} onClick={goBack}>
                Back
              </Button>
              <Button className={styles.primaryAction} onClick={finishCalibration}>
                Continue to Analysis
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
