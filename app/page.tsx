"use client";

import styles from "./page.module.css";
import HomeHeader from "@/components/page-parts/HomeHeader";
import HomeStepper from "@/components/page-parts/HomeStepper";
import HomeStepRenderer from "@/components/page-parts/HomeStepRenderer";
import { useHomeFlow } from "@/lib/page-flow/use-home-flow";

export default function Home() {
  const flow = useHomeFlow();

  return (
    <main className={styles.homeShell}>
      <div className={styles.homeContainer}>
        <HomeHeader />
        <HomeStepper items={flow.stepItems} />
        <HomeStepRenderer
          step={flow.step}
          gender={flow.gender}
          race={flow.race}
          consent={flow.consent}
          error={flow.error}
          warmupError={flow.warmupError}
          frontImage={flow.frontImage}
          sideImage={flow.sideImage}
          activeDropZone={flow.activeDropZone}
          frontInputRef={flow.frontInputRef}
          sideInputRef={flow.sideInputRef}
          canProceed={flow.canProceed}
          previewData={flow.previewData}
          previewLoading={flow.previewLoading}
          previewStatus={flow.previewStatus}
          previewError={flow.previewError}
          manualCalibration={flow.manualCalibration}
          processingSteps={flow.processingSteps}
          progressPercent={flow.progressPercent}
          isProcessing={flow.isProcessing}
          onSelectGender={flow.onSelectGender}
          onSelectRace={flow.onSelectRace}
          onConsentChange={flow.onConsentChange}
          onFrontFileChange={flow.onFrontFileChange}
          onSideFileChange={flow.onSideFileChange}
          onFrontDrop={flow.onFrontDrop}
          onSideDrop={flow.onSideDrop}
          setActiveDropZone={flow.setActiveDropZone}
          onResetUploads={flow.onResetUploads}
          onBackFromEthnicity={flow.onBackFromEthnicity}
          onBackFromUpload={flow.onBackFromUpload}
          onBackFromConsent={flow.onBackFromConsent}
          onBackFromCalibration={flow.onBackFromCalibration}
          onBackFromProcessing={flow.onBackFromProcessing}
          onContinueFromGender={flow.onContinueFromGender}
          onContinueFromEthnicity={flow.onContinueFromEthnicity}
          onContinueFromUpload={flow.onContinueFromUpload}
          onStartCalibration={flow.onStartCalibration}
          onRetryPreview={flow.onRetryPreview}
          onCompleteCalibration={flow.onCompleteCalibration}
        />
      </div>
    </main>
  );
}
