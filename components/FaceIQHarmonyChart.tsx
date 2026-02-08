"use client";

import { useMemo } from "react";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const formatInt = (value?: number) =>
  value == null || !Number.isFinite(value) ? "--" : Math.round(value).toString();

type Ring = {
  key: string;
  label: string;
  value?: number;
  color: string;
};

export default function FaceIQHarmonyChart({
  overall,
  harmony,
  angularity,
  dimorphism,
  features,
  size = 240,
  className,
  title = "Overall percentile",
  subtitle = "FaceIQ-style radial overview.",
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
  const rings = useMemo<Ring[]>(
    () => [
      { key: "harmony", label: "Harmony", value: harmony, color: "#22C55E" },
      { key: "angularity", label: "Angularity", value: angularity, color: "#7C5CFF" },
      { key: "dimorphism", label: "Dimorphism", value: dimorphism, color: "#FF8A4C" },
      { key: "features", label: "Features", value: features, color: "#3B82F6" },
    ],
    [harmony, angularity, dimorphism, features]
  );

  const numericOverall =
    overall ??
    (() => {
      const values = rings
        .map((ring) => ring.value)
        .filter((value): value is number => value != null && Number.isFinite(value));
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    })();

  const viewBox = `0 0 ${size} ${size}`;
  const center = size / 2;

  const baseRadius = Math.floor(size * 0.38);
  const ringGap = Math.max(6, Math.floor(size * 0.03));
  const strokeWidth = Math.max(10, Math.floor(size * 0.06));

  const backgroundStroke = "rgba(15, 23, 42, 0.10)";

  const renderRing = (ring: Ring, index: number) => {
    const value = ring.value;
    if (value == null || !Number.isFinite(value)) return null;
    const pct = clamp01(value / 100);
    const radius = baseRadius - index * ringGap;
    const circumference = 2 * Math.PI * radius;
    const dash = circumference * pct;
    const gap = Math.max(0, circumference - dash);

    return (
      <g key={ring.key} transform={`rotate(-90 ${center} ${center})`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={backgroundStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ring.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </g>
    );
  };

  return (
    <div className={className} style={{ display: "grid", gap: 12, placeItems: "center" }}>
      <div style={{ width: "100%", display: "grid", gap: 4, textAlign: "left" }}>
        <div style={{ fontWeight: 700, color: "rgba(15, 23, 42, 0.88)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(15, 23, 42, 0.55)" }}>{subtitle}</div>
      </div>

      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        style={{
          borderRadius: 22,
          background:
            "radial-gradient(circle at 20% 20%, rgba(124, 92, 255, 0.10), transparent 55%), radial-gradient(circle at 80% 10%, rgba(255, 138, 76, 0.10), transparent 60%), radial-gradient(circle at 70% 80%, rgba(34, 197, 94, 0.10), transparent 55%), rgba(255,255,255,0.55)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        {rings.map(renderRing)}

        <circle
          cx={center}
          cy={center}
          r={Math.max(1, baseRadius - ringGap * 4 - strokeWidth * 0.6)}
          fill="rgba(255,255,255,0.78)"
          stroke="rgba(255,255,255,0.85)"
        />

        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          style={{ fontSize: Math.floor(size * 0.22), fontWeight: 800, fill: "#0F172A" }}
        >
          {formatInt(numericOverall)}
        </text>
        <text
          x={center}
          y={center - 22}
          textAnchor="middle"
          style={{ fontSize: 12, fontWeight: 700, fill: "rgba(15,23,42,0.58)", letterSpacing: "0.08em" }}
        >
          OVERALL
        </text>
        <text
          x={center}
          y={center + 36}
          textAnchor="middle"
          style={{ fontSize: 12, fontWeight: 700, fill: "rgba(15,23,42,0.50)" }}
        >
          / 100
        </text>
      </svg>
    </div>
  );
}

