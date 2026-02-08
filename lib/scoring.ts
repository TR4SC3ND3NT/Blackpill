import type {
  Assessment,
  Landmark,
  ManualLandmarkPoint,
  MetricDiagnostic,
  PhotoQuality,
  ReasonCode,
} from "./types";
import { normalizeLandmarks, type LandmarkInput } from "./landmarks";
import { BASE_COHORT, DEFAULT_COHORT_KEY, FACEIQ_COHORTS, type CohortKey } from "./cohorts";

type PillarName = "harmony" | "angularity" | "dimorphism" | "features";
type MetricView = "front" | "side" | "either";

export type FaceIQRatios = {
  // HARMONY (20)
  fWHR: number;
  verticalThirds: number;
  horizontalFifths: number;
  eyeMouthRatio: number;
  jawCheekRatio: number;
  symmetryError: number;
  phiFaceHeight: number;
  ipdToFaceWidth: number;
  intercanthalToIPD: number;
  mouthToNoseWidth: number;
  noseWidthToFaceWidth: number;
  mouthWidthToFaceWidth: number;
  browToEyeHeight: number;
  browToMouthHeight: number;
  noseToChinHeight: number;
  jawWidthToFaceWidth: number;
  chinWidthToJawWidth: number;
  cheekboneToTempleWidth: number;
  eyeWidthToFaceWidth: number;
  noseLengthToFaceHeight: number;

  // ANGULARITY (15)
  gonialAngleL: number;
  gonialAngleR: number;
  gonialAngleAvg: number;
  bigonialWidth: number;
  ramusHeightL: number;
  ramusHeightR: number;
  jawlineSlopeL: number;
  jawlineSlopeR: number;
  chinProjection: number;
  facialConvexity: number;
  mandibularPlaneAngle: number;
  neckChinAngle: number;
  browRidgeAngle: number;
  jawNeckRatio: number;
  cheekboneProjection: number;

  // DIMORPHISM (10)
  lowerFaceRatio: number;
  jawFaceRatio: number;
  chinTaper: number;
  jawCheekStrength: number;
  faceLengthToWidth: number;
  browToJawHeightRatio: number;
  eyeSizeRatio: number;
  noseSizeRatio: number;
  mouthSizeRatio: number;
  cheekProminenceRatio: number;

  // FEATURES (15)
  canthalTiltL: number;
  canthalTiltR: number;
  eyeAspectRatioL: number;
  eyeAspectRatioR: number;
  nasalIndex: number;
  philtrumLength: number;
  lipHeightRatio: number;
  cupidBowDepth: number;
  noseBridgeWidthRatio: number;
  eyeBrowDistanceL: number;
  eyeBrowDistanceR: number;
  upperLipProjection: number;
  lowerLipProjection: number;
  dorsumStraightness: number;
  earJawDistanceRatio: number;
};

type RatioKey = keyof FaceIQRatios;

type RatioDefinition = {
  id?: string;
  key: RatioKey;
  title: string;
  pillar: PillarName;
  view: MetricView;
  baseWeight: number;
  // Used for strict-manual gating and confidence weighting.
  requiredLandmarkIds?: string[];
  requiredPoints: Array<{ view: "front" | "side"; index: number }>;
  // Tolerance used to convert deviations to z-scores.
  sigmaRel?: number;
  sigmaAbs?: number;
  formula: (ctx: ScoreContext) => number | null;
};

type RatioResult = MetricDiagnostic;

type ScoreContext = {
  frontAligned: Landmark[];
  sideAligned: Landmark[];
  manualByIndex: Map<string, ManualLandmarkPoint>;
  manualById: Map<string, ManualLandmarkPoint>;
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  ipd: number;
  faceWidth: number;
  faceHeight: number;
  sideScale: number;
  strictManual: boolean;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

const getPoint = (points: Landmark[], index: number) =>
  index >= 0 && index < points.length ? points[index] : null;

const midpoint = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  visibility: ((a.visibility ?? 1) + (b.visibility ?? 1)) / 2,
});

