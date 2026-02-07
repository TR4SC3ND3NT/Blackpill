"use client";

import { motion } from "framer-motion";
import styles from "../results.module.css";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

export default function PillarBreakdownChart({
  scores,
}: {
  scores: Array<{ label: string; score?: number }>; 
}) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <div className={styles.chartTitle}>Pillar Breakdown</div>
          <div className={styles.chartSubtitle}>Relative strength across pillars.</div>
        </div>
        <div className={styles.chartMeta}>0–10 scale</div>
      </div>
      <div className={styles.barChart}>
        {scores.map((item) => (
          <div key={item.label} className={styles.barRow}>
            <div className={styles.barLabel}>{item.label}</div>
            <div className={styles.barTrack}>
              <motion.div
                className={styles.barFill}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (item.score ?? 0))}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className={styles.barValue}>{formatScore(item.score)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
