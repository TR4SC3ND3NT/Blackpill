import type {
  Assessment,
  Landmark,
  MetricDiagnostic,
  PhotoQuality,
  ReasonCode,
} from "./types";
import { normalizeLandmarks, type LandmarkInput } from "./landmarks";

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

const severityFromScore = (
  score: number,
  insufficient = false
): Assessment["severity"] => {
  if (insufficient) return "medium";
  if (score >= 75) return "low";
  if (score >= 55) return "medium";
  return "high";
};

const noteFor = (
  score: number,
  insufficient: boolean,
  high: string,
  mid: string,
  low: string
) => {
  if (insufficient) return "Insufficient confidence for reliable scoring.";
  if (score >= 75) return high;
  if (score >= 55) return mid;
  return low;
};

type ScoreBand = {
  min: number;
  optMin: number;
  optMax: number;
  max: number;
};

const scoreFromBand = (value: number, band: ScoreBand) => {
  if (!Number.isFinite(value)) return 0;
  if (value < band.min || value > band.max) return 0;
  if (value >= band.optMin && value <= band.optMax) return 100;

  if (value < band.optMin) {
    const den = Math.max(1e-6, band.optMin - band.min);
    return clamp(((value - band.min) / den) * 100);
  }

  const den = Math.max(1e-6, band.max - band.optMax);
  return clamp(((band.max - value) / den) * 100);
};

const confidenceToErrorBar = (confidence: number) =>
  0.35 + (1 - clamp01(confidence)) * 0.95;

const FRONT_MIRROR_PAIRS: Array<[number, number]> = [
  [33, 263],
  [133, 362],
  [61, 291],
  [172, 397],
  [58, 288],
  [150, 379],
  [93, 323],
  [132, 361],
];

const reasonPenaltyMultiplier = (reasonCodes: ReasonCode[]) => {
  let factor = 1;
  if (reasonCodes.includes("bad_pose")) factor *= 0.84;
  if (reasonCodes.includes("blur")) factor *= 0.82;
  if (reasonCodes.includes("out_of_frame")) factor *= 0.72;
  if (reasonCodes.includes("occlusion")) factor *= 0.78;
  if (reasonCodes.includes("low_landmark_conf")) factor *= 0.7;
  if (reasonCodes.includes("transformed_detection")) factor *= 0.68;
  return factor;
};

type PillarName = "harmony" | "angularity" | "dimorphism" | "features";
type MetricView = "front" | "side" | "either";

type MetricDefinition = {
  id: string;
  title: string;
  pillar: PillarName;
  view: MetricView;
  baseWeight: number;
  requiredPoints: number[];
  band: ScoreBand;
  notes: [string, string, string];
  formula: (ctx: ScoreContext) => number | null;
};

type MetricResult = MetricDiagnostic;

type ScoreContext = {
  front: Landmark[];
  side: Landmark[];
  frontAligned: Landmark[];
  sideAligned: Landmark[];
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  ipd: number;
  frontFaceWidth: number;
  frontLowerFaceHeight: number;
  sideScale: number;
};

const defaultQuality = (expectedView: "front" | "side"): PhotoQuality => ({
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
  reasonCodes: ["low_landmark_conf"],
});

const ensureQuality = (
  quality: PhotoQuality | null | undefined,
  expectedView: "front" | "side"
): PhotoQuality => quality ?? defaultQuality(expectedView);

const pointVisibilityFactor = (points: Landmark[], indices: number[]) => {
  if (!indices.length) return 1;
  const vis = indices
    .map((index) => {
      const point = getPoint(points, index);
      if (!point) return 0;
      const v = point.visibility;
      return v == null ? 1 : clamp01(v);
    })
    .filter(Number.isFinite);
  return vis.length ? avg(vis) : 0;
};

const metricBaseConfidence = (
  view: MetricView,
  ctx: ScoreContext,
  requiredPoints: number[]
) => {
  const frontPoints = pointVisibilityFactor(ctx.frontAligned, requiredPoints);
  const sidePoints = pointVisibilityFactor(ctx.sideAligned, requiredPoints);

  if (view === "front") {
    return (
      clamp01(ctx.frontQuality.confidence) *
      reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes) *
      frontPoints
    );
  }

  if (view === "side") {
    return (
      clamp01(ctx.sideQuality.confidence) *
      reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes) *
      sidePoints
    );
  }

  const front =
    clamp01(ctx.frontQuality.confidence) *
    reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes) *
    frontPoints;
  const side =
    clamp01(ctx.sideQuality.confidence) *
    reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes) *
    sidePoints;
  return clamp01(front * 0.65 + side * 0.35);
};

