"use client";

import type { Assessment } from "@/lib/types";
import styles from "../results.module.css";

export default function ProsConsPanel({
  strengths,
  weaknesses,
}: {
  strengths: Assessment[];
  weaknesses: Assessment[];
}) {
  const renderScore = (item: Assessment) =>
    item.insufficient ? "insufficient" : (item.score / 10).toFixed(1);

  return (
    <div className={styles.prosConsGrid}>
      <div className={styles.prosConsCard}>
        <div className={styles.prosConsTitle}>Strengths</div>
        <div className={styles.prosConsSubtitle}>
          Highest scoring signals detected.
        </div>
        <div className={styles.prosConsList}>
          {strengths.map((item) => (
            <div key={item.title} className={styles.prosConsItem}>
              <div>
                <div className={styles.prosConsItemTitle}>{item.title}</div>
                <div className={styles.prosConsItemNote}>{item.note ?? ""}</div>
              </div>
              <div className={styles.prosConsScore}>{renderScore(item)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.prosConsCard}>
        <div className={styles.prosConsTitle}>Weaknesses</div>
        <div className={styles.prosConsSubtitle}>
          Lowest scoring signals to focus on.
        </div>
        <div className={styles.prosConsList}>
          {weaknesses.map((item) => (
            <div key={item.title} className={styles.prosConsItem}>
              <div>
                <div className={styles.prosConsItemTitle}>{item.title}</div>
                <div className={styles.prosConsItemNote}>{item.note ?? ""}</div>
              </div>
              <div className={`${styles.prosConsScore} ${styles.prosConsScoreWeak}`}>
                {renderScore(item)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
