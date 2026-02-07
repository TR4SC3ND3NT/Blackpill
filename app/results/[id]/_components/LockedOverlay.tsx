"use client";

import Button from "@/components/Button";
import styles from "../results.module.css";

export default function LockedOverlay({
  title = "Unlock your score",
  cta = "Unlock",
}: {
  title?: string;
  cta?: string;
}) {
  return (
    <div className={styles.lockedOverlay}>
      <div className={styles.lockedIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <path
            d="M7 11V8.5C7 5.46 9.46 3 12.5 3C15.54 3 18 5.46 18 8.5V11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect
            x="5"
            y="11"
            width="14"
            height="10"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="16" r="1.4" fill="currentColor" />
        </svg>
      </div>
      <div className={styles.lockedBadge}>Locked</div>
      <div className={styles.lockedTitle}>{title}</div>
      <Button variant="primary" className={styles.lockedButton} type="button">
        {cta}
      </Button>
    </div>
  );
}
