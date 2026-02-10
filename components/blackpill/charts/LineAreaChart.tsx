"use client";

import { cn } from "@/lib/cn";
import { useId, useMemo, useRef, useState } from "react";

export type LineAreaPoint = {
  t: string;
  value: number;
};

export type LineAreaBand = {
  from: number;
  to: number;
  color: string;
  opacity?: number;
  label?: string;
};

export type LineAreaChartProps = {
  points: LineAreaPoint[];
  height?: number;
  domain?: [number, number];
  className?: string;
  curve?: "linear" | "smooth";
  showAxes?: boolean;
  showTooltip?: boolean;
  valueLabel?: string;
  bands?: LineAreaBand[];
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const formatShortDate = (iso: string) => {
  try {
    // Explicit timezone for stable hydration output.
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export function LineAreaChart({
  points,
  height = 256,
  domain = [0, 100],
  className,
  curve = "smooth",
  showAxes = true,
  showTooltip = true,
  valueLabel = "Overall",
  bands,
}: LineAreaChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fillId = useId();
  const [hovered, setHovered] = useState<{ idx: number; xPx: number; yPx: number } | null>(
    null,
  );

  const model = useMemo(() => {
    const n = points.length;
    if (!n) return null;

    const w = 720;
    const h = 260;
    const padLeft = showAxes ? 52 : 18;
    const padRight = 16;
    const padTop = 18;
    const padBottom = showAxes ? 40 : 18;
    const innerW = w - padLeft - padRight;
    const innerH = h - padTop - padBottom;

    const [minV, maxV] = domain;
    const span = Math.max(1e-6, maxV - minV);

    const toY = (value: number) => {
      const pct = clamp((value - minV) / span, 0, 1);
      return padTop + innerH - pct * innerH;
    };

    const xs = new Array<number>(n);
    const ys = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const x = padLeft + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      xs[i] = x;
      ys[i] = toY(points[i]?.value ?? minV);
    }

    const mkSmoothD = () => {
      if (n === 1) return `M ${padLeft} ${ys[0]} L ${padLeft + innerW} ${ys[0]}`;
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
      if (n === 1) return `M ${padLeft} ${ys[0]} L ${padLeft + innerW} ${ys[0]}`;
      return xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
    };

    const lineD = curve === "linear" ? mkLinearD() : mkSmoothD();

    const areaD = `${lineD} L ${padLeft + innerW} ${padTop + innerH} L ${padLeft} ${padTop + innerH} Z`;

    const ticks = 5;
    const yTicks = new Array<number>(ticks).fill(0).map((_, i) => {
      const pct = i / (ticks - 1);
      return minV + (maxV - minV) * pct;
    });

    return {
      w,
      h,
      padLeft,
      padRight,
      padTop,
      padBottom,
      innerW,
      innerH,
      xs,
      ys,
      lineD,
      areaD,
      count: n,
      toY,
      yTicks,
    };
  }, [curve, domain, points, showAxes]);

  const onMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!showTooltip) return;
    if (!model) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xRel = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const idx = clamp(Math.round(xRel * Math.max(0, model.count - 1)), 0, model.count - 1);

    const x = model.xs[idx] ?? model.padLeft;
    const y = model.ys[idx] ?? model.padTop;
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
        "relative overflow-hidden rounded-2xl border border-white/45 bg-white/40 supports-[backdrop-filter]:backdrop-blur-sm",
        className,
      )}
      style={{ height }}
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
                  <stop offset="0%" stopColor="rgba(15, 23, 42, 0.18)" />
                  <stop offset="100%" stopColor="rgba(15, 23, 42, 0.02)" />
                </linearGradient>
              </defs>

              <g>
                <circle
                  cx={model.padLeft}
                  cy={12}
                  r={4}
                  fill="rgba(15, 23, 42, 0.66)"
                />
                <text
                  x={model.padLeft + 10}
                  y={15}
                  fontSize="11"
                  fill="rgba(15, 23, 42, 0.62)"
                >
                  {valueLabel}
                </text>
              </g>

              {bands?.length
                ? bands.map((band, i) => {
                    const y1 = model.toY(band.to);
                    const y2 = model.toY(band.from);
                    const y = Math.min(y1, y2);
                    const h = Math.abs(y2 - y1);
                    return (
                      <rect
                        key={`${band.from}:${band.to}:${i}`}
                        x={model.padLeft}
                        y={y}
                        width={model.innerW}
                        height={h}
                        fill={band.color}
                        fillOpacity={band.opacity ?? 1}
                      />
                    );
                  })
                : null}

              {showAxes ? (
                <>
                  {model.yTicks.map((t) => {
                    const y = model.toY(t);
                    return (
                      <line
                        key={t}
                        x1={model.padLeft}
                        x2={model.padLeft + model.innerW}
                        y1={y}
                        y2={y}
                        stroke="rgba(15, 23, 42, 0.08)"
                        strokeWidth="1"
                      />
                    );
                  })}
                  {[0, 1, 2, 3, 4].map((i) => {
                    const x =
                      model.padLeft + (i / 4) * model.innerW;
                    return (
                      <line
                        key={i}
                        x1={x}
                        x2={x}
                        y1={model.padTop}
                        y2={model.padTop + model.innerH}
                        stroke="rgba(15, 23, 42, 0.06)"
                        strokeWidth="1"
                      />
                    );
                  })}
                </>
              ) : null}

              <path d={model.areaD} fill={`url(#${fillId})`} />
              <path
                d={model.lineD}
                fill="none"
                stroke="rgba(15, 23, 42, 0.64)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {hoveredX != null && hoveredY != null ? (
                <>
                  <line
                    x1={hoveredX}
                    x2={hoveredX}
                    y1={model.padTop}
                    y2={model.padTop + model.innerH}
                    stroke="rgba(15, 23, 42, 0.14)"
                    strokeWidth="2"
                  />
                  <circle
                    cx={hoveredX}
                    cy={hoveredY}
                    r="5"
                    fill="white"
                    stroke="rgba(15, 23, 42, 0.7)"
                    strokeWidth="2"
                  />
                </>
              ) : null}

              {showAxes ? (
                <>
                  {model.yTicks.map((t) => {
                    const y = model.toY(t);
                    return (
                      <text
                        key={`t:${t}`}
                        x={model.padLeft - 10}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="rgba(15, 23, 42, 0.42)"
                      >
                        {Math.round(t)}
                      </text>
                    );
                  })}
                  <text
                    x={model.padLeft}
                    y={model.padTop + model.innerH + 26}
                    textAnchor="start"
                    fontSize="10"
                    fill="rgba(15, 23, 42, 0.42)"
                  >
                    {startLabel}
                  </text>
                  <text
                    x={model.padLeft + model.innerW}
                    y={model.padTop + model.innerH + 26}
                    textAnchor="end"
                    fontSize="10"
                    fill="rgba(15, 23, 42, 0.42)"
                  >
                    {endLabel}
                  </text>
                </>
              ) : null}
            </svg>
          </div>

          {showTooltip && hovered && hoveredPoint ? (
            <div
              className="absolute pointer-events-none"
              style={{
                left: hovered.xPx,
                top: hovered.yPx,
                transform: "translate(-50%, calc(-100% - 10px))",
              }}
            >
              <div className="bp-glass-panel rounded-xl px-3 py-2">
                <div className="text-[10px] font-medium text-gray-600">
                  {formatShortDate(hoveredPoint.t)}
                </div>
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
