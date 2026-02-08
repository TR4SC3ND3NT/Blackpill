"use client";

import { useMemo } from "react";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const formatInt = (value?: number) =>
  value == null || !Number.isFinite(value) ? "--" : Math.round(value).toString();

export default function FaceIQHarmonyChart({
  overall,
  harmony,
  angularity,
  dimorphism,
  features,
  size = 320,
  className,
  title,
  subtitle,
}: {
  overall?: number;
  harmony?: number;
  angularity?: number;
  dimorphism?: number;
  features?: number;
  size?: number;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  const numericOverall = useMemo(() => {
    if (overall != null && Number.isFinite(overall)) return overall;
    const values = [harmony, angularity, dimorphism, features].filter(
      (value): value is number => value != null && Number.isFinite(value)
    );
    if (!values.length) return undefined;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [overall, harmony, angularity, dimorphism, features]);

  const progress = clamp01((numericOverall ?? 0) / 100);

  const vb = 300;
  const center = vb / 2;
  const radius = 120;
  const strokeWidth = 30;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return (
    <div className={className} style={{ display: "grid", gap: 12, placeItems: "center" }}>
      {title || subtitle ? (
        <div style={{ width: "100%", display: "grid", gap: 4, textAlign: "left" }}>
          {title ? (
            <div style={{ fontWeight: 700, color: "rgba(15, 23, 42, 0.88)" }}>{title}</div>
          ) : null}
          {subtitle ? (
            <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${vb} ${vb}`}
        width={size}
        height={size}
        style={{
          borderRadius: 22,
          background: [
            "radial-gradient(circle at 18% 20%, rgba(255, 107, 53, 0.18), transparent 58%)",
            "radial-gradient(circle at 78% 18%, rgba(255, 183, 3, 0.12), transparent 62%)",
            "rgba(255,255,255,0.62)",
          ].join(", "),
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        <defs>
          <linearGradient id="faceiqOrange" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFB703" />
            <stop offset="60%" stopColor="#FF7A2F" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>
          <filter id="faceiqGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 0.65 0 0 0  0 0 0.3 0 0  0 0 0 0.9 0"
              result="colored"
            />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(15, 23, 42, 0.10)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#faceiqOrange)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
            filter="url(#faceiqGlow)"
          />
        </g>

        <circle cx={center} cy={center} r={96} fill="rgba(255,255,255,0.82)" stroke="rgba(255,255,255,0.88)" />

        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          style={{ fontSize: 66, fontWeight: 900, fill: "#0F172A" }}
        >
          {formatInt(numericOverall)}
        </text>
        <text
          x={center}
          y={center - 24}
          textAnchor="middle"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fill: "rgba(15,23,42,0.62)",
            letterSpacing: "0.18em",
          }}
        >
          OVERALL
        </text>
        <text
          x={center}
          y={center + 44}
          textAnchor="middle"
          style={{ fontSize: 14, fontWeight: 800, fill: "rgba(15,23,42,0.55)" }}
        >
          / 100
        </text>
      </svg>
    </div>
  );
}
