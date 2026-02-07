"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const hasLowConfidenceWarning = (point: ManualLandmarkPoint) => {
  if (point.confidence < 0.58) return true;
  return point.reasonCodes.some((reason) =>
    ["manual_recommended", "hair_occlusion", "occlusion", "edge_point"].includes(reason)
  );
};

const toLocalIndices = (
  points: ManualLandmarkPoint[],
  view: LandmarkCalibrationView
): number[] =>
  points.reduce<number[]>((acc, point, index) => {
    if (point.view === view) acc.push(index);
    return acc;
  }, []);

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
  const [points, setPoints] = useState<ManualLandmarkPoint[]>([]);
  const [activeTab, setActiveTab] = useState<"photo" | "diagram" | "howto">("photo");
  const [activeView, setActiveView] = useState<LandmarkCalibrationView>("front");
  const [frontCursor, setFrontCursor] = useState(0);
  const [sideCursor, setSideCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<1 | 2 | 4>(1);
  const [dragging, setDragging] = useState(false);
  const [referenceFallbackRemote, setReferenceFallbackRemote] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const initialMapRef = useRef<Map<string, ManualLandmarkPoint>>(new Map());

  useEffect(() => {
    const seeded =
      initialPoints && initialPoints.length
        ? initialPoints
        : initManualLandmarks({
            frontLandmarks,
            sideLandmarks,
            frontQuality,
            sideQuality,
          });

    setPoints(seeded);
    setActiveTab("photo");
    setActiveView("front");
    setFrontCursor(0);
    setSideCursor(0);
    setError(null);
    setReferenceFallbackRemote(false);
    initialMapRef.current = new Map(seeded.map((point) => [point.id, { ...point }]));
  }, [
    initialPoints,
    frontLandmarks,
    sideLandmarks,
    frontQuality,
    sideQuality,
  ]);

  const frontIndices = useMemo(() => toLocalIndices(points, "front"), [points]);
  const sideIndices = useMemo(() => toLocalIndices(points, "side"), [points]);

  const sideReadyForCalibration = useMemo(
    () => sideQuality.landmarkCount > 0 && sideQuality.viewWeight > 0.1,
    [sideQuality]
  );

  const activeIndices = activeView === "front" ? frontIndices : sideIndices;
  const currentCursor = activeView === "front" ? frontCursor : sideCursor;
  const activeGlobalIndex = activeIndices[currentCursor] ?? activeIndices[0] ?? -1;
  const activePoint = activeGlobalIndex >= 0 ? points[activeGlobalIndex] : null;

  const activeImage =
    activePoint?.view === "side"
      ? sideImage
      : activePoint?.view === "front"
        ? frontImage
        : null;

  const activeDefinition = useMemo(() => {
    if (!activePoint) return null;
    return LANDMARK_REGISTRY_BY_ID.get(activePoint.id) ?? null;
  }, [activePoint]);

  const pointsForView = useMemo(() => {
    if (!activePoint) return [];
    return points.filter((point) => point.view === activePoint.view);
  }, [points, activePoint]);

  const completionFront = useMemo(() => countManualCompletion(points, "front"), [points]);
  const completionSide = useMemo(() => countManualCompletion(points, "side"), [points]);
  const completionAll = useMemo(() => countManualCompletion(points), [points]);

  const canFinish = completionFront.ready && (sideReadyForCalibration ? completionSide.ready : true);

  const updateActivePoint = (patch: Partial<ManualLandmarkPoint>) => {
    if (!activePoint) return;
    setPoints((prev) =>
      prev.map((point, index) =>
        index === activeGlobalIndex
          ? {
              ...point,
              ...patch,
            }
          : point
      )
    );
  };

  const movePointTo = (x: number, y: number) => {
    if (!activePoint) return;
    updateActivePoint({
      x: clamp01(x),
      y: clamp01(y),
      source: "manual",
      confidence: Math.max(activePoint.confidence, 0.93),
      reasonCodes: Array.from(new Set([...activePoint.reasonCodes, "manual_adjusted"])),
      confirmed: false,
    });
  };

  const moveByPixels = (dxPx: number, dyPx: number) => {
    if (!activePoint || !activeImage) return;
    movePointTo(
      activePoint.x + dxPx / Math.max(1, activeImage.width),
      activePoint.y + dyPx / Math.max(1, activeImage.height)
    );
  };

  const setByPointerEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = stageRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    movePointTo(x, y);
  };

  const jumpRelative = (delta: number) => {
    if (!activeIndices.length) return;
    if (activeView === "front") {
      setFrontCursor((index) => Math.max(0, Math.min(activeIndices.length - 1, index + delta)));
    } else {
      setSideCursor((index) => Math.max(0, Math.min(activeIndices.length - 1, index + delta)));
    }
    setError(null);
    setReferenceFallbackRemote(false);
  };

  const confirmCurrent = () => {
    if (!activePoint) return;
    updateActivePoint({
      confirmed: true,
      source: activePoint.source === "manual" ? "manual" : "auto_confirmed",
    });
    setError(null);
  };

  const confirmAndAdvance = () => {
    confirmCurrent();
    jumpRelative(1);
  };

  const resetCurrentPoint = () => {
    if (!activePoint) return;
    const initial = initialMapRef.current.get(activePoint.id);
    if (!initial) return;
    setPoints((prev) =>
      prev.map((point, index) => (index === activeGlobalIndex ? { ...initial } : point))
    );
    setReferenceFallbackRemote(false);
    setError(null);
  };

  const finishCalibration = () => {
    if (!canFinish) {
      setError("Confirm all required calibration points before continuing.");
      return;
    }
    onComplete({ manualPoints: points });
  };

  useEffect(() => {
    if (!activePoint) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }

      if (event.key === "Enter") {
        event.preventDefault();
        confirmAndAdvance();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        jumpRelative(-1);
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetCurrentPoint();
        return;
      }

      const pixelStep = event.shiftKey ? 4 : 1;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveByPixels(0, -pixelStep);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveByPixels(0, pixelStep);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveByPixels(-pixelStep, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveByPixels(pixelStep, 0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePoint, activeImage, points, activeGlobalIndex, activeView]);

  if (!activePoint || !activeImage) {
    return <div className={styles.empty}>Preparing landmark calibration...</div>;
  }

  const stepText = `${currentCursor + 1} of ${activeIndices.length}`;
  const confidencePercent = Math.round(activePoint.confidence * 100);
  const lowConfidenceWarning = hasLowConfidenceWarning(activePoint);

  const referenceSources = activeDefinition
    ? getReferenceSources(activeDefinition, {
        gender: profile.gender,
        ethnicity: profile.ethnicity,
      })
    : null;

  const referenceSrc =
    referenceSources == null
      ? ""
      : referenceFallbackRemote
        ? referenceSources.remote
        : referenceSources.local;

  return (
    <div className={styles.layout}>
      <div className={styles.stageWrap}>
        <div className={styles.modeRow}>
          <button
            type="button"
            className={`${styles.modeButton} ${activeView === "front" ? styles.modeButtonActive : ""}`}
            onClick={() => {
              setActiveView("front");
              setReferenceFallbackRemote(false);
            }}
          >
            Front Calibration ({completionFront.totalConfirmed}/{completionFront.total})
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${activeView === "side" ? styles.modeButtonActive : ""}`}
            onClick={() => {
              setActiveView("side");
              setReferenceFallbackRemote(false);
            }}
            disabled={!sideIndices.length}
          >
            Side Calibration ({completionSide.totalConfirmed}/{completionSide.total})
          </button>
        </div>

        {!sideReadyForCalibration && activeView === "side" ? (
          <div className={styles.warning}>
            Side photo is not suitable for profile metrics. Side calibration is optional and
            side metrics may remain insufficient.
          </div>
        ) : null}

        <div
          className={styles.stage}
          ref={stageRef}
          onPointerDown={(event) => {
            setDragging(true);
            setByPointerEvent(event);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            setByPointerEvent(event);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          style={{
            aspectRatio: `${Math.max(1, activeImage.width)} / ${Math.max(1, activeImage.height)}`,
          }}
        >
          <img src={activeImage.dataUrl} alt={`${activePoint.view} calibration`} />
          <svg className={styles.overlay} viewBox="0 0 1 1" preserveAspectRatio="none">
            {pointsForView.map((point) => (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r={point.id === activePoint.id ? 0.007 : 0.0045}
                className={
                  point.id === activePoint.id
                    ? styles.pointActive
                    : point.confirmed
                      ? styles.pointConfirmed
                      : styles.pointPending
                }
              />
            ))}
            <line
              x1={activePoint.x - 0.02}
              y1={activePoint.y}
              x2={activePoint.x + 0.02}
              y2={activePoint.y}
              className={styles.crosshair}
            />
            <line
              x1={activePoint.x}
              y1={activePoint.y - 0.02}
              x2={activePoint.x}
              y2={activePoint.y + 0.02}
              className={styles.crosshair}
            />
          </svg>
        </div>

        <div className={styles.stageFooter}>
          <div className={styles.stageMeta}>
            <span className={styles.badge}>{activePoint.view.toUpperCase()}</span>
            <span>{activePoint.name}</span>
            <span className={styles.muted}>Auto confidence: {confidencePercent}%</span>
          </div>
          {lowConfidenceWarning ? (
            <div className={styles.warning}>Low confidence. Please verify and adjust if needed.</div>
          ) : null}
        </div>
      </div>

      <aside className={styles.sidebar}>
        <div className={styles.progressCard}>
          <div className={styles.progressHead}>
            <span>{stepText}</span>
            <span>{Math.round((completionAll.totalConfirmed / Math.max(1, completionAll.total)) * 100)}%</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.round((completionAll.totalConfirmed / Math.max(1, completionAll.total)) * 100)}%`,
              }}
            />
          </div>

          <h3 className={styles.pointTitle}>{activePoint.name}</h3>
          <div className={styles.pointSubtitle}>{activeDefinition?.subtitle ?? ""}</div>
        </div>

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
              className={`${styles.tabButton} ${activeTab === "diagram" ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab("diagram")}
            >
              Diagram
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
                  onError={() => {
                    if (!referenceFallbackRemote) {
                      setReferenceFallbackRemote(true);
                    }
                  }}
                />
              ) : (
                <div className={styles.muted}>No reference image available.</div>
              )}
            </div>
          ) : null}

          {activeTab === "diagram" ? (
            <div className={styles.diagramWrap}>
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className={styles.diagramSvg}>
                {pointsForView.map((point) => (
                  <circle
                    key={`diagram-${point.id}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.id === activePoint.id ? 0.02 : 0.012}
                    className={
                      point.id === activePoint.id ? styles.diagramActive : styles.diagramPoint
                    }
                  />
                ))}
              </svg>
              <div className={styles.muted}>Static guide. Active landmark highlighted in red.</div>
            </div>
          ) : null}

          {activeTab === "howto" ? (
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
          ) : null}
        </div>

        <div className={styles.shortcutCard}>
          <div className={styles.shortcutTitle}>Keyboard shortcuts</div>
          <div className={styles.shortcutRow}>
            <code>↑ ↓ ← →</code>
            <span>Move point</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>Enter</code>
            <span>Confirm / Next</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>Backspace</code>
            <span>Previous</span>
          </div>
          <div className={styles.shortcutRow}>
            <code>R</code>
            <span>Reset current</span>
          </div>
        </div>

        <div className={styles.zoomCard}>
          <div className={styles.shortcutTitle}>Zoom level</div>
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

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button variant="ghost" onClick={() => jumpRelative(-1)}>
            Previous
          </Button>
          <Button onClick={confirmCurrent}>Confirm</Button>
          <Button onClick={confirmAndAdvance}>Next</Button>
          <Button variant="ghost" onClick={resetCurrentPoint}>
            Reset
          </Button>
          <Button onClick={finishCalibration} disabled={!canFinish}>
            Continue to Analysis
          </Button>
        </div>
      </aside>
    </div>
  );
}