const hasRequiredPoints = (points: Landmark[], indices: number[]) =>
  indices.every((index) => {
    const point = getPoint(points, index);
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
  });

const profileDirectionAwareDelta = (a: Landmark, b: Landmark, yaw: number) => {
  const sign = yaw >= 0 ? 1 : -1;
  return sign * (a.x - b.x);
};

const lineDeviation = (points: Landmark[], start: Landmark, end: Landmark, scale: number) => {
  const den = Math.max(1e-6, dist(start, end));
  const deviations = points.map((point) => {
    const area = Math.abs(
      (end.y - start.y) * point.x -
        (end.x - start.x) * point.y +
        end.x * start.y -
        end.y * start.x
    );
    return area / den;
  });
  return avg(deviations) / Math.max(scale, 1e-6);
};

const angleDeg = (a: Landmark, b: Landmark) =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

const metricDefinitions: MetricDefinition[] = [
  {
    id: "harmony_symmetry",
    title: "Symmetry",
    pillar: "harmony",
    view: "front",
    baseWeight: 1.4,
    requiredPoints: FRONT_MIRROR_PAIRS.flat(),
    band: { min: 0, optMin: 0, optMax: 0.04, max: 0.2 },
    notes: [
      "Left-right balance is strong.",
      "Symmetry is moderately balanced.",
      "Symmetry drift detected.",
    ],
    formula: (ctx) => {
      const leftEye = getPoint(ctx.frontAligned, 133);
      const rightEye = getPoint(ctx.frontAligned, 362);
      if (!leftEye || !rightEye) return null;
      const midX = (leftEye.x + rightEye.x) / 2;
      const errors = FRONT_MIRROR_PAIRS.map(([leftIndex, rightIndex]) => {
        const left = getPoint(ctx.frontAligned, leftIndex);
        const right = getPoint(ctx.frontAligned, rightIndex);
        if (!left || !right) return null;
        const dx = Math.abs(((left.x + right.x) / 2 - midX) * 2);
        const dy = Math.abs(left.y - right.y);
        return (dx + dy) / Math.max(ctx.ipd, 1e-6);
      }).filter((value): value is number => value != null);
      return errors.length ? avg(errors) : null;
    },
  },
  {
    id: "harmony_vertical_balance",
    title: "Vertical thirds",
    pillar: "harmony",
    view: "front",
    baseWeight: 1.1,
    requiredPoints: [168, 2, 152],
    band: { min: 0.55, optMin: 0.8, optMax: 1.15, max: 1.7 },
    notes: [
      "Vertical proportions are balanced.",
      "Vertical proportions are acceptable.",
      "Vertical proportion drift detected.",
    ],
    formula: (ctx) => {
      const brow = getPoint(ctx.frontAligned, 168);
      const noseBase = getPoint(ctx.frontAligned, 2);
      const chin = getPoint(ctx.frontAligned, 152);
      if (!brow || !noseBase || !chin) return null;
      const upper = dist(brow, noseBase);
      const lower = dist(noseBase, chin);
      if (lower <= 1e-6) return null;
      return upper / lower;
    },
  },
  {
    id: "harmony_jaw_cheek",
    title: "Jaw to cheekbone",
    pillar: "harmony",
    view: "front",
    baseWeight: 1,
    requiredPoints: [172, 397, 234, 454],
    band: { min: 0.6, optMin: 0.78, optMax: 0.96, max: 1.18 },
    notes: [
      "Jaw-cheek proportion is balanced.",
      "Jaw-cheek proportion is moderate.",
      "Jaw-cheek proportion appears imbalanced.",
    ],
    formula: (ctx) => {
      const jawLeft = getPoint(ctx.frontAligned, 172);
      const jawRight = getPoint(ctx.frontAligned, 397);
      const cheekLeft = getPoint(ctx.frontAligned, 234);
      const cheekRight = getPoint(ctx.frontAligned, 454);
      if (!jawLeft || !jawRight || !cheekLeft || !cheekRight) return null;
      const jaw = dist(jawLeft, jawRight);
      const cheek = dist(cheekLeft, cheekRight);
      if (cheek <= 1e-6) return null;
      return jaw / cheek;
    },
  },
  {
    id: "harmony_eye_mouth",
    title: "Eye to mouth ratio",
    pillar: "harmony",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [133, 362, 61, 291],
    band: { min: 0.55, optMin: 0.75, optMax: 1.1, max: 1.5 },
    notes: [
      "Eye-mouth ratio is balanced.",
      "Eye-mouth ratio is near neutral.",
      "Eye-mouth ratio is outside stable range.",
    ],
    formula: (ctx) => {
      const eyeLeft = getPoint(ctx.frontAligned, 133);
      const eyeRight = getPoint(ctx.frontAligned, 362);
      const mouthLeft = getPoint(ctx.frontAligned, 61);
      const mouthRight = getPoint(ctx.frontAligned, 291);
      if (!eyeLeft || !eyeRight || !mouthLeft || !mouthRight) return null;
      const eyeWidth = dist(eyeLeft, eyeRight);
      const mouthWidth = dist(mouthLeft, mouthRight);
      if (mouthWidth <= 1e-6) return null;
      return eyeWidth / mouthWidth;
    },
  },
  {
    id: "harmony_profile_balance",
    title: "Profile vertical balance",
    pillar: "harmony",
    view: "side",
    baseWeight: 0.8,
    requiredPoints: [168, 2, 152],
    band: { min: 0.55, optMin: 0.8, optMax: 1.2, max: 1.8 },
    notes: [
      "Profile thirds are balanced.",
      "Profile thirds are moderate.",
      "Profile thirds are outside stable range.",
    ],
    formula: (ctx) => {
      const brow = getPoint(ctx.sideAligned, 168);
      const noseBase = getPoint(ctx.sideAligned, 2);
      const chin = getPoint(ctx.sideAligned, 152);
      if (!brow || !noseBase || !chin) return null;
      const upper = dist(brow, noseBase);
      const lower = dist(noseBase, chin);
      if (lower <= 1e-6) return null;
      return upper / lower;
    },
  },
  {
    id: "angularity_jaw_height",
    title: "Jaw width to lower-face height",
    pillar: "angularity",
    view: "front",
    baseWeight: 1.2,
    requiredPoints: [172, 397, 2, 152],
    band: { min: 0.6, optMin: 0.95, optMax: 1.4, max: 1.95 },
    notes: [
      "Lower-face structure appears angular.",
      "Lower-face structure is moderate.",
      "Lower-face structure appears soft.",
    ],
    formula: (ctx) => {
      const jawLeft = getPoint(ctx.frontAligned, 172);
      const jawRight = getPoint(ctx.frontAligned, 397);
      const noseBase = getPoint(ctx.frontAligned, 2);
      const chin = getPoint(ctx.frontAligned, 152);
      if (!jawLeft || !jawRight || !noseBase || !chin) return null;
      const jawWidth = dist(jawLeft, jawRight);
      const lowerHeight = dist(noseBase, chin);
      if (lowerHeight <= 1e-6) return null;
      return jawWidth / lowerHeight;
    },
  },
  {
    id: "angularity_chin_taper",
    title: "Chin taper",
    pillar: "angularity",
    view: "front",
    baseWeight: 1,
    requiredPoints: [149, 378, 172, 397],
    band: { min: 0.25, optMin: 0.4, optMax: 0.65, max: 0.9 },
    notes: [
      "Chin taper is well defined.",
      "Chin taper is moderate.",
      "Chin taper is weak or uncertain.",
    ],
    formula: (ctx) => {
      const chinLeft = getPoint(ctx.frontAligned, 149);
      const chinRight = getPoint(ctx.frontAligned, 378);
      const jawLeft = getPoint(ctx.frontAligned, 172);
      const jawRight = getPoint(ctx.frontAligned, 397);
      if (!chinLeft || !chinRight || !jawLeft || !jawRight) return null;
      const chinWidth = dist(chinLeft, chinRight);
      const jawWidth = dist(jawLeft, jawRight);
      if (jawWidth <= 1e-6) return null;
      return chinWidth / jawWidth;
    },
  },
  {
    id: "angularity_profile_chin_projection",
    title: "Profile chin projection",
    pillar: "angularity",
    view: "side",
    baseWeight: 1.1,
    requiredPoints: [152, 2],
    band: { min: 0.02, optMin: 0.1, optMax: 0.3, max: 0.55 },
    notes: [
      "Profile chin projection is strong.",
      "Profile chin projection is moderate.",
      "Profile chin projection is limited or uncertain.",
    ],
    formula: (ctx) => {
      const chin = getPoint(ctx.sideAligned, 152);
      const noseBase = getPoint(ctx.sideAligned, 2);
      if (!chin || !noseBase) return null;
      const projection = Math.abs(
        profileDirectionAwareDelta(chin, noseBase, ctx.sideQuality.poseYaw)
      );
      return projection / Math.max(ctx.sideScale, 1e-6);
    },
  },
  {
    id: "dimorphism_fwhr",
    title: "fWHR",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 1,
    requiredPoints: [234, 454, 168, 2],
    band: { min: 1.2, optMin: 1.55, optMax: 2.15, max: 2.8 },
    notes: [
      "Upper-face width-height ratio is strong.",
      "Upper-face width-height ratio is moderate.",
      "Upper-face width-height ratio is low or uncertain.",
    ],
    formula: (ctx) => {
      const cheekLeft = getPoint(ctx.frontAligned, 234);
      const cheekRight = getPoint(ctx.frontAligned, 454);
      const brow = getPoint(ctx.frontAligned, 168);
      const noseBase = getPoint(ctx.frontAligned, 2);
      if (!cheekLeft || !cheekRight || !brow || !noseBase) return null;
      const width = dist(cheekLeft, cheekRight);
      const upperHeight = dist(brow, noseBase);
      if (upperHeight <= 1e-6) return null;
      return width / upperHeight;
    },
  },
  {
    id: "dimorphism_lower_face_ratio",
    title: "Lower-face ratio",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 0.95,
    requiredPoints: [2, 152, 234, 454],
    band: { min: 0.35, optMin: 0.52, optMax: 0.82, max: 1.2 },
    notes: [
      "Lower-face ratio is robust.",
      "Lower-face ratio is moderate.",
      "Lower-face ratio is low-confidence or soft.",
    ],
    formula: (ctx) => {
      const noseBase = getPoint(ctx.frontAligned, 2);
      const chin = getPoint(ctx.frontAligned, 152);
      const cheekLeft = getPoint(ctx.frontAligned, 234);
      const cheekRight = getPoint(ctx.frontAligned, 454);
      if (!noseBase || !chin || !cheekLeft || !cheekRight) return null;
      const lowerHeight = dist(noseBase, chin);
      const width = dist(cheekLeft, cheekRight);
      if (width <= 1e-6) return null;
      return lowerHeight / width;
    },
  },
  {
    id: "dimorphism_jaw_cheek_strength",
    title: "Jaw-cheek strength",
    pillar: "dimorphism",
    view: "front",
    baseWeight: 1.05,
    requiredPoints: [172, 397, 234, 454],
    band: { min: 0.58, optMin: 0.8, optMax: 1.02, max: 1.22 },
    notes: [
      "Jaw-cheek relationship appears strong.",
      "Jaw-cheek relationship is moderate.",
      "Jaw-cheek relationship appears weak or uncertain.",
    ],
    formula: (ctx) => {
      const jawLeft = getPoint(ctx.frontAligned, 172);
      const jawRight = getPoint(ctx.frontAligned, 397);
      const cheekLeft = getPoint(ctx.frontAligned, 234);
      const cheekRight = getPoint(ctx.frontAligned, 454);
      if (!jawLeft || !jawRight || !cheekLeft || !cheekRight) return null;
      const jaw = dist(jawLeft, jawRight);
      const cheek = dist(cheekLeft, cheekRight);
      if (cheek <= 1e-6) return null;
      return jaw / cheek;
    },
  },
  {
    id: "features_eye_tilt",
    title: "Eye tilt",
    pillar: "features",
    view: "front",
    baseWeight: 0.85,
    requiredPoints: [33, 263],
    band: { min: 0, optMin: 3, optMax: 14, max: 26 },
    notes: [
      "Eye tilt appears balanced.",
      "Eye tilt is moderate.",
      "Eye tilt is outside stable range.",
    ],
    formula: (ctx) => {
      const outerLeft = getPoint(ctx.frontAligned, 33);
      const outerRight = getPoint(ctx.frontAligned, 263);
      if (!outerLeft || !outerRight) return null;
      return Math.abs(angleDeg(outerLeft, outerRight));
    },
  },
  {
    id: "features_eye_aperture",
    title: "Eye aperture",
    pillar: "features",
    view: "front",
    baseWeight: 1,
    requiredPoints: [33, 133, 159, 145, 263, 362, 386, 374],
    band: { min: 0.06, optMin: 0.14, optMax: 0.32, max: 0.5 },
    notes: [
      "Eye aperture appears healthy.",
      "Eye aperture is moderate.",
      "Eye aperture appears limited or uncertain.",
    ],
    formula: (ctx) => {
      const lOuter = getPoint(ctx.frontAligned, 33);
      const lInner = getPoint(ctx.frontAligned, 133);
      const lTop = getPoint(ctx.frontAligned, 159);
      const lBottom = getPoint(ctx.frontAligned, 145);
      const rOuter = getPoint(ctx.frontAligned, 263);
      const rInner = getPoint(ctx.frontAligned, 362);
      const rTop = getPoint(ctx.frontAligned, 386);
      const rBottom = getPoint(ctx.frontAligned, 374);
      if (
        !lOuter ||
        !lInner ||
        !lTop ||
        !lBottom ||
        !rOuter ||
        !rInner ||
        !rTop ||
        !rBottom
      ) {
        return null;
      }

      const leftWidth = dist(lOuter, lInner);
      const rightWidth = dist(rOuter, rInner);
      if (leftWidth <= 1e-6 || rightWidth <= 1e-6) return null;
      const leftAperture = dist(lTop, lBottom) / leftWidth;
      const rightAperture = dist(rTop, rBottom) / rightWidth;
      return (leftAperture + rightAperture) / 2;
    },
  },
  {
    id: "features_nose_length_width",
    title: "Nose length-width",
    pillar: "features",
    view: "front",
    baseWeight: 1,
    requiredPoints: [6, 1, 98, 327],
    band: { min: 0.8, optMin: 1.2, optMax: 2.0, max: 2.9 },
    notes: [
      "Nasal proportion appears balanced.",
      "Nasal proportion is moderate.",
      "Nasal proportion appears outside stable range.",
    ],
    formula: (ctx) => {
      const bridge = getPoint(ctx.frontAligned, 6);
      const tip = getPoint(ctx.frontAligned, 1);
      const wingLeft = getPoint(ctx.frontAligned, 98);
      const wingRight = getPoint(ctx.frontAligned, 327);
      if (!bridge || !tip || !wingLeft || !wingRight) return null;
      const length = dist(bridge, tip);
      const width = dist(wingLeft, wingRight);
      if (width <= 1e-6) return null;
      return length / width;
    },
  },
  {
    id: "features_lip_fullness",
    title: "Lip fullness",
    pillar: "features",
    view: "front",
    baseWeight: 0.9,
    requiredPoints: [13, 14, 61, 291],
    band: { min: 0.04, optMin: 0.1, optMax: 0.24, max: 0.42 },
    notes: [
      "Lip proportion appears balanced.",
      "Lip proportion is moderate.",
      "Lip proportion appears low-confidence or off-range.",
    ],
    formula: (ctx) => {
      const upper = getPoint(ctx.frontAligned, 13);
      const lower = getPoint(ctx.frontAligned, 14);
      const left = getPoint(ctx.frontAligned, 61);
      const right = getPoint(ctx.frontAligned, 291);
      if (!upper || !lower || !left || !right) return null;
      const fullness = dist(upper, lower);
      const width = dist(left, right);
      if (width <= 1e-6) return null;
      return fullness / width;
    },
  },
  {
    id: "features_dorsum_straightness",
    title: "Dorsum straightness",
    pillar: "features",
    view: "side",
    baseWeight: 0.85,
    requiredPoints: [6, 197, 195, 5, 4, 1],
    band: { min: 0, optMin: 0, optMax: 0.028, max: 0.12 },
    notes: [
      "Nasal dorsum appears straight.",
      "Nasal dorsum is moderately straight.",
      "Nasal dorsum appears irregular or low-confidence.",
    ],
    formula: (ctx) => {
      const indices = [6, 197, 195, 5, 4, 1];
      const points = indices
        .map((index) => getPoint(ctx.sideAligned, index))
        .filter((point): point is Landmark => point != null);
      if (points.length < 4) return null;
      const start = points[0];
      const end = points[points.length - 1];
      return lineDeviation(points, start, end, ctx.sideScale);
    },
  },
];

