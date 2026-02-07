"use client";

import type { Assessment } from "@/lib/types";
import LockedOverlay from "./LockedOverlay";
import styles from "../results.module.css";

const formatScore = (item: Assessment) =>
  item.insufficient ? "insufficient" : item.score == null ? "--" : (item.score / 10).toFixed(1);

export default function AssessmentPanel({
  title,
  subtitle,
  items,
  locked,
}: {
  title: string;
  subtitle?: string;
  items: Assessment[];
  locked: boolean;
}) {
  return (
    <div className={styles.assessmentPanel}>
      <div className={styles.assessmentHeader}>
        <div>
          <div className={styles.assessmentTitle}>{title}</div>
          {subtitle ? (
            <div className={styles.assessmentSubtitle}>{subtitle}</div>
          ) : null}
        </div>
        <div className={styles.assessmentMeta}>{items.length} signals</div>
      </div>
      <div className={`${styles.assessmentGrid} ${locked ? styles.blur : ""}`}>
        {items.length ? (
          items.map((item) => (
            <div key={item.title} className={styles.assessmentCard}>
              <div className={styles.assessmentCardHeader}>
                <div className={styles.assessmentCardTitle}>{item.title}</div>
                <div
                  className={`${styles.assessmentBadge} ${
                    item.severity === "low"
                      ? styles.severityLow
                      : item.severity === "medium"
                        ? styles.severityMedium
                        : styles.severityHigh
                  }`}
                >
                  {item.severity}
                </div>
              </div>
              <div className={styles.assessmentCardScore}>
                {formatScore(item)}
              </div>
              <div className={styles.assessmentCardNote}>
                {item.note ?? "No notes available yet."}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.assessmentEmpty}>No assessment signals yet.</div>
        )}
      </div>
      {locked ? (
        <LockedOverlay title="Unlock for full diagnostics" cta="Unlock details" />
      ) : null}
    </div>
  );
}
