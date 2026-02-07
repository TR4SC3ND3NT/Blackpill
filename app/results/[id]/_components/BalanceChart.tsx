"use client";

import { motion } from "framer-motion";
import styles from "../results.module.css";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

export default function BalanceChart({
  front,
  side,
}: {
  front?: number;
  side?: number;
}) {
  const frontValue = Math.min(100, front ?? 0);
  const sideValue = Math.min(100, side ?? 0);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <div className={styles.chartTitle}>Front vs Side Balance</div>
          <div className={styles.chartSubtitle}>Harmony split across views.</div>
        </div>
        <div className={styles.chartMeta}>Front / Side</div>
      </div>
      <div className={styles.balanceChart}>
        <div className={styles.balanceRow}>
          <span className={styles.balanceLabel}>Front</span>
          <div className={styles.balanceTrack}>
            <motion.div
              className={styles.balanceFill}
              initial={{ width: 0 }}
              animate={{ width: `${frontValue}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className={styles.balanceValue}>{formatScore(front)}</span>
        </div>
        <div className={styles.balanceRow}>
          <span className={styles.balanceLabel}>Side</span>
          <div className={styles.balanceTrack}>
            <motion.div
              className={`${styles.balanceFill} ${styles.balanceFillAlt}`}
              initial={{ width: 0 }}
              animate={{ width: `${sideValue}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
            />
          </div>
          <span className={styles.balanceValue}>{formatScore(side)}</span>
        </div>
      </div>
    </div>
  );
}
