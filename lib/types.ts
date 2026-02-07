export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type PhotoQuality = {
  poseYaw: number;
  posePitch: number;
  poseRoll: number;
  detectedView: "front" | "side" | "unknown";
  faceInFrame: boolean;
  minSidePx: number;
  blurVariance: number;
  landmarkCount: number;
  quality: "ok" | "low";
  issues: string[];
};

export type Assessment = {
  title: string;
  score: number;
  note?: string;
  severity: "low" | "medium" | "high";
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
  angularityAssessments: Assessment[];
  dimorphismAssessments: Assessment[];
  featuresAssessments: Assessment[];
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
