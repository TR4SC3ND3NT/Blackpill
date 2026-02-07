"use client";

import type { RefObject } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { AnimatePresence } from "framer-motion";
import StepTransition from "@/components/page-parts/StepTransition";
import GenderStep from "@/components/page-parts/steps/GenderStep";
import EthnicityStep from "@/components/page-parts/steps/EthnicityStep";
import UploadStep from "@/components/page-parts/steps/UploadStep";
import ConsentStep from "@/components/page-parts/steps/ConsentStep";
import CalibrationStep from "@/components/page-parts/steps/CalibrationStep";
import ProcessingStep from "@/components/page-parts/steps/ProcessingStep";
import type { ImageState, ManualCalibrationResult, ProcessingStep as ProcessingStepType, LandmarkPreviewData } from "@/lib/page-flow/types";

type HomeStepRendererProps = {
  step: number;
  gender: string;
  race: string;
  consent: boolean;
  error: string | null;
  warmupError: string | null;
  frontImage: ImageState | null;
  sideImage: ImageState | null;
  activeDropZone: "front" | "side" | null;
  frontInputRef: RefObject<HTMLInputElement | null>;
  sideInputRef: RefObject<HTMLInputElement | null>;
  canProceed: boolean;
  previewData: LandmarkPreviewData | null;
  previewLoading: boolean;
  previewStatus: string | null;
  previewError: string | null;
  manualCalibration: ManualCalibrationResult | null;
  processingSteps: ProcessingStepType[];
  progressPercent: number;
  isProcessing: boolean;
  onSelectGender: (value: string) => void;
  onSelectRace: (value: string) => void;
  onConsentChange: (value: boolean) => void;
  onFrontFileChange: (file: File | undefined) => void;
  onSideFileChange: (file: File | undefined) => void;
  onFrontDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSideDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  setActiveDropZone: (zone: "front" | "side" | null) => void;
  onResetUploads: () => void;
  onBackFromEthnicity: () => void;
  onBackFromUpload: () => void;
  onBackFromConsent: () => void;
  onBackFromCalibration: () => void;
  onBackFromProcessing: () => void;
  onContinueFromGender: () => void;
  onContinueFromEthnicity: () => void;
  onContinueFromUpload: () => void;
  onStartCalibration: () => void;
  onRetryPreview: () => void;
  onCompleteCalibration: (result: ManualCalibrationResult) => void;
};

export default function HomeStepRenderer({
  step,
  gender,
  race,
  consent,
  error,
  warmupError,
  frontImage,
  sideImage,
  activeDropZone,
  frontInputRef,
  sideInputRef,
  canProceed,
  previewData,
  previewLoading,
  previewStatus,
  previewError,
  manualCalibration,
  processingSteps,
  progressPercent,
  isProcessing,
  onSelectGender,
  onSelectRace,
  onConsentChange,
  onFrontFileChange,
  onSideFileChange,
  onFrontDrop,
  onSideDrop,
  setActiveDropZone,
  onResetUploads,
  onBackFromEthnicity,
  onBackFromUpload,
  onBackFromConsent,
  onBackFromCalibration,
  onBackFromProcessing,
  onContinueFromGender,
  onContinueFromEthnicity,
  onContinueFromUpload,
  onStartCalibration,
  onRetryPreview,
  onCompleteCalibration,
}: HomeStepRendererProps) {
  return (
    <AnimatePresence mode="wait">
      {step === 0 ? (
        <StepTransition stepKey="gender">
          <GenderStep
            gender={gender}
            error={error}
            onSelectGender={onSelectGender}
            onContinue={onContinueFromGender}
          />
        </StepTransition>
      ) : null}

      {step === 1 ? (
        <StepTransition stepKey="ethnicity">
          <EthnicityStep
            race={race}
            error={error}
            onSelectRace={onSelectRace}
            onBack={onBackFromEthnicity}
            onContinue={onContinueFromEthnicity}
          />
        </StepTransition>
      ) : null}

      {step === 2 ? (
        <StepTransition stepKey="upload">
          <UploadStep
            frontImage={frontImage}
            sideImage={sideImage}
            activeDropZone={activeDropZone}
            frontInputRef={frontInputRef}
            sideInputRef={sideInputRef}
            error={error}
            canProceed={canProceed}
            setActiveDropZone={setActiveDropZone}
            onFrontFileChange={onFrontFileChange}
            onSideFileChange={onSideFileChange}
            onFrontDrop={onFrontDrop}
            onSideDrop={onSideDrop}
            onBack={onBackFromUpload}
            onContinue={onContinueFromUpload}
            onReset={onResetUploads}
          />
        </StepTransition>
      ) : null}

      {step === 3 ? (
        <StepTransition stepKey="consent">
          <ConsentStep
            consent={consent}
            error={error}
            warmupError={warmupError}
            onConsentChange={onConsentChange}
            onBack={onBackFromConsent}
            onStartCalibration={onStartCalibration}
          />
        </StepTransition>
      ) : null}

      {step === 4 ? (
        <StepTransition stepKey="landmark-calibration">
          <CalibrationStep
            frontImage={frontImage}
            sideImage={sideImage}
            previewData={previewData}
            previewLoading={previewLoading}
            previewStatus={previewStatus}
            previewError={previewError}
            error={error}
            gender={gender}
            race={race}
            manualCalibration={manualCalibration}
            onBackToConsent={onBackFromCalibration}
            onRetryPreparation={onRetryPreview}
            onComplete={onCompleteCalibration}
          />
        </StepTransition>
      ) : null}

      {step === 5 ? (
        <StepTransition stepKey="processing">
          <ProcessingStep
            progressPercent={progressPercent}
            processingSteps={processingSteps}
            error={error}
            isProcessing={isProcessing}
            onBack={onBackFromProcessing}
          />
        </StepTransition>
      ) : null}
    </AnimatePresence>
  );
}