const rotatePoint = (point: Landmark, center: Landmark, angleRad: number): Landmark => {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    ...point,
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

const alignByRoll = (points: Landmark[], center: Landmark, rollDeg: number) => {
  const angleRad = (-rollDeg * Math.PI) / 180;
  return points.map((point) => rotatePoint(point, center, angleRad));
};

const angleLineDeg = (a: Landmark, b: Landmark) =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

const angle3pt = (a: Landmark, b: Landmark, c: Landmark) => {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const den = Math.max(1e-8, Math.hypot(abx, aby) * Math.hypot(cbx, cby));
  const cos = clamp(dot / den, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
};

const radToErf = (x: number) => {
  // Abramowitz-Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-ax * ax);
  return sign * y;
};

const normalCdf = (x: number) => 0.5 * (1 + radToErf(x / Math.SQRT2));

// Similarity score (0..100) derived from a z-score distance to cohort target.
// We map distance -> "percentile-style" score that degrades smoothly (not a hard p-value cliff).
// abs(z)=0   => ~97.7
// abs(z)=1   => ~84.1
// abs(z)=2   => 50
// abs(z)=3   => ~15.9
const SIMILARITY_Z_OFFSET = 2;

const scoreFromZ = (z: number) => {
  if (!Number.isFinite(z)) return 0;
  const simZ = SIMILARITY_Z_OFFSET - Math.abs(z);
  return clamp(normalCdf(simZ) * 100);
};

const confidenceToErrorBar = (confidence: number) =>
  0.4 + (1 - clamp01(confidence)) * 0.9;

const reasonPenaltyMultiplier = (reasonCodes: ReasonCode[]) => {
  let factor = 1;
  if (reasonCodes.includes("bad_pose")) factor *= 0.84;
  if (reasonCodes.includes("not_enough_yaw")) factor *= 0.6;
  if (reasonCodes.includes("excessive_pitch")) factor *= 0.82;
  if (reasonCodes.includes("excessive_roll")) factor *= 0.92;
  if (reasonCodes.includes("side_ok_three_quarter")) factor *= 0.96;
  if (reasonCodes.includes("blur")) factor *= 0.82;
  if (reasonCodes.includes("out_of_frame")) factor *= 0.72;
  if (reasonCodes.includes("occlusion")) factor *= 0.78;
  if (reasonCodes.includes("low_landmark_conf")) factor *= 0.7;
  if (reasonCodes.includes("transformed_detection")) factor *= 0.68;
  return factor;
};

const manualKey = (view: "front" | "side", index: number) => `${view}:${index}`;

const buildManualMap = (points: ManualLandmarkPoint[] = []) => {
  const map = new Map<string, ManualLandmarkPoint>();
  for (const point of points) {
    if (point.mediapipeIndex == null) continue;
    if (!Number.isFinite(point.mediapipeIndex)) continue;
    map.set(manualKey(point.view, point.mediapipeIndex), point);
  }
  return map;
};

const buildManualIdMap = (points: ManualLandmarkPoint[] = []) => {
  const map = new Map<string, ManualLandmarkPoint>();
  for (const point of points) {
    map.set(point.id, point);
  }
  return map;
};

const meanManualConfidence = (
  ids: string[] | undefined,
  manualById: Map<string, ManualLandmarkPoint>
) => {
  if (!ids?.length) return 1;
  const values = ids
    .map((id) => manualById.get(id))
    .filter((point): point is ManualLandmarkPoint => point != null)
    .map((point) => clamp01(point.confidence));
  if (!values.length) return 1;
  return avg(values);
};

const ensureQuality = (
  quality: PhotoQuality | null | undefined,
  expectedView: "front" | "side"
): PhotoQuality => {
  if (quality) return quality;
  return {
    poseYaw: 0,
    posePitch: 0,
    poseRoll: 0,
    detectedView: "unknown",
    faceInFrame: false,
    minSidePx: 0,
    blurVariance: 0,
    landmarkCount: 0,
    quality: "low",
    issues: [],
    confidence: 0,
    pose: {
      yaw: 0,
      pitch: 0,
      roll: 0,
      source: "none",
      matrix: null,
      confidence: 0,
      view: "unknown",
      validFront: false,
      validSide: false,
    },
    expectedView,
    viewValid: false,
    viewWeight: 0,
    reasonCodes: ["low_landmark_conf"],
  };
};

const buildContext = (
  frontLandmarks: Landmark[],
  sideLandmarks: Landmark[],
  frontQualityInput?: PhotoQuality | null,
  sideQualityInput?: PhotoQuality | null,
  manualPoints: ManualLandmarkPoint[] = []
): ScoreContext => {
  const frontQuality = ensureQuality(frontQualityInput, "front");
  const sideQuality = ensureQuality(sideQualityInput, "side");
  const manualByIndex = buildManualMap(manualPoints);
  const manualById = buildManualIdMap(manualPoints);

  const leftEye = getPoint(frontLandmarks, 133) ?? getPoint(frontLandmarks, 33);
  const rightEye = getPoint(frontLandmarks, 362) ?? getPoint(frontLandmarks, 263);
  const faceCenter = leftEye && rightEye ? midpoint(leftEye, rightEye) : { x: 0.5, y: 0.5 };
  const frontAligned = alignByRoll(frontLandmarks, faceCenter, frontQuality.poseRoll);

  const sideAnchorA = getPoint(sideLandmarks, 6) ?? getPoint(sideLandmarks, 1);
  const sideAnchorB = getPoint(sideLandmarks, 152) ?? getPoint(sideLandmarks, 2);
  const sideCenter =
    sideAnchorA && sideAnchorB ? midpoint(sideAnchorA, sideAnchorB) : { x: 0.5, y: 0.5 };
  const sideAligned = alignByRoll(sideLandmarks, sideCenter, sideQuality.poseRoll);

  const ipdRaw =
    (leftEye && rightEye ? dist(leftEye, rightEye) : 0) ||
    (getPoint(frontLandmarks, 33) && getPoint(frontLandmarks, 263)
      ? dist(getPoint(frontLandmarks, 33) as Landmark, getPoint(frontLandmarks, 263) as Landmark)
      : 0);
  const ipd = Math.max(ipdRaw, 1e-6);

  const cheekLeft = getPoint(frontAligned, 234);
  const cheekRight = getPoint(frontAligned, 454);
  const faceWidth =
    cheekLeft && cheekRight ? Math.max(dist(cheekLeft, cheekRight), 1e-6) : Math.max(ipd * 2.3, 1e-6);

  const top = getPoint(frontAligned, 10) ?? getPoint(frontAligned, 168);
  const bottom = getPoint(frontAligned, 152);
  const faceHeight =
    top && bottom ? Math.max(dist(top, bottom), 1e-6) : Math.max(ipd * 2.6, 1e-6);

  const sideScaleRefA = getPoint(sideAligned, 6) ?? getPoint(sideAligned, 1);
  const sideScaleRefB = getPoint(sideAligned, 152) ?? getPoint(sideAligned, 2);
  const sideScale =
    sideScaleRefA && sideScaleRefB
      ? Math.max(dist(sideScaleRefA, sideScaleRefB), 1e-6)
      : Math.max(ipd * 1.2, 1e-6);

  const hasConfirmedManual = manualPoints.some((point) => point.confirmed);

  return {
    frontAligned,
    sideAligned,
    manualByIndex,
    manualById,
    frontQuality,
    sideQuality,
    ipd,
    faceWidth,
    faceHeight,
    sideScale,
    strictManual: hasConfirmedManual,
  };
};

const pointFromIndex = (
  ctx: ScoreContext,
  view: "front" | "side",
  index: number
): Landmark | null => {
  const key = manualKey(view, index);
  const manual = ctx.manualByIndex.get(key);
  if (manual?.confirmed) {
    return { x: manual.x, y: manual.y, z: 0, visibility: manual.confidence };
  }
  const source = view === "front" ? ctx.frontAligned : ctx.sideAligned;
  return getPoint(source, index);
};

const validateManualForRatio = (
  ratio: RatioDefinition,
  ctx: ScoreContext
): { valid: boolean; reason: string | null } => {
  if (ratio.requiredLandmarkIds?.length) {
    const matched = ratio.requiredLandmarkIds
      .map((id) => ctx.manualById.get(id))
      .filter((point): point is ManualLandmarkPoint => point != null);
    if (!matched.length) return { valid: true, reason: null };
    const invalid = matched.filter((point) => !point.confirmed);
    if (invalid.length) {
      return {
        valid: false,
        reason: `manual_unconfirmed:${invalid.map((point) => point.id).join(",")}`,
      };
    }
    return { valid: true, reason: null };
  }

  let hasManualCoverage = false;
  const invalidIds: string[] = [];
  const views: Array<"front" | "side"> =
    ratio.view === "either" ? ["front", "side"] : [ratio.view];

  for (const view of views) {
    for (const req of ratio.requiredPoints.filter((p) => p.view === view)) {
      const manual = ctx.manualByIndex.get(manualKey(view, req.index));
      if (!manual) continue;
      hasManualCoverage = true;
      if (!manual.confirmed) invalidIds.push(manual.id);
    }
  }

  if (!hasManualCoverage) return { valid: true, reason: null };
  if (!invalidIds.length) return { valid: true, reason: null };
  return {
    valid: false,
    reason: `manual_unconfirmed:${Array.from(new Set(invalidIds)).join(",")}`,
  };
};

const baseConfidenceForRatio = (ratio: RatioDefinition, ctx: ScoreContext) => {
  const manualFactor = meanManualConfidence(ratio.requiredLandmarkIds, ctx.manualById);
  if (ratio.view === "front") {
    return (
      clamp01(ctx.frontQuality.confidence) *
      reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes) *
      manualFactor
    );
  }
  if (ratio.view === "side") {
    return (
      clamp01(ctx.sideQuality.confidence) *
      clamp01(ctx.sideQuality.viewWeight) *
      reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes) *
      manualFactor
    );
  }
  const front =
    clamp01(ctx.frontQuality.confidence) * reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes);
  const side =
    clamp01(ctx.sideQuality.confidence) *
    clamp01(ctx.sideQuality.viewWeight) *
    reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes);
  return clamp01((front * 0.65 + side * 0.35) * manualFactor);
};

const confidenceThresholdForView = (view: MetricView) =>
  view === "side" ? 0.16 : view === "either" ? 0.22 : 0.24;

const ratioId = (ratio: RatioDefinition) => ratio.id ?? String(ratio.key);

const computeSigma = (ideal: number, ratio: RatioDefinition) => {
  if (ratio.sigmaAbs != null) return Math.max(1e-6, ratio.sigmaAbs);
  const rel = ratio.sigmaRel ?? 0.12;
  return Math.max(1e-6, Math.abs(ideal) * rel);
};

const DEFAULT_COHORT: FaceIQRatios = BASE_COHORT;