const pillarWeight: Record<PillarName, number> = {
  harmony: 0.34,
  angularity: 0.22,
  dimorphism: 0.22,
  features: 0.22,
};

const buildContext = (
  frontLandmarks: Landmark[],
  sideLandmarks: Landmark[],
  frontQualityInput?: PhotoQuality | null,
  sideQualityInput?: PhotoQuality | null
): ScoreContext => {
  const frontQuality = ensureQuality(frontQualityInput, "front");
  const sideQuality = ensureQuality(sideQualityInput, "side");

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
  const frontFaceWidth =
    cheekLeft && cheekRight ? dist(cheekLeft, cheekRight) : Math.max(ipd * 2.3, 1e-6);

  const lowerRefA = getPoint(frontAligned, 2);
  const lowerRefB = getPoint(frontAligned, 152);
  const frontLowerFaceHeight =
    lowerRefA && lowerRefB
      ? Math.max(dist(lowerRefA, lowerRefB), 1e-6)
      : Math.max(ipd * 1.2, 1e-6);

  const sideScaleRefA = getPoint(sideAligned, 6) ?? getPoint(sideAligned, 1);
  const sideScaleRefB = getPoint(sideAligned, 152) ?? getPoint(sideAligned, 2);
  const sideScale =
    sideScaleRefA && sideScaleRefB
      ? Math.max(dist(sideScaleRefA, sideScaleRefB), 1e-6)
      : Math.max(ipd * 1.2, 1e-6);

  return {
    front: frontLandmarks,
    side: sideLandmarks,
    frontAligned,
    sideAligned,
    frontQuality,
    sideQuality,
    ipd,
    frontFaceWidth,
    frontLowerFaceHeight,
    sideScale,
  };
};

