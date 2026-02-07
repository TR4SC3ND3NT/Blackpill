import type {
  Landmark,
  ManualLandmarkPoint,
  PhotoQuality,
  PoseEstimate,
} from "@/lib/types";

export type ImageState = {
  dataUrl: string;
  width: number;
  height: number;
};

export type ProcessingStepStatus = "pending" | "running" | "done" | "error";

export type ProcessingStep = {
  key: string;
  label: string;
  status: ProcessingStepStatus;
  note?: string;
};

export type ExpectedView = "front" | "side";

export type LandmarkPreviewData = {
  frontLandmarks: Landmark[];
  sideLandmarks: Landmark[];
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  frontMethod: string;
  frontTransformed: boolean;
  frontPose: PoseEstimate;
  sideMethod: string;
  sideTransformed: boolean;
  sidePose: PoseEstimate;
  sideBboxFound: boolean;
  sideBbox?: { x: number; y: number; width: number; height: number };
  sideScaleApplied: number;
  warnings: string[];
  sideWarning?: string;
};

export type ManualCalibrationResult = {
  manualPoints: ManualLandmarkPoint[];
};

export type StepItemStatus = "active" | "done" | "inactive";

export type StepItem = {
  label: string;
  status: StepItemStatus;
};
