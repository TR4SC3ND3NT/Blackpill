"use client";

import { useMemo, useState } from "react";
import styles from "../results.module.css";
import LockedOverlay from "./LockedOverlay";
import QualityBadge from "./QualityBadge";

const formatScore = (score?: number) =>
  score == null ? "--" : (score / 10).toFixed(1);

export default function OverallScorePanel({
  scores,
  locked,
  quality,
}: {
  scores: {
    overall?: number;
    harmony?: number;
    angularity?: number;
    dimorphism?: number;
    features?: number;
  };
  locked: boolean;
  quality?: { frontCount: number; sideCount: number; quality: "ok" | "low" };
}) {
  const tabs = useMemo(
    () => [
      { key: "harmony", label: "Harmony", value: scores.harmony },
      { key: "angularity", label: "Angularity", value: scores.angularity },
      { key: "dimorphism", label: "Dimorphism", value: scores.dimorphism },
      { key: "features", label: "Features", value: scores.features },
    ],
    [scores]
  );
  const [active, setActive] = useState(tabs[0]?.key ?? "harmony");
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <div className={styles.overallCard}>
      <div className={styles.overallHeader}>
        <span>Overall Score</span>
        <span className={styles.overallMeta}>1 of 4 pillars</span>
      </div>
      <div className={`${styles.overallValue} ${locked ? styles.blur : ""}`}>
        {formatScore(scores.overall)}
        <span className={styles.overallUnit}>/ 10</span>
      </div>
      {quality ? (
        <div className={styles.qualityRow}>
          <QualityBadge
            frontCount={quality.frontCount}
            sideCount={quality.sideCount}
            quality={quality.quality}
          />
        </div>
      ) : null}
      <div className={styles.overallTabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`${styles.overallTab} ${
              active === tab.key ? styles.overallTabActive : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.overallDetail}>
        <div className={styles.overallDetailLabel}>{activeTab?.label}</div>
        <div className={styles.overallDetailScore}>
          {formatScore(activeTab?.value)} / 10
        </div>
      </div>
      <div className={styles.overallSubtext}>
        Based on detected landmarks and proportional analysis. Scores are shown as a
        percentile-style estimate.
      </div>
      {locked ? (
        <LockedOverlay title="Unlock to see where you stand" cta="Unlock score" />
      ) : null}
    </div>
  );
}
