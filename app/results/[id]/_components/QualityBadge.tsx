"use client";

import styles from "../results.module.css";

export default function QualityBadge({
  frontCount,
  sideCount,
  quality,
}: {
  frontCount: number;
  sideCount: number;
  quality: "ok" | "low";
}) {
  const label = quality === "ok" ? "OK" : "LOW";
  return (
    <div
      className={`${styles.qualityBadge} ${
        quality === "ok" ? styles.qualityOk : styles.qualityLow
      }`}
    >
      Computed from landmarks: front={frontCount}, side={sideCount}, quality={label}
    </div>
  );
}
