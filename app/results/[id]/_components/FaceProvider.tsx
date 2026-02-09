"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchJson } from "@/lib/api";
import { saveSnapshotFromFace } from "@/lib/analysisHistory";
import type { FaceRecord } from "@/lib/types";

export type ImageSize = {
  natural: { w: number; h: number };
  client: { w: number; h: number };
};

export type ImageSizes = {
  front: ImageSize;
  side: ImageSize;
};

export type Diagnostics = {
  landmarksSource: "front" | "side" | "none";
  frontLandmarksCount: number;
  sideLandmarksCount: number;
  mediapipeLandmarksCount: number;
  landmarksCount: number;
  overlayLandmarksCount: number;
  hasLandmarks: boolean;
  isNormalized: boolean;
  xRange: { min: number | null; max: number | null };
  yRange: { min: number | null; max: number | null };
  front: ImageSize;
  side: ImageSize;
  sideTooSmall: boolean;
  frontQuality: FaceRecord["frontQuality"] | null;
  sideQuality: FaceRecord["sideQuality"] | null;
};

type FaceContextValue = {
  face: FaceRecord | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  imageSizes: ImageSizes;
  setImageSize: (kind: "front" | "side", size: ImageSize) => void;
  diagnostics: Diagnostics;
};

const emptyImageSize: ImageSize = {
  natural: { w: 0, h: 0 },
  client: { w: 0, h: 0 },
};

const FaceContext = createContext<FaceContextValue | null>(null);

const buildDiagnostics = (face: FaceRecord | null, imageSizes: ImageSizes): Diagnostics => {
  const frontOverlayLandmarks = face?.mediapipeLandmarks ?? face?.frontLandmarks ?? [];
  const sideOverlayLandmarks = face?.sideLandmarks ?? [];
  const diagnosticsLandmarks = frontOverlayLandmarks.length
    ? frontOverlayLandmarks
    : sideOverlayLandmarks;
  const landmarksSource = frontOverlayLandmarks.length
    ? "front"
    : sideOverlayLandmarks.length
      ? "side"
      : "none";

  const frontLandmarksCount = face?.frontLandmarks?.length ?? 0;
  const sideLandmarksCount = face?.sideLandmarks?.length ?? 0;
  const mediapipeLandmarksCount = face?.mediapipeLandmarks?.length ?? 0;
  const landmarksCount = diagnosticsLandmarks.length;
  const overlayLandmarksCount =
    frontOverlayLandmarks.length + sideOverlayLandmarks.length;
  const hasLandmarks = landmarksCount > 0;

  const finiteXs = diagnosticsLandmarks.map((pt) => pt.x).filter(Number.isFinite);
  const finiteYs = diagnosticsLandmarks.map((pt) => pt.y).filter(Number.isFinite);
  const xRange = {
    min: finiteXs.length ? Math.min(...finiteXs) : null,
    max: finiteXs.length ? Math.max(...finiteXs) : null,
  };
  const yRange = {
    min: finiteYs.length ? Math.min(...finiteYs) : null,
    max: finiteYs.length ? Math.max(...finiteYs) : null,
  };
  const isNormalized = xRange.max != null ? xRange.max <= 2 : false;

  const sideTooSmall =
    imageSizes.side.natural.w > 0 && imageSizes.side.natural.h > 0
      ? imageSizes.side.natural.w < 420 || imageSizes.side.natural.h < 420
      : false;

  return {
    landmarksSource,
    frontLandmarksCount,
    sideLandmarksCount,
    mediapipeLandmarksCount,
    landmarksCount,
    overlayLandmarksCount,
    hasLandmarks,
    xRange,
    yRange,
    isNormalized,
    front: imageSizes.front,
    side: imageSizes.side,
    sideTooSmall,
    frontQuality: face?.frontQuality ?? null,
    sideQuality: face?.sideQuality ?? null,
  };
};

export function FaceProvider({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [face, setFace] = useState<FaceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageSizes, setImageSizes] = useState<ImageSizes>({
    front: emptyImageSize,
    side: emptyImageSize,
  });

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    fetchJson<{ success: boolean; face: FaceRecord }>(`/api/faces/${id}`)
      .then((res) => {
        if (!active) return;
        setFace(res.face);
        try {
          saveSnapshotFromFace(res.face);
        } catch {
          // Ignore snapshot persistence failures (quota, private mode, etc).
        }
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load this analysis.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cleanup = refresh();
    return () => {
      if (cleanup) cleanup();
    };
  }, [refresh]);

  const setImageSize = useCallback((kind: "front" | "side", size: ImageSize) => {
    setImageSizes((prev) => {
      if (
        prev[kind].natural.w === size.natural.w &&
        prev[kind].natural.h === size.natural.h &&
        prev[kind].client.w === size.client.w &&
        prev[kind].client.h === size.client.h
      ) {
        return prev;
      }
      return { ...prev, [kind]: size } as ImageSizes;
    });
  }, []);

  const diagnostics = useMemo(() => buildDiagnostics(face, imageSizes), [face, imageSizes]);

  return (
    <FaceContext.Provider
      value={{
        face,
        loading,
        error,
        refresh,
        imageSizes,
        setImageSize,
        diagnostics,
      }}
    >
      {children}
    </FaceContext.Provider>
  );
}

export const useFace = () => {
  const ctx = useContext(FaceContext);
  if (!ctx) {
    throw new Error("useFace must be used within FaceProvider");
  }
  return ctx;
};
