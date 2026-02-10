"use client";

import { cn } from "@/lib/cn";
import { useId, useMemo, useRef, useState } from "react";

export type LineAreaPoint = {
  t: string;
  value: number;
};

export type LineAreaChartProps = {
  points: LineAreaPoint[];
  height?: number;
  domain?: [number, number];
  className?: string;
  gridSize?: number;
  curve?: "linear" | "smooth";
  showAxes?: boolean;
  showTooltip?: boolean;
  valueLabel?: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const formatShortDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  } catch {
    return iso;
  }
};

export function LineAreaChart({
  points,
  height = 256,
  domain = [0, 100],
  className,
  gridSize = 48,
  curve = "smooth",
  showAxes = true,
  showTooltip = true,
  valueLabel = "Overall",
}: LineAreaChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fillId = useId();
  const [hovered, setHovered] = useState<{ idx: number; xPx: number; yPx: number } | null>(
    null,
  );

  const model = useMemo(() => {
    const n = points.length;
    if (!n) return null;

    const w = 640;
    const h = 220;
    const pad = 16;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const [minV, maxV] = domain;
    const span = Math.max(1e-6, maxV - minV);

    const toY = (value: number) => {
      const pct = clamp((value - minV) / span, 0, 1);
      return pad + innerH - pct * innerH;
    };

    const xs = new Array<number>(n);
    const ys = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const x = pad + (n === 1 ? innerW : (i / (n - 1)) * innerW);
      xs[i] = x;
      ys[i] = toY(points[i]?.value ?? minV);
    }

    const mkSmoothD = () => {
      if (n === 1) return `M ${pad} ${ys[0]} L ${pad + innerW} ${ys[0]}`;
      const parts: string[] = [];
      parts.push(`M ${xs[0]} ${ys[0]}`);

      // Catmull-Rom -> Bezier (uniform) for a smooth curve.
      for (let i = 0; i < n - 1; i += 1) {
        const x0 = xs[i - 1] ?? xs[i];
        const y0 = ys[i - 1] ?? ys[i];
        const x1 = xs[i];
        const y1 = ys[i];
        const x2 = xs[i + 1] ?? xs[i];
        const y2 = ys[i + 1] ?? ys[i];
        const x3 = xs[i + 2] ?? x2;
        const y3 = ys[i + 2] ?? y2;

        const c1x = x1 + (x2 - x0) / 6;
        const c1y = y1 + (y2 - y0) / 6;
        const c2x = x2 - (x3 - x1) / 6;
        const c2y = y2 - (y3 - y1) / 6;

        parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`);
      }
      return parts.join(" ");
    };

    const mkLinearD = () => {
      if (n === 1) return `M ${pad} ${ys[0]} L ${pad + innerW} ${ys[0]}`;
      return xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
    };

    const lineD = curve === "linear" ? mkLinearD() : mkSmoothD();

    const areaD = `${lineD} L ${pad + innerW} ${pad + innerH} L ${pad} ${pad + innerH} Z`;

    return { w, h, pad, innerW, innerH, xs, ys, lineD, areaD, count: n };
  }, [curve, domain, points]);

  const onMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!showTooltip) return;
    if (!model) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xRel = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const idx = clamp(Math.round(xRel * Math.max(0, model.count - 1)), 0, model.count - 1);

    const x = model.xs[idx] ?? model.pad;
    const y = model.ys[idx] ?? model.pad;
    const xPx = (x / model.w) * rect.width;
    const yPx = (y / model.h) * rect.height;

    setHovered({ idx, xPx, yPx });
  };

  const onLeave = () => setHovered(null);

  const hoveredPoint = hovered && points.length ? points[hovered.idx] : null;
  const hoveredX = hovered && model ? model.xs[hovered.idx] : null;
  const hoveredY = hovered && model ? model.ys[hovered.idx] : null;

  const startLabel = points.length ? formatShortDate(points[0]?.t) : "";
  const endLabel = points.length ? formatShortDate(points[points.length - 1]?.t) : "";

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl border border-gray-200/50 bg-gradient-to-b from-gray-50 to-white overflow-hidden",
        className,
      )}
      style={{
        height,
        backgroundImage:
          "linear-gradient(to right, rgba(17, 24, 39, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(17, 24, 39, 0.04) 1px, transparent 1px)",
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      role="img"
      aria-label={`${valueLabel} line chart`}
    >
      {model ? (
        <>
          <div className="absolute inset-0 p-4">
            <svg
              viewBox={`0 0 ${model.w} ${model.h}`}
              className="w-full h-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(17, 24, 39, 0.16)" />
                  <stop offset="100%" stopColor="rgba(17, 24, 39, 0.02)" />
                </linearGradient>
              </defs>

              <path d={model.areaD} fill={`url(#${fillId})`} />
              <path
                d={model.lineD}
                fill="none"
                stroke="rgba(17, 24, 39, 0.6)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {hoveredX != null && hoveredY != null ? (
                <>
                  <line
                    x1={hoveredX}
                    x2={hoveredX}
                    y1={model.pad}
                    y2={model.pad + model.innerH}
                    stroke="rgba(17, 24, 39, 0.12)"
                    strokeWidth="2"
                  />
                  <circle
                    cx={hoveredX}
                    cy={hoveredY}
                    r="5"
                    fill="white"
                    stroke="rgba(17, 24, 39, 0.7)"
                    strokeWidth="2"
                  />
                </>
              ) : null}
            </svg>
          </div>

          {showAxes ? (
            <>
              <div className="absolute left-3 top-3 text-[10px] text-gray-400 tabular-nums">
                {domain[1]}
              </div>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 tabular-nums">
                {Math.round((domain[0] + domain[1]) / 2)}
              </div>
              <div className="absolute left-3 bottom-3 text-[10px] text-gray-400 tabular-nums">
                {domain[0]}
              </div>
              <div className="absolute left-10 right-3 bottom-3 flex items-center justify-between text-[10px] text-gray-400">
                <span>{startLabel}</span>
                <span>{endLabel}</span>
              </div>
            </>
          ) : null}

          {showTooltip && hovered && hoveredPoint ? (
            <div
              className="absolute pointer-events-none"
              style={{
                left: hovered.xPx,
                top: hovered.yPx,
                transform: "translate(-50%, calc(-100% - 10px))",
              }}
            >
              <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm">
                <div className="text-[10px] font-medium text-gray-500">{formatShortDate(hoveredPoint.t)}</div>
                <div className="mt-0.5 text-xs font-semibold text-gray-900 tabular-nums">
                  {valueLabel}: {Math.round(hoveredPoint.value)}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs text-gray-500">No data</div>
        </div>
      )}
    </div>
  );
}