const evaluateMetric = (metric: MetricDefinition, ctx: ScoreContext): MetricResult => {
  const requiredOnView =
    metric.view === "front"
      ? hasRequiredPoints(ctx.frontAligned, metric.requiredPoints)
      : metric.view === "side"
        ? hasRequiredPoints(ctx.sideAligned, metric.requiredPoints)
        :
            hasRequiredPoints(ctx.frontAligned, metric.requiredPoints) ||
            hasRequiredPoints(ctx.sideAligned, metric.requiredPoints);

  if (!requiredOnView) {
    return {
      id: metric.id,
      title: metric.title,
      pillar: metric.pillar,
      view: metric.view,
      value: null,
      score: null,
      confidence: 0,
      baseWeight: metric.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "low_landmark_conf",
      reasonCodes: ["low_landmark_conf"],
      errorBar: null,
    };
  }

  if (metric.view === "side" && !ctx.sideQuality.pose.validSide) {
    return {
      id: metric.id,
      title: metric.title,
      pillar: metric.pillar,
      view: metric.view,
      value: null,
      score: null,
      confidence: clamp01(ctx.sideQuality.confidence),
      baseWeight: metric.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "bad_pose",
      reasonCodes: ["bad_pose", "side_disabled"],
      errorBar: null,
    };
  }

  const value = metric.formula(ctx);
  const reasonCodes =
    metric.view === "front"
      ? ctx.frontQuality.reasonCodes
      : metric.view === "side"
        ? ctx.sideQuality.reasonCodes
        : Array.from(
            new Set([...ctx.frontQuality.reasonCodes, ...ctx.sideQuality.reasonCodes])
          );

  const confidence = metricBaseConfidence(metric.view, ctx, metric.requiredPoints);
  const confidenceThreshold = 0.45;

  if (value == null || !Number.isFinite(value)) {
    return {
      id: metric.id,
      title: metric.title,
      pillar: metric.pillar,
      view: metric.view,
      value: null,
      score: null,
      confidence,
      baseWeight: metric.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "low_landmark_conf",
      reasonCodes: Array.from(new Set(["low_landmark_conf", ...reasonCodes])),
      errorBar: null,
    };
  }

  if (confidence < confidenceThreshold) {
    return {
      id: metric.id,
      title: metric.title,
      pillar: metric.pillar,
      view: metric.view,
      value,
      score: null,
      confidence,
      baseWeight: metric.baseWeight,
      usedWeight: 0,
      scored: false,
      insufficient: true,
      validityReason: "low_landmark_conf",
      reasonCodes: Array.from(new Set(["low_landmark_conf", ...reasonCodes])),
      errorBar: null,
    };
  }

  const score = scoreFromBand(value, metric.band);
  const usedWeight = metric.baseWeight * confidence;

  return {
    id: metric.id,
    title: metric.title,
    pillar: metric.pillar,
    view: metric.view,
    value,
    score,
    confidence,
    baseWeight: metric.baseWeight,
    usedWeight,
    scored: true,
    insufficient: false,
    validityReason: null,
    reasonCodes,
    errorBar: confidenceToErrorBar(confidence),
  };
};