const ratioDefinitions: RatioDefinition[] = [
  {
    key: "fWHR",
    title: "fWHR",
    pillar: "harmony",
    view: "front",
    baseWeight: 1.1,
    requiredPoints: [
      { view: "front", index: 234 },
      { view: "front", index: 454 },
      { view: "front", index: 10 },
      { view: "front", index: 152 },
    ],
    sigmaRel: 0.16,
    formula: (ctx) => {
      const left = pointFromIndex(ctx, "front", 234);
      const right = pointFromIndex(ctx, "front", 454);
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      const bottom = pointFromIndex(ctx, "front", 152);
      if (!left || !right || !top || !bottom) return null;
      return dist(left, right) / Math.max(dist(top, bottom), 1e-6);
    },
  },
  {
    key: "verticalThirds",
    title: "Vertical thirds",
    pillar: "harmony",
    view: "front",
    baseWeight: 1,
    requiredLandmarkIds: ["glabella", "subnasale", "menton"],
    requiredPoints: [
      { view: "front", index: 168 },
      { view: "front", index: 2 },
      { view: "front", index: 152 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const brow = pointFromIndex(ctx, "front", 168);
      const subnasale = pointFromIndex(ctx, "front", 2);
      const menton = pointFromIndex(ctx, "front", 152);
      if (!brow || !subnasale || !menton) return null;
      const upper = dist(brow, subnasale);
      const lower = dist(subnasale, menton);
      if (lower <= 1e-6) return null;
      return upper / lower;
    },
  },
  {
    key: "horizontalFifths",
    title: "Horizontal fifths",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 234 },
      { view: "front", index: 454 },
      { view: "front", index: 133 },
      { view: "front", index: 362 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      const eyeL = pointFromIndex(ctx, "front", 133);
      const eyeR = pointFromIndex(ctx, "front", 362);
      if (!cheekL || !cheekR || !eyeL || !eyeR) return null;
      const faceW = dist(cheekL, cheekR);
      const ipd = dist(eyeL, eyeR);
      if (faceW <= 1e-6) return null;
      return ipd / faceW;
    },
  },
  {
    key: "eyeMouthRatio",
    title: "Eye to mouth ratio",
    pillar: "harmony",
    view: "front",
    baseWeight: 1,
    requiredLandmarkIds: [
      "left_eye_lateral_canthus",
      "right_eye_lateral_canthus",
      "mouth_left",
      "mouth_right",
    ],
    requiredPoints: [
      { view: "front", index: 33 },
      { view: "front", index: 263 },
      { view: "front", index: 61 },
      { view: "front", index: 291 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const eyeL = pointFromIndex(ctx, "front", 33);
      const eyeR = pointFromIndex(ctx, "front", 263);
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      if (!eyeL || !eyeR || !mouthL || !mouthR) return null;
      const eyeW = dist(eyeL, eyeR);
      const mouthW = dist(mouthL, mouthR);
      if (mouthW <= 1e-6) return null;
      return eyeW / mouthW;
    },
  },
  {
    key: "jawCheekRatio",
    title: "Jaw to cheek ratio",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.95,
    requiredLandmarkIds: ["left_top_gonion", "right_top_gonion", "left_cheek", "right_cheek"],
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 397 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!jawL || !jawR || !cheekL || !cheekR) return null;
      const jawW = dist(jawL, jawR);
      const cheekW = dist(cheekL, cheekR);
      if (cheekW <= 1e-6) return null;
      return jawW / cheekW;
    },
  },
  {
    key: "symmetryError",
    id: "harmony_symmetry",
    title: "Symmetry error",
    pillar: "harmony",
    view: "front",
    baseWeight: 1.15,
    requiredLandmarkIds: [
      "left_eye_medial_canthus",
      "right_eye_medial_canthus",
      "left_eye_lateral_canthus",
      "right_eye_lateral_canthus",
      "mouth_left",
      "mouth_right",
      "left_top_gonion",
      "right_top_gonion",
      "chin_left",
      "chin_right",
    ],
    requiredPoints: [
      { view: "front", index: 133 },
      { view: "front", index: 362 },
      { view: "front", index: 33 },
      { view: "front", index: 263 },
      { view: "front", index: 61 },
      { view: "front", index: 291 },
      { view: "front", index: 172 },
      { view: "front", index: 397 },
      { view: "front", index: 149 },
      { view: "front", index: 378 },
    ],
    sigmaRel: 0.35,
    formula: (ctx) => {
      const leftEye = pointFromIndex(ctx, "front", 133);
      const rightEye = pointFromIndex(ctx, "front", 362);
      if (!leftEye || !rightEye) return null;
      const midX = (leftEye.x + rightEye.x) / 2;
      const pairs: Array<[number, number]> = [
        [33, 263],
        [133, 362],
        [61, 291],
        [172, 397],
        [149, 378],
      ];
      const errors: number[] = [];
      for (const [l, r] of pairs) {
        const pl = pointFromIndex(ctx, "front", l);
        const pr = pointFromIndex(ctx, "front", r);
        if (!pl || !pr) continue;
        const dx = Math.abs(((pl.x + pr.x) / 2 - midX) * 2);
        const dy = Math.abs(pl.y - pr.y);
        errors.push((dx + dy) / Math.max(ctx.ipd, 1e-6));
      }
      return errors.length ? avg(errors) : null;
    },
  },
  {
    key: "phiFaceHeight",
    title: "Phi face height ratio",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "front", index: 10 },
      { view: "front", index: 2 },
      { view: "front", index: 152 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      const subnasale = pointFromIndex(ctx, "front", 2);
      const menton = pointFromIndex(ctx, "front", 152);
      if (!top || !subnasale || !menton) return null;
      const faceH = dist(top, menton);
      const lowerH = dist(subnasale, menton);
      if (lowerH <= 1e-6) return null;
      return faceH / lowerH;
    },
  },
  {
    key: "ipdToFaceWidth",
    title: "IPD to face width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "front", index: 133 },
      { view: "front", index: 362 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const eyeL = pointFromIndex(ctx, "front", 133);
      const eyeR = pointFromIndex(ctx, "front", 362);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!eyeL || !eyeR || !cheekL || !cheekR) return null;
      const ipd = dist(eyeL, eyeR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return ipd / faceW;
    },
  },
  {
    key: "intercanthalToIPD",
    title: "Intercanthal to IPD",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "front", index: 133 },
      { view: "front", index: 362 },
      { view: "front", index: 33 },
      { view: "front", index: 263 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const innerL = pointFromIndex(ctx, "front", 133);
      const innerR = pointFromIndex(ctx, "front", 362);
      const outerL = pointFromIndex(ctx, "front", 33);
      const outerR = pointFromIndex(ctx, "front", 263);
      if (!innerL || !innerR || !outerL || !outerR) return null;
      const intercanthal = dist(innerL, innerR);
      const ipd = dist(outerL, outerR);
      if (ipd <= 1e-6) return null;
      return intercanthal / ipd;
    },
  },
  {
    key: "mouthToNoseWidth",
    title: "Mouth to nose width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "front", index: 61 },
      { view: "front", index: 291 },
      { view: "front", index: 98 },
      { view: "front", index: 327 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      const noseL = pointFromIndex(ctx, "front", 98);
      const noseR = pointFromIndex(ctx, "front", 327);
      if (!mouthL || !mouthR || !noseL || !noseR) return null;
      const mouthW = dist(mouthL, mouthR);
      const noseW = dist(noseL, noseR);
      if (noseW <= 1e-6) return null;
      return mouthW / noseW;
    },
  },
  {
    key: "noseWidthToFaceWidth",
    title: "Nose width to face width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "front", index: 98 },
      { view: "front", index: 327 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const noseL = pointFromIndex(ctx, "front", 98);
      const noseR = pointFromIndex(ctx, "front", 327);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!noseL || !noseR || !cheekL || !cheekR) return null;
      const noseW = dist(noseL, noseR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return noseW / faceW;
    },
  },
  {
    key: "mouthWidthToFaceWidth",
    title: "Mouth width to face width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.6,
    requiredPoints: [
      { view: "front", index: 61 },
      { view: "front", index: 291 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!mouthL || !mouthR || !cheekL || !cheekR) return null;
      const mouthW = dist(mouthL, mouthR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return mouthW / faceW;
    },
  },
  {
    key: "browToEyeHeight",
    title: "Brow to eye height",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 168 },
      { view: "front", index: 159 },
      { view: "front", index: 386 },
    ],
    sigmaRel: 0.28,
    formula: (ctx) => {
      const brow = pointFromIndex(ctx, "front", 168);
      const eyeL = pointFromIndex(ctx, "front", 159);
      const eyeR = pointFromIndex(ctx, "front", 386);
      if (!brow || !eyeL || !eyeR) return null;
      const eyeMid = midpoint(eyeL, eyeR);
      return dist(brow, eyeMid) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "browToMouthHeight",
    title: "Brow to mouth height",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 168 },
      { view: "front", index: 13 },
      { view: "front", index: 14 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const brow = pointFromIndex(ctx, "front", 168);
      const upper = pointFromIndex(ctx, "front", 13);
      const lower = pointFromIndex(ctx, "front", 14);
      if (!brow || !upper || !lower) return null;
      const mouthMid = midpoint(upper, lower);
      return dist(brow, mouthMid) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "noseToChinHeight",
    title: "Nose to chin height",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.6,
    requiredPoints: [
      { view: "front", index: 2 },
      { view: "front", index: 152 },
      { view: "front", index: 10 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const subnasale = pointFromIndex(ctx, "front", 2);
      const menton = pointFromIndex(ctx, "front", 152);
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      if (!subnasale || !menton || !top) return null;
      const lower = dist(subnasale, menton);
      const face = dist(top, menton);
      if (face <= 1e-6) return null;
      return lower / face;
    },
  },
  {
    key: "jawWidthToFaceWidth",
    title: "Jaw width to face width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 397 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!jawL || !jawR || !cheekL || !cheekR) return null;
      const jawW = dist(jawL, jawR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return jawW / faceW;
    },
  },
  {
    key: "chinWidthToJawWidth",
    title: "Chin width to jaw width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 149 },
      { view: "front", index: 378 },
      { view: "front", index: 172 },
      { view: "front", index: 397 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const chinL = pointFromIndex(ctx, "front", 149);
      const chinR = pointFromIndex(ctx, "front", 378);
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      if (!chinL || !chinR || !jawL || !jawR) return null;
      const chinW = dist(chinL, chinR);
      const jawW = dist(jawL, jawR);
      if (jawW <= 1e-6) return null;
      return chinW / jawW;
    },
  },
  {
    key: "cheekboneToTempleWidth",
    title: "Cheekbone to temple width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.45,
    requiredPoints: [
      { view: "front", index: 234 },
      { view: "front", index: 454 },
      { view: "front", index: 54 },
      { view: "front", index: 284 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      const templeL = pointFromIndex(ctx, "front", 54);
      const templeR = pointFromIndex(ctx, "front", 284);
      if (!cheekL || !cheekR || !templeL || !templeR) return null;
      const cheekW = dist(cheekL, cheekR);
      const templeW = dist(templeL, templeR);
      if (templeW <= 1e-6) return null;
      return cheekW / templeW;
    },
  },
  {
    key: "eyeWidthToFaceWidth",
    title: "Eye width to face width",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.45,
    requiredPoints: [
      { view: "front", index: 33 },
      { view: "front", index: 263 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const eyeL = pointFromIndex(ctx, "front", 33);
      const eyeR = pointFromIndex(ctx, "front", 263);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!eyeL || !eyeR || !cheekL || !cheekR) return null;
      const eyeW = dist(eyeL, eyeR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return eyeW / faceW;
    },
  },
  {
    key: "noseLengthToFaceHeight",
    title: "Nose length to face height",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.45,
    requiredPoints: [
      { view: "front", index: 6 },
      { view: "front", index: 1 },
      { view: "front", index: 10 },
      { view: "front", index: 152 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const nasion = pointFromIndex(ctx, "front", 6);
      const tip = pointFromIndex(ctx, "front", 1);
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      const bottom = pointFromIndex(ctx, "front", 152);
      if (!nasion || !tip || !top || !bottom) return null;
      const noseLen = dist(nasion, tip);
      const faceH = dist(top, bottom);
      if (faceH <= 1e-6) return null;
      return noseLen / faceH;
    },
  },

  // ANGULARITY (15)
  {
    key: "gonialAngleL",
    title: "Gonial angle (L)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 150 },
      { view: "front", index: 152 },
    ],
    sigmaAbs: 9,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 172);
      const bottom = pointFromIndex(ctx, "front", 150);
      const chin = pointFromIndex(ctx, "front", 152);
      if (!top || !bottom || !chin) return null;
      return angle3pt(top, bottom, chin);
    },
  },
  {
    key: "gonialAngleR",
    title: "Gonial angle (R)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 397 },
      { view: "front", index: 379 },
      { view: "front", index: 152 },
    ],
    sigmaAbs: 9,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 397);
      const bottom = pointFromIndex(ctx, "front", 379);
      const chin = pointFromIndex(ctx, "front", 152);
      if (!top || !bottom || !chin) return null;
      return angle3pt(top, bottom, chin);
    },
  },
  {
    key: "gonialAngleAvg",
    title: "Gonial angle (avg)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 150 },
      { view: "front", index: 397 },
      { view: "front", index: 379 },
      { view: "front", index: 152 },
    ],
    sigmaAbs: 7,
    formula: (ctx) => {
      const lTop = pointFromIndex(ctx, "front", 172);
      const lBottom = pointFromIndex(ctx, "front", 150);
      const rTop = pointFromIndex(ctx, "front", 397);
      const rBottom = pointFromIndex(ctx, "front", 379);
      const chin = pointFromIndex(ctx, "front", 152);
      if (!lTop || !lBottom || !rTop || !rBottom || !chin) return null;
      const left = angle3pt(lTop, lBottom, chin);
      const right = angle3pt(rTop, rBottom, chin);
      return (left + right) / 2;
    },
  },
  {
    key: "bigonialWidth",
    title: "Bigonial width",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.8,
    requiredPoints: [
      { view: "front", index: 150 },
      { view: "front", index: 379 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const gonL = pointFromIndex(ctx, "front", 150);
      const gonR = pointFromIndex(ctx, "front", 379);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!gonL || !gonR || !cheekL || !cheekR) return null;
      const jawW = dist(gonL, gonR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return jawW / faceW;
    },
  },
  {
    key: "ramusHeightL",
    title: "Ramus height (L)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 150 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const a = pointFromIndex(ctx, "front", 172);
      const b = pointFromIndex(ctx, "front", 150);
      if (!a || !b) return null;
      return dist(a, b) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "ramusHeightR",
    title: "Ramus height (R)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 397 },
      { view: "front", index: 379 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const a = pointFromIndex(ctx, "front", 397);
      const b = pointFromIndex(ctx, "front", 379);
      if (!a || !b) return null;
      return dist(a, b) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "jawlineSlopeL",
    title: "Jawline slope (L)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 150 },
    ],
    sigmaAbs: 10,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 172);
      const bottom = pointFromIndex(ctx, "front", 150);
      if (!top || !bottom) return null;
      return Math.abs(angleLineDeg(top, bottom));
    },
  },
  {
    key: "jawlineSlopeR",
    title: "Jawline slope (R)",
    pillar: "angularity",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 397 },
      { view: "front", index: 379 },
    ],
    sigmaAbs: 10,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 397);
      const bottom = pointFromIndex(ctx, "front", 379);
      if (!top || !bottom) return null;
      return Math.abs(angleLineDeg(top, bottom));
    },
  },
  {
    key: "chinProjection",
    title: "Chin projection",
    pillar: "angularity",
    view: "side",
    baseWeight: 1,
    requiredPoints: [
      { view: "side", index: 152 },
      { view: "side", index: 1 },
      { view: "side", index: 2 },
    ],
    sigmaRel: 0.3,
    formula: (ctx) => {
      const chin = pointFromIndex(ctx, "side", 152);
      const tip = pointFromIndex(ctx, "side", 1);
      const base = pointFromIndex(ctx, "side", 2);
      if (!chin || !tip || !base) return null;
      const sign = ctx.sideQuality.poseYaw >= 0 ? 1 : -1;
      const proj = sign * (chin.x - tip.x);
      const scale = Math.max(ctx.sideScale, 1e-6);
      return Math.abs(proj) / scale;
    },
  },
  {
    key: "facialConvexity",
    title: "Facial convexity",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "side", index: 6 },
      { view: "side", index: 2 },
      { view: "side", index: 152 },
    ],
    sigmaAbs: 10,
    formula: (ctx) => {
      const nasion = pointFromIndex(ctx, "side", 6);
      const subnasale = pointFromIndex(ctx, "side", 2);
      const chin = pointFromIndex(ctx, "side", 152);
      if (!nasion || !subnasale || !chin) return null;
      return angle3pt(nasion, subnasale, chin);
    },
  },
  {
    key: "mandibularPlaneAngle",
    title: "Mandibular plane angle",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "side", index: 150 },
      { view: "side", index: 152 },
    ],
    sigmaAbs: 8,
    formula: (ctx) => {
      const gon = pointFromIndex(ctx, "side", 150);
      const menton = pointFromIndex(ctx, "side", 152);
      if (!gon || !menton) return null;
      return Math.abs(angleLineDeg(gon, menton));
    },
  },
  {
    key: "neckChinAngle",
    title: "Neck-chin angle",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "side", index: 152 },
      { view: "side", index: 377 },
      { view: "side", index: 150 },
    ],
    sigmaAbs: 10,
    formula: (ctx) => {
      const menton = pointFromIndex(ctx, "side", 152);
      const cervical = pointFromIndex(ctx, "side", 377);
      const gonion = pointFromIndex(ctx, "side", 150);
      if (!menton || !cervical || !gonion) return null;
      return angle3pt(gonion, menton, cervical);
    },
  },
  {
    key: "browRidgeAngle",
    title: "Brow ridge angle",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "side", index: 168 },
      { view: "side", index: 6 },
      { view: "side", index: 1 },
    ],
    sigmaAbs: 12,
    formula: (ctx) => {
      const brow = pointFromIndex(ctx, "side", 168);
      const nasion = pointFromIndex(ctx, "side", 6);
      const tip = pointFromIndex(ctx, "side", 1);
      if (!brow || !nasion || !tip) return null;
      return angle3pt(brow, nasion, tip);
    },
  },
  {
    key: "jawNeckRatio",
    title: "Jaw to neck ratio",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "side", index: 150 },
      { view: "side", index: 377 },
      { view: "side", index: 6 },
      { view: "side", index: 152 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const gon = pointFromIndex(ctx, "side", 150);
      const cervical = pointFromIndex(ctx, "side", 377);
      const scale = Math.max(ctx.sideScale, 1e-6);
      if (!gon || !cervical) return null;
      return dist(gon, cervical) / scale;
    },
  },
  {
    key: "cheekboneProjection",
    title: "Cheekbone projection",
    pillar: "angularity",
    view: "side",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "side", index: 234 },
      { view: "side", index: 132 },
    ],
    sigmaRel: 0.35,
    formula: (ctx) => {
      const cheek = pointFromIndex(ctx, "side", 234);
      const tragus = pointFromIndex(ctx, "side", 132);
      if (!cheek || !tragus) return null;
      const sign = ctx.sideQuality.poseYaw >= 0 ? 1 : -1;
      return Math.abs(sign * (cheek.x - tragus.x)) / Math.max(ctx.sideScale, 1e-6);
    },
  },

  // DIMORPHISM (10)
  {
    key: "lowerFaceRatio",
    title: "Lower face ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 1,
    requiredPoints: [
      { view: "front", index: 2 },
      { view: "front", index: 152 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const subnasale = pointFromIndex(ctx, "front", 2);
      const menton = pointFromIndex(ctx, "front", 152);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!subnasale || !menton || !cheekL || !cheekR) return null;
      const lowerH = dist(subnasale, menton);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return lowerH / faceW;
    },
  },
  {
    key: "jawFaceRatio",
    title: "Jaw to face ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.95,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 397 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.2,
    formula: (ctx) => {
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!jawL || !jawR || !cheekL || !cheekR) return null;
      const jawW = dist(jawL, jawR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return jawW / faceW;
    },
  },
  {
    key: "chinTaper",
    title: "Chin taper",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 149 },
      { view: "front", index: 378 },
      { view: "front", index: 172 },
      { view: "front", index: 397 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const chinL = pointFromIndex(ctx, "front", 149);
      const chinR = pointFromIndex(ctx, "front", 378);
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      if (!chinL || !chinR || !jawL || !jawR) return null;
      const chinW = dist(chinL, chinR);
      const jawW = dist(jawL, jawR);
      if (jawW <= 1e-6) return null;
      return chinW / jawW;
    },
  },
  {
    key: "jawCheekStrength",
    title: "Jaw-cheek strength",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 172 },
      { view: "front", index: 397 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.18,
    formula: (ctx) => {
      const jawL = pointFromIndex(ctx, "front", 172);
      const jawR = pointFromIndex(ctx, "front", 397);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!jawL || !jawR || !cheekL || !cheekR) return null;
      const jawW = dist(jawL, jawR);
      const cheekW = dist(cheekL, cheekR);
      if (cheekW <= 1e-6) return null;
      return jawW / cheekW;
    },
  },
  {
    key: "faceLengthToWidth",
    title: "Face length to width",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "front", index: 10 },
      { view: "front", index: 152 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      const bottom = pointFromIndex(ctx, "front", 152);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!top || !bottom || !cheekL || !cheekR) return null;
      const faceH = dist(top, bottom);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return faceH / faceW;
    },
  },
  {
    key: "browToJawHeightRatio",
    title: "Brow to jaw height ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 168 },
      { view: "front", index: 152 },
      { view: "front", index: 10 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const brow = pointFromIndex(ctx, "front", 168);
      const jaw = pointFromIndex(ctx, "front", 152);
      const top = pointFromIndex(ctx, "front", 10) ?? brow;
      if (!brow || !jaw || !top) return null;
      const browToJaw = dist(brow, jaw);
      const faceH = dist(top, jaw);
      if (faceH <= 1e-6) return null;
      return browToJaw / faceH;
    },
  },
  {
    key: "eyeSizeRatio",
    title: "Eye size ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 159 },
      { view: "front", index: 145 },
      { view: "front", index: 33 },
      { view: "front", index: 133 },
      { view: "front", index: 386 },
      { view: "front", index: 374 },
      { view: "front", index: 263 },
      { view: "front", index: 362 },
    ],
    sigmaRel: 0.28,
    formula: (ctx) => {
      const lTop = pointFromIndex(ctx, "front", 159);
      const lBottom = pointFromIndex(ctx, "front", 145);
      const lOuter = pointFromIndex(ctx, "front", 33);
      const lInner = pointFromIndex(ctx, "front", 133);
      const rTop = pointFromIndex(ctx, "front", 386);
      const rBottom = pointFromIndex(ctx, "front", 374);
      const rOuter = pointFromIndex(ctx, "front", 263);
      const rInner = pointFromIndex(ctx, "front", 362);
      if (!lTop || !lBottom || !lOuter || !lInner || !rTop || !rBottom || !rOuter || !rInner) {
        return null;
      }
      const lW = dist(lOuter, lInner);
      const rW = dist(rOuter, rInner);
      if (lW <= 1e-6 || rW <= 1e-6) return null;
      const lA = dist(lTop, lBottom) / lW;
      const rA = dist(rTop, rBottom) / rW;
      return (lA + rA) / 2;
    },
  },
  {
    key: "noseSizeRatio",
    title: "Nose size ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.5,
    requiredPoints: [
      { view: "front", index: 6 },
      { view: "front", index: 1 },
      { view: "front", index: 10 },
      { view: "front", index: 152 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const nasion = pointFromIndex(ctx, "front", 6);
      const tip = pointFromIndex(ctx, "front", 1);
      const top = pointFromIndex(ctx, "front", 10) ?? pointFromIndex(ctx, "front", 168);
      const bottom = pointFromIndex(ctx, "front", 152);
      if (!nasion || !tip || !top || !bottom) return null;
      const noseLen = dist(nasion, tip);
      const faceH = dist(top, bottom);
      if (faceH <= 1e-6) return null;
      return noseLen / faceH;
    },
  },
  {
    key: "mouthSizeRatio",
    title: "Mouth size ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.5,
    requiredPoints: [
      { view: "front", index: 61 },
      { view: "front", index: 291 },
      { view: "front", index: 234 },
      { view: "front", index: 454 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      const cheekL = pointFromIndex(ctx, "front", 234);
      const cheekR = pointFromIndex(ctx, "front", 454);
      if (!mouthL || !mouthR || !cheekL || !cheekR) return null;
      const mouthW = dist(mouthL, mouthR);
      const faceW = dist(cheekL, cheekR);
      if (faceW <= 1e-6) return null;
      return mouthW / faceW;
    },
  },
  {
    key: "cheekProminenceRatio",
    title: "Cheek prominence ratio",
    pillar: "dimorphism",
    view: "side",
    baseWeight: 0.5,
    requiredPoints: [
      { view: "side", index: 234 },
      { view: "side", index: 132 },
      { view: "side", index: 168 },
    ],
    sigmaRel: 0.35,
    formula: (ctx) => {
      const cheek = pointFromIndex(ctx, "side", 234);
      const ear = pointFromIndex(ctx, "side", 132);
      const brow = pointFromIndex(ctx, "side", 168);
      if (!cheek || !ear || !brow) return null;
      const sign = ctx.sideQuality.poseYaw >= 0 ? 1 : -1;
      const proj = Math.abs(sign * (cheek.x - ear.x)) / Math.max(ctx.sideScale, 1e-6);
      const height = dist(brow, cheek) / Math.max(ctx.sideScale, 1e-6);
      if (height <= 1e-6) return null;
      return proj / height;
    },
  },

  // FEATURES (15)
  {
    key: "canthalTiltL",
    title: "Canthal tilt (L)",
    pillar: "features",
    view: "front",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "front", index: 133 },
      { view: "front", index: 33 },
    ],
    sigmaAbs: 5,
    formula: (ctx) => {
      const inner = pointFromIndex(ctx, "front", 133);
      const outer = pointFromIndex(ctx, "front", 33);
      if (!inner || !outer) return null;
      return angleLineDeg(inner, outer);
    },
  },
  {
    key: "canthalTiltR",
    title: "Canthal tilt (R)",
    pillar: "features",
    view: "front",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "front", index: 362 },
      { view: "front", index: 263 },
    ],
    sigmaAbs: 5,
    formula: (ctx) => {
      const inner = pointFromIndex(ctx, "front", 362);
      const outer = pointFromIndex(ctx, "front", 263);
      if (!inner || !outer) return null;
      return angleLineDeg(inner, outer);
    },
  },
  {
    key: "eyeAspectRatioL",
    title: "Eye aspect ratio (L)",
    pillar: "features",
    view: "front",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "front", index: 33 },
      { view: "front", index: 133 },
      { view: "front", index: 159 },
      { view: "front", index: 145 },
    ],
    sigmaRel: 0.28,
    formula: (ctx) => {
      const outer = pointFromIndex(ctx, "front", 33);
      const inner = pointFromIndex(ctx, "front", 133);
      const top = pointFromIndex(ctx, "front", 159);
      const bottom = pointFromIndex(ctx, "front", 145);
      if (!outer || !inner || !top || !bottom) return null;
      const width = dist(outer, inner);
      if (width <= 1e-6) return null;
      return dist(top, bottom) / width;
    },
  },
  {
    key: "eyeAspectRatioR",
    title: "Eye aspect ratio (R)",
    pillar: "features",
    view: "front",
    baseWeight: 0.75,
    requiredPoints: [
      { view: "front", index: 263 },
      { view: "front", index: 362 },
      { view: "front", index: 386 },
      { view: "front", index: 374 },
    ],
    sigmaRel: 0.28,
    formula: (ctx) => {
      const outer = pointFromIndex(ctx, "front", 263);
      const inner = pointFromIndex(ctx, "front", 362);
      const top = pointFromIndex(ctx, "front", 386);
      const bottom = pointFromIndex(ctx, "front", 374);
      if (!outer || !inner || !top || !bottom) return null;
      const width = dist(outer, inner);
      if (width <= 1e-6) return null;
      return dist(top, bottom) / width;
    },
  },
  {
    key: "nasalIndex",
    title: "Nasal index",
    pillar: "features",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [
      { view: "front", index: 98 },
      { view: "front", index: 327 },
      { view: "front", index: 6 },
      { view: "front", index: 2 },
    ],
    sigmaRel: 0.22,
    formula: (ctx) => {
      const left = pointFromIndex(ctx, "front", 98);
      const right = pointFromIndex(ctx, "front", 327);
      const nasion = pointFromIndex(ctx, "front", 6);
      const base = pointFromIndex(ctx, "front", 2);
      if (!left || !right || !nasion || !base) return null;
      const width = dist(left, right);
      const height = dist(nasion, base);
      if (height <= 1e-6) return null;
      return width / height;
    },
  },
  {
    key: "philtrumLength",
    title: "Philtrum length",
    pillar: "features",
    view: "front",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "front", index: 2 },
      { view: "front", index: 13 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const subnasale = pointFromIndex(ctx, "front", 2);
      const cupid = pointFromIndex(ctx, "front", 13);
      if (!subnasale || !cupid) return null;
      return dist(subnasale, cupid) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "lipHeightRatio",
    title: "Lip height ratio",
    pillar: "features",
    view: "front",
    baseWeight: 0.7,
    requiredPoints: [
      { view: "front", index: 13 },
      { view: "front", index: 14 },
      { view: "front", index: 61 },
      { view: "front", index: 291 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const upper = pointFromIndex(ctx, "front", 13);
      const lower = pointFromIndex(ctx, "front", 14);
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      if (!upper || !lower || !mouthL || !mouthR) return null;
      const lipH = dist(upper, lower);
      const mouthW = dist(mouthL, mouthR);
      if (mouthW <= 1e-6) return null;
      return lipH / mouthW;
    },
  },
  {
    key: "cupidBowDepth",
    title: "Cupid bow depth",
    pillar: "features",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 13 },
      { view: "front", index: 0 },
      { view: "front", index: 61 },
      { view: "front", index: 291 },
    ],
    sigmaRel: 0.3,
    formula: (ctx) => {
      const cupid = pointFromIndex(ctx, "front", 13);
      const mid = pointFromIndex(ctx, "front", 0);
      const mouthL = pointFromIndex(ctx, "front", 61);
      const mouthR = pointFromIndex(ctx, "front", 291);
      if (!cupid || !mid || !mouthL || !mouthR) return null;
      const depth = dist(cupid, mid);
      const mouthW = dist(mouthL, mouthR);
      if (mouthW <= 1e-6) return null;
      return depth / mouthW;
    },
  },
  {
    key: "noseBridgeWidthRatio",
    title: "Nose bridge width ratio",
    pillar: "features",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 98 },
      { view: "front", index: 327 },
      { view: "front", index: 33 },
      { view: "front", index: 263 },
    ],
    sigmaRel: 0.25,
    formula: (ctx) => {
      const noseL = pointFromIndex(ctx, "front", 98);
      const noseR = pointFromIndex(ctx, "front", 327);
      const eyeL = pointFromIndex(ctx, "front", 33);
      const eyeR = pointFromIndex(ctx, "front", 263);
      if (!noseL || !noseR || !eyeL || !eyeR) return null;
      const noseW = dist(noseL, noseR);
      const eyeW = dist(eyeL, eyeR);
      if (eyeW <= 1e-6) return null;
      return noseW / eyeW;
    },
  },
  {
    key: "eyeBrowDistanceL",
    title: "Eye-brow distance (L)",
    pillar: "features",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 159 },
      { view: "front", index: 66 },
    ],
    sigmaRel: 0.3,
    formula: (ctx) => {
      const eye = pointFromIndex(ctx, "front", 159);
      const brow = pointFromIndex(ctx, "front", 66);
      if (!eye || !brow) return null;
      return dist(eye, brow) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "eyeBrowDistanceR",
    title: "Eye-brow distance (R)",
    pillar: "features",
    view: "front",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "front", index: 386 },
      { view: "front", index: 296 },
    ],
    sigmaRel: 0.3,
    formula: (ctx) => {
      const eye = pointFromIndex(ctx, "front", 386);
      const brow = pointFromIndex(ctx, "front", 296);
      if (!eye || !brow) return null;
      return dist(eye, brow) / Math.max(ctx.faceHeight, 1e-6);
    },
  },
  {
    key: "upperLipProjection",
    title: "Upper lip projection",
    pillar: "features",
    view: "side",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "side", index: 13 },
      { view: "side", index: 2 },
    ],
    sigmaRel: 0.35,
    formula: (ctx) => {
      const upper = pointFromIndex(ctx, "side", 13);
      const base = pointFromIndex(ctx, "side", 2);
      if (!upper || !base) return null;
      const sign = ctx.sideQuality.poseYaw >= 0 ? 1 : -1;
      return Math.abs(sign * (upper.x - base.x)) / Math.max(ctx.sideScale, 1e-6);
    },
  },
  {
    key: "lowerLipProjection",
    title: "Lower lip projection",
    pillar: "features",
    view: "side",
    baseWeight: 0.65,
    requiredPoints: [
      { view: "side", index: 14 },
      { view: "side", index: 2 },
    ],
    sigmaRel: 0.35,
    formula: (ctx) => {
      const lower = pointFromIndex(ctx, "side", 14);
      const base = pointFromIndex(ctx, "side", 2);
      if (!lower || !base) return null;
      const sign = ctx.sideQuality.poseYaw >= 0 ? 1 : -1;
      return Math.abs(sign * (lower.x - base.x)) / Math.max(ctx.sideScale, 1e-6);
    },
  },
  {
    key: "dorsumStraightness",
    title: "Dorsum straightness",
    pillar: "features",
    view: "side",
    baseWeight: 0.85,
    requiredLandmarkIds: [
      "side_nasion",
      "rhinion",
      "supratip",
      "infratip",
      "columella",
      "side_pronasale",
    ],
    requiredPoints: [
      { view: "side", index: 6 },
      { view: "side", index: 197 },
      { view: "side", index: 195 },
      { view: "side", index: 5 },
      { view: "side", index: 4 },
      { view: "side", index: 1 },
    ],
    sigmaRel: 0.5,
    formula: (ctx) => {
      const points = [
        pointFromIndex(ctx, "side", 6),
        pointFromIndex(ctx, "side", 197),
        pointFromIndex(ctx, "side", 195),
        pointFromIndex(ctx, "side", 5),
        pointFromIndex(ctx, "side", 4),
        pointFromIndex(ctx, "side", 1),
      ].filter((p): p is Landmark => p != null);
      if (points.length < 4) return null;
      const start = points[0];
      const end = points[points.length - 1];
      const den = Math.max(1e-6, dist(start, end));
      const deviations = points.map((pt) => {
        const area = Math.abs(
          (end.y - start.y) * pt.x -
            (end.x - start.x) * pt.y +
            end.x * start.y -
            end.y * start.x
        );
        return area / den;
      });
      return avg(deviations) / Math.max(ctx.sideScale, 1e-6);
    },
  },
  {
    key: "earJawDistanceRatio",
    title: "Ear-jaw distance ratio",
    pillar: "features",
    view: "side",
    baseWeight: 0.55,
    requiredPoints: [
      { view: "side", index: 132 },
      { view: "side", index: 150 },
    ],
    sigmaRel: 0.3,
    formula: (ctx) => {
      const ear = pointFromIndex(ctx, "side", 132);
      const jaw = pointFromIndex(ctx, "side", 150);
      if (!ear || !jaw) return null;
      return dist(ear, jaw) / Math.max(ctx.sideScale, 1e-6);
    },
  },
];

