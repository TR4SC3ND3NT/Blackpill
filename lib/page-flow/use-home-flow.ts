"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import type { RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  detectLandmarks,
  detectLandmarksWithBBoxFallback,
  warmupMediapipe,
} from "@/lib/mediapipe";
import { fetchJson, wait } from "@/lib/api";
import type { Landmark, ManualLandmarkPoint, PhotoQuality } from "@/lib/types";
import type {
  ImageState,
  ProcessingStep as ProcessingStepType,
  LandmarkPreviewData,
  ManualCalibrationResult,
  StepItem,
} from "@/lib/page-flow/types";
import { compressImage } from "@/lib/page-flow/image-utils";
import {
  evaluatePhoto,
  PREVIEW_STAGE_TIMEOUT_MS,
} from "@/lib/page-flow/photo-evaluation";
import {
  mergeIssues,
  isAbortError,
  withAbortAndTimeout,
} from "@/lib/page-flow/async-utils";

const initialProcessing: ProcessingStepType[] = [
  { key: "landmarks", label: "Detecting landmarks", status: "pending" },
  { key: "orientation", label: "Estimating side orientation", status: "pending" },
  { key: "background", label: "Refining background", status: "pending" },
  { key: "analysis", label: "Creating analysis", status: "pending" },
  { key: "save", label: "Saving landmark package", status: "pending" },
];