const aggregatePillar = (pillar: PillarName, metrics: MetricResult[]) => {
  const inPillar = metrics.filter((metric) => metric.pillar === pillar);
  const scored = inPillar.filter((metric) => metric.scored && metric.score != null);
  const totalBaseWeight = inPillar.reduce((sum, metric) => sum + metric.baseWeight, 0);
  const totalUsedWeight = scored.reduce((sum, metric) => sum + metric.usedWeight, 0);

  if (!scored.length || totalUsedWeight <= 1e-6 || totalBaseWeight <= 1e-6) {
    return {
      score: 56,
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
  const stabilized = clamp(weightedScore * coverage + 56 * (1 - coverage));

  return {
    score: stabilized,
    confidence: coverage,
    errorBar: confidenceToErrorBar(coverage),
    insufficient: coverage < 0.35,
    scoredCount: scored.length,
    totalCount: inPillar.length,
  };
};

const toAssessment = (
  metric: MetricResult,
  definition: MetricDefinition
): Assessment => {
  const score = metric.score == null ? 56 : metric.score;
  const insufficient = metric.insufficient || metric.score == null;

  return {
    title: definition.title,
    metricId: metric.id,
    pillar: metric.pillar,
    score: Math.round(score),
    confidence: metric.confidence,
    usedWeight: metric.usedWeight,
    insufficient,
    validityReason: metric.validityReason ?? undefined,
    value: metric.value,
    errorBar: metric.errorBar,
    note: noteFor(score, insufficient, ...definition.notes),
    severity: severityFromScore(score, insufficient),
  };
};

const pickAssessments = (metrics: MetricResult[], pillar: PillarName) => {
  const defs = metricDefinitions.filter((metric) => metric.pillar === pillar);
  const scored = metrics
    .filter((metric) => metric.pillar === pillar && metric.scored && metric.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number));

  const insufficient = metrics
    .filter((metric) => metric.pillar === pillar && (!metric.scored || metric.score == null))
    .sort((a, b) => b.confidence - a.confidence);

  const selected = [...scored.slice(0, 4), ...insufficient.slice(0, 2)].slice(0, 4);
  const defMap = new Map(defs.map((definition) => [definition.id, definition]));

  return selected.map((metric) =>
    toAssessment(metric, defMap.get(metric.id) ?? defs[0])
  );
};

type ScoreInput = {
  frontLandmarks: LandmarkInput;
  sideLandmarks?: LandmarkInput;
  frontQuality?: PhotoQuality | null;
  sideQuality?: PhotoQuality | null;
};

export const computeScores = ({
  frontLandmarks,
  sideLandmarks,
  frontQuality,
  sideQuality,
}: ScoreInput) => {
  const front = normalizeLandmarks(frontLandmarks);
  const side = normalizeLandmarks(sideLandmarks);

  const ctx = buildContext(front, side, frontQuality, sideQuality);
  const metricResults = metricDefinitions.map((metric) => evaluateMetric(metric, ctx));

  const harmony = aggregatePillar("harmony", metricResults);
  const angularity = aggregatePillar("angularity", metricResults);
  const dimorphism = aggregatePillar("dimorphism", metricResults);
  const features = aggregatePillar("features", metricResults);

  const frontHarmonyMetrics = metricResults.filter(
    (metric) => metric.pillar === "harmony" && metric.view !== "side" && metric.scored
  );
  const sideHarmonyMetrics = metricResults.filter(
    (metric) => metric.pillar === "harmony" && metric.view === "side" && metric.scored
  );

  const aggregateViewHarmony = (metrics: MetricResult[], fallbackScore: number) => {
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
  const sideHarmonyScore = aggregateViewHarmony(sideHarmonyMetrics, 56);

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

  const overallScore = clamp(overallScoreRaw * overallConfidence + 56 * (1 - overallConfidence));

  const angularityAssessments = pickAssessments(metricResults, "angularity");
  const dimorphismAssessments = pickAssessments(metricResults, "dimorphism");
  const featuresAssessments = pickAssessments(metricResults, "features");

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
    angularityAssessments,
    dimorphismAssessments,
    featuresAssessments,
    metricDiagnostics: metricResults,
  };
};
