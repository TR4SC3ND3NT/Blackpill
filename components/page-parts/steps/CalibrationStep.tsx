"use client";

import Button from "@/components/Button";
import Card from "@/components/Card";
import LandmarkCalibrator from "@/components/LandmarkCalibrator";
import styles from "@/app/page.module.css";
import type { LandmarkPreviewData, ManualCalibrationResult, ImageState } from "@/lib/page-flow/types";

type Props = {
  frontImage: ImageState | null;
  sideImage: ImageState | null;
  previewData: LandmarkPreviewData | null;
  previewLoading: boolean;
  previewStatus: string | null;
  previewError: string | null;
  error: string | null;
  gender: string;
  race: string;
  manualCalibration: ManualCalibrationResult | null;
  onBackToConsent: () => void;
  onRetryPreparation: () => void;
  onComplete: (result: ManualCalibrationResult) => void;
};

export default function CalibrationStep({
  frontImage,
  sideImage,
  previewData,
  previewLoading,
  previewStatus,
  previewError,
  error,
  gender,
  race,
  manualCalibration,
  onBackToConsent,
  onRetryPreparation,
  onComplete,
}: Props) {
  return (
    <Card className={`${styles.homeCard} ${styles.grid}`}>
      <div>
        <strong>Landmark Calibration</strong>
        <div className={styles.note}>
          Calibration runs in two passes: FRONT landmarks first, then SIDE/profile
          landmarks. Each step shows one active point only.
        </div>
      </div>

      {previewLoading ? (
        <div className={styles.note}>
          {previewStatus
            ? `Preparing auto landmarks (${previewStatus})...`
            : "Preparing auto landmarks for calibration..."}
        </div>
      ) : null}
      {previewError ? <div className={styles.error}>{previewError}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {previewData && frontImage && sideImage ? (
        <LandmarkCalibrator
          frontImage={frontImage}
          sideImage={sideImage}
          frontLandmarks={previewData.frontLandmarks}
          sideLandmarks={previewData.sideLandmarks}
          frontQuality={previewData.frontQuality}
          sideQuality={previewData.sideQuality}
          profile={{ gender: gender || "male", ethnicity: race || "white" }}
          initialPoints={manualCalibration?.manualPoints ?? null}
          onBack={onBackToConsent}
          onComplete={onComplete}
        />
      ) : (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onBackToConsent}>
            Back
          </Button>
          <Button variant="ghost" onClick={onRetryPreparation}>
            Retry Preparation
          </Button>
        </div>
      )}
    </Card>
  );
}
