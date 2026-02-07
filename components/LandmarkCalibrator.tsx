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
  profile: { gender: string; ethnicity: string };
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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
  profile,
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
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 4>(2);
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

    const width = 1 / zoomLevel;
    const height = 1 / zoomLevel;
    const halfW = width / 2;
    const halfH = height / 2;
    const cx = Math.max(halfW, Math.min(1 - halfW, activePoint.x));
    const cy = Math.max(halfH, Math.min(1 - halfH, activePoint.y));

    return {
      x: clamp01(cx - halfW),
      y: clamp01(cy - halfH),
      width,
      height,
    };
  }, [phase, activePoint, zoomLevel]);

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

    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const x = activeViewBox.x + relX * activeViewBox.width;
    const y = activeViewBox.y + relY * activeViewBox.height;

    movePointTo(x, y);
  }, [phase, activeViewBox.x, activeViewBox.y, activeViewBox.width, activeViewBox.height, movePointTo]);

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
      ? getReferenceSources(activeDefinition, {
          gender: profile.gender,
          ethnicity: profile.ethnicity,
        }).sources
      : [];

  const referenceSrc = referenceSources[0] ?? "";

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

  const pointRadius = isStepPhase(phase)
    ? Math.max(0.00042, activeViewBox.width * 0.00145)
    : 0.00095;

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
            viewBox={`${activeViewBox.x} ${activeViewBox.y} ${activeViewBox.width} ${activeViewBox.height}`}
            preserveAspectRatio="none"
          >
            <image href={activeImage.dataUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />

            {isStepPhase(phase) && activePoint ? (
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={pointRadius}
                className={styles.pointActive}
              />
            ) : null}

            {!isStepPhase(phase)
              ? pointsForCurrentView.map((point) => (
                  <circle
                    key={point.id}
                    cx={point.x}
                    cy={point.y}
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
              <div className={styles.referencePreviewStatic}>
                {referenceSrc ? (
                  <img
                    src={referenceSrc}
                    alt={`Reference for ${activePoint.name}`}
                    data-fallback-index="1"
                    onError={(event) => {
                      const target = event.currentTarget as HTMLImageElement;
                      const nextIndex = Number(target.dataset.fallbackIndex || "1");
                      if (nextIndex >= referenceSources.length) return;
                      target.dataset.fallbackIndex = String(nextIndex + 1);
                      target.src = referenceSources[nextIndex] ?? "";
                    }}
                  />
                ) : (
                  <div className={styles.muted}>No static reference found for this point.</div>
                )}
              </div>
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
