"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../results.module.css";
import LockedOverlay from "./LockedOverlay";
import { useFace } from "./FaceProvider";

type DisplayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
};

const parseObjectPosition = (value: string) => {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 1) return [tokens[0], "50%"] as const;
  return [tokens[0], tokens[1]] as const;
};

const resolveOffset = (token: string, freeSpace: number, axis: "x" | "y") => {
  const lower = token.trim().toLowerCase();
  if (lower.endsWith("%")) {
    const percent = parseFloat(lower);
    if (!Number.isFinite(percent)) return freeSpace / 2;
    return freeSpace * (percent / 100);
  }
  if (lower.endsWith("px")) {
    const px = parseFloat(lower);
    return Number.isFinite(px) ? px : 0;
  }
  if (axis === "x") {
    if (lower === "left") return 0;
    if (lower === "right") return freeSpace;
  } else {
    if (lower === "top") return 0;
    if (lower === "bottom") return freeSpace;
  }
  return freeSpace / 2;
};

const getImageDisplayRect = (img: HTMLImageElement): DisplayRect => {
  const clientWidth = img.clientWidth;
  const clientHeight = img.clientHeight;
  const naturalWidth = img.naturalWidth || clientWidth;
  const naturalHeight = img.naturalHeight || clientHeight;

  if (!clientWidth || !clientHeight || !naturalWidth || !naturalHeight) {
    return {
      x: 0,
      y: 0,
      width: clientWidth,
      height: clientHeight,
      scaleX: 1,
      scaleY: 1,
    };
  }

  const style = getComputedStyle(img);
  const objectFit = style.objectFit || "fill";
  const [posXToken, posYToken] = parseObjectPosition(
    style.objectPosition || "50% 50%"
  );

  const containerRatio = clientWidth / clientHeight;
  const imageRatio = naturalWidth / naturalHeight;

  let width = clientWidth;
  let height = clientHeight;

  const applyContain = () => {
    const scale =
      containerRatio > imageRatio
        ? clientHeight / naturalHeight
        : clientWidth / naturalWidth;
    width = naturalWidth * scale;
    height = naturalHeight * scale;
  };

  const applyCover = () => {
    const scale =
      containerRatio > imageRatio
        ? clientWidth / naturalWidth
        : clientHeight / naturalHeight;
    width = naturalWidth * scale;
    height = naturalHeight * scale;
  };

  if (objectFit === "contain") {
    applyContain();
  } else if (objectFit === "cover") {
    applyCover();
  } else if (objectFit === "none") {
    width = naturalWidth;
    height = naturalHeight;
  } else if (objectFit === "scale-down") {
    if (naturalWidth <= clientWidth && naturalHeight <= clientHeight) {
      width = naturalWidth;
      height = naturalHeight;
    } else {
      applyContain();
    }
  }

  const freeX = clientWidth - width;
  const freeY = clientHeight - height;
  const offsetX = resolveOffset(posXToken, freeX, "x");
  const offsetY = resolveOffset(posYToken, freeY, "y");

  return {
    x: offsetX,
    y: offsetY,
    width,
    height,
    scaleX: width / naturalWidth,
    scaleY: height / naturalHeight,
  };
};