export type UseHomeFlowResult = {
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
  stepItems: StepItem[];
  setActiveDropZone: (zone: "front" | "side" | null) => void;
  onSelectGender: (value: string) => void;
  onSelectRace: (value: string) => void;
  onConsentChange: (value: boolean) => void;
  onFrontFileChange: (file: File | undefined) => void;
  onSideFileChange: (file: File | undefined) => void;
  onFrontDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSideDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
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

export function useHomeFlow(): UseHomeFlowResult {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [frontImage, setFrontImage] = useState<ImageState | null>(null);
  const [sideImage, setSideImage] = useState<ImageState | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<"front" | "side" | null>(null);
  const [gender, setGender] = useState("");
  const [race, setRace] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] =
    useState<ProcessingStepType[]>(initialProcessing);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<LandmarkPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [manualCalibration, setManualCalibration] =
    useState<ManualCalibrationResult | null>(null);
  const [warmupError, setWarmupError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const hasRunRef = useRef(false);
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const sideInputRef = useRef<HTMLInputElement | null>(null);
  const previewRequestKeyRef = useRef<string | null>(null);
  const warmupTriggeredRef = useRef(false);

  const stepItems = useMemo<StepItem[]>(
    () => [
      {
        label: "Gender",
        status: step === 0 ? "active" : step > 0 ? "done" : "inactive",
      },
      {
        label: "Ethnicity",
        status: step === 1 ? "active" : step > 1 ? "done" : "inactive",
      },
      {
        label: "Upload",
        status: step === 2 ? "active" : step > 2 ? "done" : "inactive",
      },
      {
        label: "Consent",
        status: step === 3 ? "active" : step > 3 ? "done" : "inactive",
      },
      {
        label: "Calibration",
        status: step === 4 ? "active" : step > 4 ? "done" : "inactive",
      },
      {
        label: "Processing",
        status: step === 5 ? "active" : step > 5 ? "done" : "inactive",
      },
      {
        label: "Results",
        status: step > 5 ? "done" : "inactive",
      },
    ],
    [step]
  );

  const progressPercent = useMemo(() => {
    const total = processingSteps.length;
    const done = processingSteps.filter((item) => item.status === "done").length;
    const running = processingSteps.some((item) => item.status === "running");
    const bonus = running ? 0.35 : 0;
    return Math.min(100, Math.round(((done + bonus) / total) * 100));
  }, [processingSteps]);

  const updateProcessing = useCallback(
    (key: string, status: ProcessingStepType["status"], note?: string) => {
      setProcessingSteps((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, status, note: note ?? item.note } : item
        )
      );
    },
    []
  );

  const handleFile = useCallback(
    async (file: File | undefined, setter: (value: ImageState | null) => void) => {
      if (!file) return;
      setError(null);
      setPreviewError(null);
      setPreviewData(null);
      setPreviewStatus(null);
      setManualCalibration(null);
      setWarmupError(null);
      setActiveDropZone(null);
      warmupTriggeredRef.current = false;
      previewRequestKeyRef.current = null;
      try {
        const processed = await compressImage(file);
        setter(processed);
      } catch {
        setError("Failed to process the image. Try a different photo.");
      }
    },
    []
  );

  const handleDropUpload = useCallback(
    async (
      event: ReactDragEvent<HTMLDivElement>,
      setter: (value: ImageState | null) => void,
      zone: "front" | "side"
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveDropZone((prev) => (prev === zone ? null : prev));
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      await handleFile(file, setter);
    },
    [handleFile]
  );

  useEffect(() => {
    setPreviewData(null);
    setPreviewError(null);
    setPreviewStatus(null);
    previewRequestKeyRef.current = null;
    setManualCalibration(null);
  }, [frontImage?.dataUrl, sideImage?.dataUrl]);

  useEffect(() => {
    if (!frontImage || !sideImage) return;
    if (!consent && step < 3) return;
    if (warmupTriggeredRef.current) return;

    let active = true;
    const controller = new AbortController();
    warmupTriggeredRef.current = true;
    setWarmupError(null);

    const timerLabel = `[preview] warmup-${Date.now()}`;
    console.time(timerLabel);
    withAbortAndTimeout(
      warmupMediapipe({
        timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
        signal: controller.signal,
        onStatus: (status) => {
          if (!active) return;
          setPreviewStatus(status);
        },
      }),
      controller.signal,
      PREVIEW_STAGE_TIMEOUT_MS,
      "MediaPipe warmup"
    )
      .then(() => {
        if (!active) return;
        setPreviewStatus("Preview ready.");
      })
      .catch((reason) => {
        if (!active || isAbortError(reason)) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "Could not load MediaPipe runtime/models.";
        setWarmupError(message);
        warmupTriggeredRef.current = false;
      })
      .finally(() => {
        console.timeEnd(timerLabel);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [frontImage, sideImage, consent, step]);

  const prepareLandmarkPreview = useCallback(
    async (signal?: AbortSignal): Promise<LandmarkPreviewData> => {
      if (!frontImage || !sideImage) {
        throw new Error("Please upload both photos.");
      }

      const stageTimeout = PREVIEW_STAGE_TIMEOUT_MS;
      setPreviewStatus("Loading WASM...");
      await withAbortAndTimeout(
        warmupMediapipe({
          timeoutMs: stageTimeout,
          signal,
          onStatus: (status) => setPreviewStatus(status),
        }),
        signal,
        stageTimeout,
        "Preview warmup"
      );

      setPreviewStatus("Running landmarker...");
      const [frontDetection, sideDetection] = await withAbortAndTimeout(
        Promise.all([
          detectLandmarks(frontImage.dataUrl, {
            signal,
            timeoutMs: stageTimeout,
            expectedView: "front",
            onStatus: (status) => setPreviewStatus(status),
          }),
          detectLandmarksWithBBoxFallback(sideImage.dataUrl, {
            signal,
            timeoutMs: stageTimeout,
            expectedView: "side",
            onStatus: (status) => setPreviewStatus(status),
          }),
        ]),
        signal,
        stageTimeout,
        "Landmark detection"
      );
      const front = frontDetection.landmarks;
      const side = sideDetection.landmarks;

      setPreviewStatus("Evaluating quality...");
      const [frontCheck, sideCheck] = await Promise.all([
        evaluatePhoto(
          "Front",
          frontImage.dataUrl,
          front,
          frontImage.width,
          frontImage.height,
          "front",
          frontDetection.pose,
          frontDetection.transformed
        ),
        evaluatePhoto(
          "Side",
          sideImage.dataUrl,
          side,
          sideImage.width,
          sideImage.height,
          "side",
          sideDetection.pose,
          sideDetection.transformed
        ),
      ]);

      if (!frontCheck.ok) {
        throw new Error(frontCheck.errors.join(" "));
      }

      let sideQuality: PhotoQuality = sideCheck.quality;
      const warnings: string[] = [...frontCheck.warnings, ...sideCheck.warnings];
      let sideWarning: string | undefined;

      if (!side.length) {
        sideWarning = "Side face not detected - try another angle.";
        sideQuality = {
          ...sideQuality,
          quality: "low",
          issues: mergeIssues([...sideQuality.issues, sideWarning]),
        };
      } else if (sideCheck.quality.reasonCodes.includes("side_disabled")) {
        sideWarning = "Side pose invalid - profile metrics disabled.";
        sideQuality = {
          ...sideQuality,
          quality: "low",
          issues: mergeIssues([...sideQuality.issues, sideWarning]),
        };
      } else if (!sideCheck.ok) {
        sideQuality = {
          ...sideQuality,
          quality: "low",
          issues: mergeIssues([...sideQuality.issues, ...sideCheck.errors]),
        };
        warnings.push(...sideCheck.errors);
      }

      return {
        frontLandmarks: front,
        sideLandmarks: side,
        frontQuality: frontCheck.quality,
        sideQuality,
        frontMethod: frontDetection.method,
        frontTransformed: frontDetection.transformed,
        frontPose: frontDetection.pose,
        sideMethod: sideDetection.method,
        sideTransformed: sideDetection.transformed,
        sidePose: sideDetection.pose,
        sideBboxFound: sideDetection.bboxFound,
        sideBbox: sideDetection.bbox,
        sideScaleApplied: sideDetection.scaleApplied,
        warnings: mergeIssues(warnings),
        sideWarning,
      };
    },
    [frontImage, sideImage]
  );

  useEffect(() => {
    if (step !== 4 || !frontImage || !sideImage) {
      return undefined;
    }

    const requestKey = `${frontImage.dataUrl.slice(0, 32)}:${frontImage.dataUrl.length}|${sideImage.dataUrl.slice(0, 32)}:${sideImage.dataUrl.length}`;
    if (previewRequestKeyRef.current === requestKey) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    previewRequestKeyRef.current = requestKey;
    setPreviewLoading(true);
    setPreviewError(null);
    setError(null);
    setPreviewStatus("Loading WASM...");

    const timerLabel = `[preview] detect-${Date.now()}`;
    console.time(timerLabel);

    prepareLandmarkPreview(controller.signal)
      .then((result) => {
        if (!active) return;
        setPreviewData(result);
        setPreviewStatus("Preview ready.");
        if (result.sideWarning) {
          setError(result.sideWarning);
        } else if (result.warnings.length) {
          setError(`Quality warning: ${result.warnings.join(" ")}`);
        }
      })
      .catch((reason) => {
        if (!active || isAbortError(reason)) return;
        const message =
          reason instanceof Error ? reason.message : "Landmark preview failed.";
        setPreviewError(message);
        setError(message);
        setPreviewStatus(null);
      })
      .finally(() => {
        console.timeEnd(timerLabel);
        if (active) {
          setPreviewLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
      setPreviewLoading(false);
      setPreviewStatus(null);
    };
  }, [step, frontImage, sideImage, prepareLandmarkPreview]);

  const runPipeline = useCallback(async () => {
    if (!frontImage || !sideImage) return;
    if (inFlightRef.current) return;
    if (!gender || !race) {
      setError("Please complete gender and ethnicity selection first.");
      return;
    }

    inFlightRef.current = true;
    setProcessingSteps(initialProcessing);
    setError(null);

    let frontLandmarks: Landmark[] = [];
    let sideLandmarks: Landmark[] = [];
    let manualLandmarks: ManualLandmarkPoint[] | null = null;
    let frontSegmented = frontImage.dataUrl;
    let sideSegmented = sideImage.dataUrl;
    let frontQuality: PhotoQuality | null = null;
    let sideQuality: PhotoQuality | null = null;

    try {
      updateProcessing("landmarks", "running");
      try {
        if (previewData) {
          if (manualCalibration) {
            frontLandmarks = previewData.frontLandmarks;
            sideLandmarks = previewData.sideLandmarks;
            manualLandmarks = manualCalibration.manualPoints;
          } else {
            frontLandmarks = previewData.frontLandmarks;
            sideLandmarks = previewData.sideLandmarks;
          }
          frontQuality = previewData.frontQuality;
          sideQuality = previewData.sideQuality;
          const warnings = previewData.warnings.join(" ");

          if (previewData.sideWarning) {
            const sideMessage = previewData.sideWarning;
            setError(sideMessage);
            updateProcessing(
              "landmarks",
              "done",
              warnings
                ? `${sideMessage} ${warnings}`
                : `${sideMessage} Continuing with low-confidence side analysis.`
            );
          } else if (!sideLandmarks.length) {
            const sideMessage = "Side face not detected - try another angle.";
            setError(sideMessage);
            updateProcessing(
              "landmarks",
              "done",
              warnings
                ? `${sideMessage} ${warnings}`
                : `${sideMessage} Continuing with low-confidence side analysis.`
            );
          } else {
            const methodNote = manualCalibration
              ? `Landmarks calibrated manually (${previewData.sideMethod}).`
              : `Landmarks prepared (${previewData.sideMethod}).`;
            updateProcessing(
              "landmarks",
              "done",
              warnings ? `Quality warning: ${warnings}` : methodNote
            );
          }
        } else {
          const [front, side] = await Promise.all([
            detectLandmarks(frontImage.dataUrl, {
              timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
              expectedView: "front",
            }),
            detectLandmarksWithBBoxFallback(sideImage.dataUrl, {
              timeoutMs: PREVIEW_STAGE_TIMEOUT_MS,
              expectedView: "side",
            }),
          ]);
          frontLandmarks = front.landmarks;
          sideLandmarks = side.landmarks;
          manualLandmarks = null;
          const [frontCheck, sideCheck] = await Promise.all([
            evaluatePhoto(
              "Front",
              frontImage.dataUrl,
              frontLandmarks,
              frontImage.width,
              frontImage.height,
              "front",
              front.pose,
              front.transformed
            ),
            evaluatePhoto(
              "Side",
              sideImage.dataUrl,
              sideLandmarks,
              sideImage.width,
              sideImage.height,
              "side",
              side.pose,
              side.transformed
            ),
          ]);

          frontQuality = frontCheck.quality;
          sideQuality = sideCheck.quality;

          if (!frontCheck.ok) {
            const message = frontCheck.errors.join(" ");
            setError(message);
            updateProcessing("landmarks", "error", "Photo quality check failed.");
            return;
          }

          const sideNotDetected = sideLandmarks.length === 0;
          const warningsList = [...frontCheck.warnings, ...sideCheck.warnings];
          if (sideNotDetected) {
            const sideMessage = "Side face not detected - try another angle.";
            setError(sideMessage);
            sideQuality = {
              ...sideCheck.quality,
              quality: "low",
              issues: mergeIssues([...sideCheck.quality.issues, sideMessage]),
            };
            const note = warningsList.length
              ? `${sideMessage} ${warningsList.join(" ")}`
              : `${sideMessage} Continuing with low-confidence side analysis.`;
            updateProcessing("landmarks", "done", note);
          } else {
            if (sideCheck.quality.reasonCodes.includes("side_disabled")) {
              const sideMessage = "Side pose invalid - profile metrics disabled.";
              setError(sideMessage);
              warningsList.push(sideMessage);
              sideQuality = {
                ...sideCheck.quality,
                quality: "low",
                issues: mergeIssues([...sideCheck.quality.issues, sideMessage]),
              };
            }
            if (!sideCheck.ok) {
              warningsList.push(...sideCheck.errors);
              sideQuality = {
                ...sideCheck.quality,
                quality: "low",
                issues: mergeIssues([...sideCheck.quality.issues, ...sideCheck.errors]),
              };
            }

            updateProcessing(
              "landmarks",
              "done",
              warningsList.length
                ? `Quality warning: ${mergeIssues(warningsList).join(" ")}`
                : `Landmarks prepared (${side.method}).`
            );
          }
        }
      } catch {
        updateProcessing("landmarks", "error", "Face detection failed.");
        setError("Face detection failed. Please try clearer photos.");
        return;
      }

      updateProcessing("orientation", "running");
      try {
        await fetchJson("/api/side-landmarks", {
          method: "POST",
          body: JSON.stringify({
            mediapipeLandmarks: sideLandmarks,
            imageWidth: sideImage.width,
            imageHeight: sideImage.height,
          }),
        });
        updateProcessing("orientation", "done");
      } catch {
        updateProcessing("orientation", "error", "Orientation fallback enabled.");
      }

      updateProcessing("background", "running");
      try {
        const [frontRes, sideRes] = await Promise.all([
          fetchJson<{ success: boolean; image: string }>("/api/background-removal", {
            method: "POST",
            body: JSON.stringify({ image: frontImage.dataUrl, quality: 0.8 }),
          }),
          fetchJson<{ success: boolean; image: string }>("/api/background-removal", {
            method: "POST",
            body: JSON.stringify({ image: sideImage.dataUrl, quality: 0.8 }),
          }),
        ]);
        frontSegmented = frontRes.image ?? frontSegmented;
        sideSegmented = sideRes.image ?? sideSegmented;
        updateProcessing("background", "done");
      } catch {
        updateProcessing("background", "error", "Background retained.");
      }

      updateProcessing("analysis", "running");
      const create = await fetchJson<{ success: boolean; faceId: string }>("/api/faces", {
        method: "POST",
        body: JSON.stringify({
          frontPhotoUrl: frontImage.dataUrl,
          sidePhotoUrl: sideImage.dataUrl,
          frontPhotoSegmentedUrl: frontSegmented,
          sidePhotoSegmentedUrl: sideSegmented,
          frontLandmarks,
          sideLandmarks,
          mediapipeLandmarks: frontLandmarks,
          frontQuality,
          sideQuality,
          manualLandmarks,
          gender,
          race,
        }),
      });
      updateProcessing("analysis", "done");

      updateProcessing("save", "running");
      try {
        await Promise.all([
          fetchJson(`/api/faces/${create.faceId}/mediapipe`, {
            method: "POST",
            body: JSON.stringify({
              kind: "front",
              landmarks: frontLandmarks,
            }),
          }),
          fetchJson(`/api/faces/${create.faceId}/mediapipe`, {
            method: "POST",
            body: JSON.stringify({
              kind: "side",
              landmarks: sideLandmarks,
            }),
          }),
        ]);
        updateProcessing("save", "done");
      } catch {
        updateProcessing("save", "error", "Failed to save landmarks.");
      }

      await wait(300);
      router.push(`/results/${create.faceId}`);
    } catch {
      setError("Something went wrong while creating the analysis. Please retry.");
      updateProcessing("analysis", "error");
    } finally {
      setIsProcessing(false);
      inFlightRef.current = false;
    }
  }, [
    frontImage,
    sideImage,
    gender,
    race,
    previewData,
    manualCalibration,
    router,
    updateProcessing,
  ]);

  useEffect(() => {
    if (step !== 5) {
      hasRunRef.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (step === 5 && !hasRunRef.current) {
      hasRunRef.current = true;
      setIsProcessing(true);
      runPipeline();
    }
  }, [step, runPipeline]);

  const canProceed = Boolean(frontImage && sideImage);

  const onSelectGender = useCallback((value: string) => {
    setGender(value);
    setError(null);
  }, []);

  const onSelectRace = useCallback((value: string) => {
    setRace(value);
    setError(null);
  }, []);

  const onFrontFileChange = useCallback(
    (file: File | undefined) => {
      void handleFile(file, setFrontImage);
    },
    [handleFile]
  );

  const onSideFileChange = useCallback(
    (file: File | undefined) => {
      void handleFile(file, setSideImage);
    },
    [handleFile]
  );

  const onFrontDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      void handleDropUpload(event, setFrontImage, "front");
    },
    [handleDropUpload]
  );

  const onSideDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      void handleDropUpload(event, setSideImage, "side");
    },
    [handleDropUpload]
  );

  const onResetUploads = useCallback(() => {
    setFrontImage(null);
    setSideImage(null);
    setActiveDropZone(null);
  }, []);

  const onContinueFromGender = useCallback(() => {
    if (!gender) {
      setError("Please select a gender to continue.");
      return;
    }
    setError(null);
    setStep(1);
  }, [gender]);

  const onContinueFromEthnicity = useCallback(() => {
    if (!race) {
      setError("Please select an ethnicity to continue.");
      return;
    }
    setError(null);
    setStep(2);
  }, [race]);

  const onContinueFromUpload = useCallback(() => {
    setStep(3);
  }, []);

  const onStartCalibration = useCallback(() => {
    if (!consent) {
      setError("Please confirm consent to continue.");
      return;
    }
    setPreviewError(null);
    setPreviewData(null);
    setPreviewStatus(null);
    setManualCalibration(null);
    previewRequestKeyRef.current = null;
    setError(null);
    setStep(4);
  }, [consent]);

  const onRetryPreview = useCallback(() => {
    setPreviewError(null);
    setPreviewData(null);
    setPreviewStatus(null);
    setManualCalibration(null);
    previewRequestKeyRef.current = null;
  }, []);

  const onCompleteCalibration = useCallback((result: ManualCalibrationResult) => {
    setManualCalibration(result);
    setError(null);
    setStep(5);
  }, []);

  return {
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
    stepItems,
    setActiveDropZone,
    onSelectGender,
    onSelectRace,
    onConsentChange: setConsent,
    onFrontFileChange,
    onSideFileChange,
    onFrontDrop,
    onSideDrop,
    onResetUploads,
    onBackFromEthnicity: () => setStep(0),
    onBackFromUpload: () => setStep(1),
    onBackFromConsent: () => setStep(2),
    onBackFromCalibration: () => setStep(3),
    onBackFromProcessing: () => setStep(4),
    onContinueFromGender,
    onContinueFromEthnicity,
    onContinueFromUpload,
    onStartCalibration,
    onRetryPreview,
    onCompleteCalibration,
  };
}
