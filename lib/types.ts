export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type ViewLabel = "front" | "side" | "unknown";

export type ReasonCode =
  | "bad_pose"
  | "occlusion"
  | "blur"
  | "out_of_frame"
  | "low_landmark_conf"
  | "side_disabled"
  | "transformed_detection";

export type PoseEstimate = {
  yaw: number;
  pitch: number;
  roll: number;
  source: "matrix" | "fallback" | "none";
  matrix?: number[] | null;
  confidence: number;
  view: ViewLabel;
  validFront: boolean;
  validSide: boolean;
};

export type PhotoQuality = {
  poseYaw: number;
  posePitch: number;
  poseRoll: number;
  detectedView: ViewLabel;
  faceInFrame: boolean;
  minSidePx: number;
  blurVariance: number;
  landmarkCount: number;
  quality: "ok" | "low";
  issues: string[];
  confidence: number;
  pose: PoseEstimate;
  expectedView: "front" | "side";
  viewValid: boolean;
  reasonCodes: ReasonCode[];
};

export type Assessment = {
  title: string;
  score: number;
  note?: string;
  severity: "low" | "medium" | "high";
  metricId?: string;
  pillar?: "harmony" | "angularity" | "dimorphism" | "features";
  confidence?: number;
  usedWeight?: number;
  insufficient?: boolean;
  validityReason?: string;
  value?: number | null;
  errorBar?: number | null;
};

export type MetricDiagnostic = {
  id: string;
  title: string;
  pillar: "harmony" | "angularity" | "dimorphism" | "features";
  view: "front" | "side" | "either";
  value: number | null;
  score: number | null;
  confidence: number;
  baseWeight: number;
  usedWeight: number;
  scored: boolean;
  insufficient: boolean;
  validityReason: string | null;
  reasonCodes: ReasonCode[];
  errorBar: number | null;
};

export type FaceRecord = {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
  userId?: string | null;
  name?: string | null;
  actionPlan?: { title: string | null; items: unknown[] };
  unlockStatus?: {
    overall: boolean;
    harmony: boolean;
    dimorphism: boolean;
    features: boolean;
  };
  gender: string;
  race: string;
  unlocked: boolean;
  overallScore: number;
  harmonyScore: number;
  frontHarmonyScore: number;
  sideHarmonyScore: number;
  dimorphismScore: number;
  angularityScore: number;
  featuresScore: number;
  overallConfidence?: number;
  overallErrorBar?: number;
  harmonyConfidence?: number;
  angularityConfidence?: number;
  dimorphismConfidence?: number;
  featuresConfidence?: number;
  angularityAssessments: Assessment[];
  dimorphismAssessments: Assessment[];
  featuresAssessments: Assessment[];
  metricDiagnostics?: MetricDiagnostic[];
  frontPhotoUrl: string;
  sidePhotoUrl: string;
  frontPhotoSegmentedUrl?: string | null;
  sidePhotoSegmentedUrl?: string | null;
  useTransparentImages: boolean;
  frontLandmarks?: Landmark[] | null;
  sideLandmarks?: Landmark[] | null;
  mediapipeLandmarks?: Landmark[] | null;
  frontQuality?: PhotoQuality | null;
  sideQuality?: PhotoQuality | null;
};

export type SubscriptionInfo = {
  success: boolean;
  subscription: null;
  quotaUsage: {
    totalQuota: number;
    hasQuota: boolean;
    quotas: Record<string, { amount: number | null; used: number; remaining: number }>;
    used?: number;
    remaining?: number;
    total?: number;
    resetAtIso?: string;
  };
};
