"use client";

import styles from "../results.module.css";
import LockedOverlay from "./LockedOverlay";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function DistributionChart({
  score,
  locked,
}: {
  score?: number;
  locked: boolean;
}) {
  const normalized = score == null ? 50 : clamp(score, 0, 100);
  const markerX = 10 + (normalized / 100) * 80;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <div className={styles.chartTitle}>Population Distribution</div>
          <div className={styles.chartSubtitle}>You are mapped on a bell curve.</div>
        </div>
        <div className={styles.chartMeta}>Estimated percentile</div>
      </div>
      <div className={styles.chartBody}>
        <svg viewBox="0 0 100 40" className={styles.chartSvg}>
          <path
            d="M0 40 C 20 5, 40 5, 50 20 C 60 35, 80 35, 100 40"
            fill="none"
            stroke="rgba(40, 70, 120, 0.35)"
            strokeWidth="2"
          />
          <path
            d="M0 40 C 20 5, 40 5, 50 20 C 60 35, 80 35, 100 40"
            fill="none"
            stroke="rgba(80, 140, 255, 0.45)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={6}
            y2={40}
            stroke="rgba(30, 50, 80, 0.6)"
            strokeWidth="1.5"
          />
          <circle cx={markerX} cy={10} r={3} fill="rgba(30, 50, 80, 0.8)" />
        </svg>
        <div className={styles.chartAxis}>
          <span>Low</span>
          <span>Average</span>
          <span>High</span>
        </div>
      </div>
      {locked ? (
        <LockedOverlay title="Unlock to see where you stand" cta="Unlock score" />
      ) : null}
    </div>
  );
}
