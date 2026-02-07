"use client";

import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "@/app/page.module.css";
import type { ProcessingStep as ProcessingStepType } from "@/lib/page-flow/types";

type Props = {
  progressPercent: number;
  processingSteps: ProcessingStepType[];
  error: string | null;
  isProcessing: boolean;
  onBack: () => void;
};

export default function ProcessingStep({
  progressPercent,
  processingSteps,
  error,
  isProcessing,
  onBack,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.progressWrap}`}>
      <div>
        <strong>Processing</strong>
        <div className={styles.note}>
          We are running on-device landmarking and preparing your analysis.
        </div>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}>
          <div className={styles.shimmer} />
        </div>
      </div>

      <div className={styles.statusList}>
        {processingSteps.map((item) => (
          <div key={item.key} className={styles.statusItem}>
            <span
              className={`${styles.statusDot} ${
                item.status === "running"
                  ? styles.statusRunning
                  : item.status === "done"
                    ? styles.statusDone
                    : item.status === "error"
                      ? styles.statusError
                      : ""
              }`}
            />
            <span>{item.label}</span>
            {item.note ? <span className={styles.hint}>({item.note})</span> : null}
          </div>
        ))}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
      </div>
    </Card>
  );
}