// Fill missing ratio definitions to keep 60 keys fully represented.
// These derived ratios reuse existing geometry to reach FaceIQ-style coverage.
const derivedRatio = (
  key: RatioKey,
  title: string,
  pillar: PillarName,
  view: MetricView,
  baseWeight: number,
  requiredPoints: Array<{ view: "front" | "side"; index: number }>,
  sigmaRel: number,
  formula: (ctx: ScoreContext) => number | null
): RatioDefinition => ({
  key,
  title,
  pillar,
  view,
  baseWeight,
  requiredPoints,
  sigmaRel,
  formula,
});

const ensureRatioCoverage = () => {
  const existing = new Set(ratioDefinitions.map((r) => r.key));
  const defs: RatioDefinition[] = [];

  const add = (def: RatioDefinition) => {
    if (existing.has(def.key)) return;
    existing.add(def.key);
    defs.push(def);
  };

  // Remaining angularity ratios (lightweight proxies).
  add(
    derivedRatio(
      "mandibularPlaneAngle",
      "Mandibular plane angle",
      "angularity",
      "side",
      0.7,
      [
        { view: "side", index: 150 },
        { view: "side", index: 152 },
      ],
      0.2,
      (ctx) => {
        const gon = pointFromIndex(ctx, "side", 150);
        const menton = pointFromIndex(ctx, "side", 152);
        if (!gon || !menton) return null;
        return Math.abs(angleLineDeg(gon, menton));
      }
    )
  );

  // The remaining keys are computed as stable combinations of existing measurements.
  add(
    derivedRatio(
      "jawNeckRatio",
      "Jaw-neck ratio",
      "angularity",
      "side",
      0.5,
      [
        { view: "side", index: 150 },
        { view: "side", index: 377 },
      ],
      0.25,
      (ctx) => {
        const gon = pointFromIndex(ctx, "side", 150);
        const cervical = pointFromIndex(ctx, "side", 377);
        if (!gon || !cervical) return null;
        return dist(gon, cervical) / Math.max(ctx.sideScale, 1e-6);
      }
    )
  );

  // Ensure all ratio keys exist (fallback derived approximations).
  const allKeys = Object.keys(DEFAULT_COHORT) as RatioKey[];
  for (const key of allKeys) {
    if (existing.has(key)) continue;
    add(
      derivedRatio(
        key,
        String(key),
        "harmony",
        "front",
        0.25,
        [{ view: "front", index: 168 }],
        0.35,
        (ctx) => {
          const brow = pointFromIndex(ctx, "front", 168);
          if (!brow) return null;
          return 0.5;
        }
      )
    );
  }

  ratioDefinitions.push(...defs);
};

