"use client";

import styles from "../results.module.css";

export default function QualityBadge({
  quality,
}: {
  quality: "ok" | "low";
}) {
  const label = quality === "ok" ? "OK" : "LOW";
  return (
    <div
      className={`${styles.qualityBadge} ${
        quality === "ok" ? styles.qualityOk : styles.qualityLow
      }`}
    >
      Quality: {label}
    </div>
  );
}