const drawLandmarks = (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  landmarks: Array<{ x: number; y: number; visibility?: number }>
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const clientW = Math.round(img.clientWidth);
  const clientH = Math.round(img.clientHeight);
  if (!clientW || !clientH) return;

  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${clientW}px`;
  canvas.style.height = `${clientH}px`;
  canvas.width = Math.max(1, Math.round(clientW * dpr));
  canvas.height = Math.max(1, Math.round(clientH * dpr));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, clientW, clientH);

  const pts = (landmarks ?? []).filter(
    (p) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      (p as { visibility?: number }).visibility == null
        ? true
        : ((p as { visibility?: number }).visibility ?? 1) > 0.2
  );
  if (!pts.length) return;

  const rect = getImageDisplayRect(img);

  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;

  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const looksNormalized = maxX <= 2 && maxY <= 2;

  ctx.fillStyle = "rgba(107, 220, 255, 0.85)";

  for (const p of pts) {
    const nx = looksNormalized ? p.x : p.x / naturalW;
    const ny = looksNormalized ? p.y : p.y / naturalH;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) continue;

    const x = rect.x + nx * rect.width;
    const y = rect.y + ny * rect.height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
};

export default function FaceThumbs({
  frontUrl,
  sideUrl,
  frontLandmarks,
  sideLandmarks,
  frontScore,
  sideScore,
  locked,
}: {
  frontUrl: string;
  sideUrl: string;
  frontLandmarks: Array<{ x: number; y: number; visibility?: number }>;
  sideLandmarks: Array<{ x: number; y: number; visibility?: number }>;
  frontScore?: number;
  sideScore?: number;
  locked: boolean;
}) {
  const { setImageSize } = useFace();
  const frontImageRef = useRef<HTMLImageElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sideImageRef = useRef<HTMLImageElement | null>(null);
  const sideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frontReady, setFrontReady] = useState(false);
  const [sideReady, setSideReady] = useState(false);

  const updateSizes = useCallback(() => {
    const readSize = (img: HTMLImageElement | null) => ({
      natural: {
        w: img?.naturalWidth ?? 0,
        h: img?.naturalHeight ?? 0,
      },
      client: {
        w: img ? Math.round(img.clientWidth) : 0,
        h: img ? Math.round(img.clientHeight) : 0,
      },
    });

    setImageSize("front", readSize(frontImageRef.current));
    setImageSize("side", readSize(sideImageRef.current));
  }, [setImageSize]);

  const redraw = useCallback(() => {
    if (frontReady && frontImageRef.current && frontCanvasRef.current) {
      drawLandmarks(frontCanvasRef.current, frontImageRef.current, frontLandmarks);
    }
    if (sideReady && sideImageRef.current && sideCanvasRef.current) {
      drawLandmarks(sideCanvasRef.current, sideImageRef.current, sideLandmarks);
    }
    updateSizes();
  }, [frontReady, sideReady, frontLandmarks, sideLandmarks, updateSizes]);

  useEffect(() => {
    if (!frontReady && !sideReady) return;
    redraw();
  }, [frontReady, sideReady, redraw]);

  useEffect(() => {
    if (!frontReady && !sideReady) return;
    let frame = 0;
    const handleResize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => redraw());
    };

    window.addEventListener("resize", handleResize);
    const observers: ResizeObserver[] = [];
    if (typeof ResizeObserver !== "undefined") {
      if (frontImageRef.current) {
        const observer = new ResizeObserver(handleResize);
        observer.observe(frontImageRef.current);
        observers.push(observer);
      }
      if (sideImageRef.current) {
        const observer = new ResizeObserver(handleResize);
        observer.observe(sideImageRef.current);
        observers.push(observer);
      }
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observers.forEach((observer) => observer.disconnect());
      if (frame) cancelAnimationFrame(frame);
    };
  }, [frontReady, sideReady, redraw]);

  return (
    <div className={styles.faceThumbs}>
      <div className={styles.faceThumbCard}>
        <div className={styles.faceThumbHeader}>
          <div className={styles.faceThumbLabel}>Front</div>
          <div className={`${styles.faceThumbScore} ${locked ? styles.blur : ""}`}>
            {frontScore == null ? "--" : (frontScore / 10).toFixed(1)} / 10
          </div>
        </div>
        <div className={styles.faceThumbImage}>
          <img
            ref={frontImageRef}
            src={frontUrl}
            alt="Front portrait"
            onLoad={() => setFrontReady(true)}
          />
          <canvas ref={frontCanvasRef} className={styles.faceThumbCanvas} />
        </div>
        {locked ? <LockedOverlay title="Unlock your score" cta="Unlock" /> : null}
      </div>
      <div className={styles.faceThumbCard}>
        <div className={styles.faceThumbHeader}>
          <div className={styles.faceThumbLabel}>Side</div>
          <div className={`${styles.faceThumbScore} ${locked ? styles.blur : ""}`}>
            {sideScore == null ? "--" : (sideScore / 10).toFixed(1)} / 10
          </div>
        </div>
        <div className={styles.faceThumbImage}>
          <img
            ref={sideImageRef}
            src={sideUrl}
            alt="Side portrait"
            onLoad={() => setSideReady(true)}
          />
          <canvas ref={sideCanvasRef} className={styles.faceThumbCanvas} />
        </div>
        {locked ? <LockedOverlay title="Unlock your score" cta="Unlock" /> : null}
      </div>
    </div>
  );
}