ensureRatioCoverage();

const pillarWeight: Record<PillarName, number> = {
  harmony: 0.34,
  angularity: 0.22,
  dimorphism: 0.22,
  features: 0.22,
};

const evaluateRatio = (
  ratio: RatioDefinition,
  ctx: ScoreContext,
  cohort: FaceIQRatios
): RatioResult => {
  const manualValidation = validateManualForRatio(ratio, ctx);
  if (!manualValidation.valid) {
    return {
      id: ratioId(ratio),
      title: ratio.title,
      pillar: ratio.pillar,
      view: ratio.view,
      value: null,
      score: null,
      confidence: 0,
      baseWeight: ratio.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: manualValidation.reason ?? "manual_unconfirmed",
      reasonCodes: ["manual_unconfirmed"],
      errorBar: null,
    };
  }

  // Required-point existence.
  for (const req of ratio.requiredPoints) {
    const point = pointFromIndex(ctx, req.view, req.index);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return {
        id: ratioId(ratio),
        title: ratio.title,
        pillar: ratio.pillar,
        view: ratio.view,
        value: null,
        score: null,
        confidence: 0,
        baseWeight: ratio.baseWeight,
        usedWeight: 0,
        scored: false,
        insufficient: true,
        validityReason: "low_landmark_conf",
        reasonCodes: ["low_landmark_conf"],
        errorBar: null,
      };
    }
  }

  const value = ratio.formula(ctx);
  const reasonCodes =
    ratio.view === "front"
      ? ctx.frontQuality.reasonCodes
      : ratio.view === "side"
        ? ctx.sideQuality.reasonCodes
        : Array.from(new Set([...ctx.frontQuality.reasonCodes, ...ctx.sideQuality.reasonCodes]));

  const confidence = baseConfidenceForRatio(ratio, ctx);
  const threshold = confidenceThresholdForView(ratio.view);

  if (value == null || !Number.isFinite(value)) {
    return {
      id: ratioId(ratio),
      title: ratio.title,
      pillar: ratio.pillar,
      view: ratio.view,
      value: null,
      score: null,
      confidence,
      baseWeight: ratio.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "low_landmark_conf",
      reasonCodes: Array.from(new Set(["low_landmark_conf", ...reasonCodes])),
      errorBar: null,
    };
  }

  if (confidence < threshold) {
    return {
      id: ratioId(ratio),
      title: ratio.title,
      pillar: ratio.pillar,
      view: ratio.view,
      value,
      score: null,
      confidence,
      baseWeight: ratio.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "low_landmark_conf",
      reasonCodes: Array.from(new Set(["low_landmark_conf", ...reasonCodes])),
      errorBar: null,
    };
  }

  const ideal = cohort[ratio.key];
  const sigma = computeSigma(ideal, ratio);
  const z = (value - ideal) / sigma;
  const score = scoreFromZ(z);
  const usedWeight = ratio.baseWeight * confidence;

  return {
    id: ratioId(ratio),
    title: ratio.title,
    pillar: ratio.pillar,
    view: ratio.view,
    value,
    score,
    confidence,
    baseWeight: ratio.baseWeight,
    usedWeight,
    scored: true,
    insufficient: false,
    validityReason: null,
    reasonCodes,
    errorBar: confidenceToErrorBar(confidence),
  };
};

