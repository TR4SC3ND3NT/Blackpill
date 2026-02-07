"use client";

import styles from "../results.module.css";
import LockedOverlay from "./LockedOverlay";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

export default function PillarCardsRow({
  scores,
  locked,
}: {
  scores: { label: string; score?: number }[];
  locked: boolean;
}) {
  return (
    <div className={styles.pillarRow}>
      {scores.map((item) => (
        <div key={item.label} className={styles.pillarCard}>
          <div className={styles.pillarHeader}>
            <span>{item.label}</span>
            <span className={styles.pillarArrow}>→</span>
          </div>
          <div className={`${styles.pillarScore} ${locked ? styles.blur : ""}`}>
            {formatScore(item.score)} / 10
          </div>
          <div className={styles.pillarBarTrack}>
            <div
              className={styles.pillarBarFill}
              style={{ width: `${Math.max(6, item.score ?? 0)}%` }}
            />
          </div>
          {locked ? (
            <LockedOverlay title="Unlock your score" cta="Unlock your score" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
