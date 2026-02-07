"use client";

import Button from "@/components/Button";
import Card from "@/components/Card";
import styles from "@/app/page.module.css";

type Props = {
  consent: boolean;
  error: string | null;
  warmupError: string | null;
  onConsentChange: (value: boolean) => void;
  onBack: () => void;
  onStartCalibration: () => void;
};

export default function ConsentStep({
  consent,
  error,
  warmupError,
  onConsentChange,
  onBack,
  onStartCalibration,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.grid}`}>
      <div className={styles.consentBox}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsentChange(event.target.checked)}
        />
        <div>
          <strong>I consent to processing</strong>
          <div className={styles.note}>
            Photos are used only to generate your analysis session and are stored
            locally in this MVP. You can reset at any time.
          </div>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onStartCalibration}>Start Calibration</Button>
      </div>
      {warmupError ? <div className={styles.error}>{warmupError}</div> : null}
    </Card>
  );
}