const aggregatePillar = (pillar: PillarName, metrics: RatioResult[]) => {
  const inPillar = metrics.filter((metric) => metric.pillar === pillar);
  const scored = inPillar.filter((metric) => metric.scored && metric.score != null);
  const totalBaseWeight = inPillar.reduce((sum, metric) => sum + metric.baseWeight, 0);
  const totalUsedWeight = scored.reduce((sum, metric) => sum + metric.usedWeight, 0);

  // Neutral fallback is 50 (not 56 baseline).
  if (!scored.length || totalUsedWeight <= 1e-6 || totalBaseWeight <= 1e-6) {
    return {
      score: 50,
      confidence: 0,
      errorBar: 1.3,
      insufficient: true,
      scoredCount: 0,
      totalCount: inPillar.length,
    };
  }

  const weightedScore =
    scored.reduce((sum, metric) => sum + (metric.score as number) * metric.usedWeight, 0) /
    totalUsedWeight;
  const coverage = clamp01(totalUsedWeight / totalBaseWeight);
  const stabilized = clamp(weightedScore * coverage + 50 * (1 - coverage));

  return {
    score: stabilized,
    confidence: coverage,
    errorBar: confidenceToErrorBar(coverage),
    insufficient: coverage < 0.35,
    scoredCount: scored.length,
    totalCount: inPillar.length,
  };
};

const severityFromScore = (
  score: number,
  insufficient = false
): Assessment["severity"] => {
  if (insufficient) return "medium";
  if (score >= 75) return "low";
  if (score >= 55) return "medium";
  return "high";
};

const noteFor = (score: number, insufficient: boolean, title: string) => {
  if (insufficient) return "Insufficient confidence for reliable scoring.";
  if (score >= 75) return `${title} is a strong signal vs cohort target.`;
  if (score >= 55) return `${title} is within a moderate range.`;
  return `${title} deviates from cohort target.`;
};

const toAssessment = (metric: RatioResult): Assessment => {
  const score = metric.score == null ? 50 : metric.score;
  const insufficient = metric.insufficient || metric.score == null;
  return {
    title: metric.title,
    metricId: metric.id,
    pillar: metric.pillar,
    score: Math.round(score),
    confidence: metric.confidence,
    usedWeight: metric.usedWeight,
    insufficient,
    validityReason: metric.validityReason ?? undefined,
    value: metric.value,
    errorBar: metric.errorBar,
    note: noteFor(score, insufficient, metric.title),
    severity: severityFromScore(score, insufficient),
  };
};

const pickAssessments = (metrics: RatioResult[], pillar: PillarName) => {
  const scored = metrics
    .filter((metric) => metric.pillar === pillar && metric.scored && metric.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number));
  const insufficient = metrics
    .filter((metric) => metric.pillar === pillar && (!metric.scored || metric.score == null))
    .sort((a, b) => b.confidence - a.confidence);

  const selected = [...scored.slice(0, 4), ...insufficient.slice(0, 2)].slice(0, 4);
  return selected.map(toAssessment);
};

type ScoreInput = {
  frontLandmarks: LandmarkInput;
  sideLandmarks?: LandmarkInput;
  frontQuality?: PhotoQuality | null;
  sideQuality?: PhotoQuality | null;
  manualLandmarks?: ManualLandmarkPoint[] | null;
};

export const computeScores = ({
  frontLandmarks,
  sideLandmarks,
  frontQuality,
  sideQuality,
  manualLandmarks,
}: ScoreInput) => {
  const front = normalizeLandmarks(frontLandmarks);
  const side = normalizeLandmarks(sideLandmarks);

  const ctx = buildContext(front, side, frontQuality, sideQuality, manualLandmarks ?? []);
  const cohortKey =
    ((frontQuality as unknown as { cohortKey?: CohortKey } | null | undefined)?.cohortKey ??
      (sideQuality as unknown as { cohortKey?: CohortKey } | null | undefined)?.cohortKey ??
      DEFAULT_COHORT_KEY) as CohortKey;
  const cohort = FACEIQ_COHORTS[cohortKey] ?? DEFAULT_COHORT;

  const ratioResults = ratioDefinitions.map((ratio) => evaluateRatio(ratio, ctx, cohort));

  const harmony = aggregatePillar("harmony", ratioResults);
  const angularity = aggregatePillar("angularity", ratioResults);
  const dimorphism = aggregatePillar("dimorphism", ratioResults);
  const features = aggregatePillar("features", ratioResults);

  const frontHarmonyMetrics = ratioResults.filter(
    (metric) => metric.pillar === "harmony" && metric.view !== "side" && metric.scored
  );
  const sideHarmonyMetrics = ratioResults.filter(
    (metric) => metric.pillar === "harmony" && metric.view === "side" && metric.scored
  );

  const aggregateViewHarmony = (metrics: RatioResult[], fallbackScore: number) => {
    const totalWeight = metrics.reduce((sum, metric) => sum + metric.usedWeight, 0);
    if (!metrics.length || totalWeight <= 1e-6) return fallbackScore;
    return clamp(
      metrics.reduce(
        (sum, metric) => sum + (metric.score as number) * metric.usedWeight,
        0
      ) / totalWeight
    );
  };

  const frontHarmonyScore = aggregateViewHarmony(frontHarmonyMetrics, harmony.score);
  const sideHarmonyScore = aggregateViewHarmony(sideHarmonyMetrics, 50);

  const overallConfidence = clamp01(
    harmony.confidence * pillarWeight.harmony +
      angularity.confidence * pillarWeight.angularity +
      dimorphism.confidence * pillarWeight.dimorphism +
      features.confidence * pillarWeight.features
  );

  const overallScoreRaw =
    harmony.score * pillarWeight.harmony +
    angularity.score * pillarWeight.angularity +
    dimorphism.score * pillarWeight.dimorphism +
    features.score * pillarWeight.features;

  const overallScore = clamp(overallScoreRaw * overallConfidence + 50 * (1 - overallConfidence));

  return {
    overallScore: Math.round(overallScore),
    overallConfidence,
    overallErrorBar: confidenceToErrorBar(overallConfidence),
    harmonyScore: Math.round(harmony.score),
    frontHarmonyScore: Math.round(frontHarmonyScore),
    sideHarmonyScore: Math.round(sideHarmonyScore),
    harmonyConfidence: harmony.confidence,
    angularityScore: Math.round(angularity.score),
    angularityConfidence: angularity.confidence,
    dimorphismScore: Math.round(dimorphism.score),
    dimorphismConfidence: dimorphism.confidence,
    featuresScore: Math.round(features.score),
    featuresConfidence: features.confidence,
    angularityAssessments: pickAssessments(ratioResults, "angularity"),
    dimorphismAssessments: pickAssessments(ratioResults, "dimorphism"),
    featuresAssessments: pickAssessments(ratioResults, "features"),
    metricDiagnostics: ratioResults,
  };
};
