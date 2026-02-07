import type {
  Assessment,
  Landmark,
  ManualLandmarkPoint,
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

const FALLBACK_INDEX: Record<string, number | null> = {
  left_eye_lateral_canthus: 33,
  right_eye_lateral_canthus: 263,
  left_eye_medial_canthus: 133,
  right_eye_medial_canthus: 362,
  left_eye_upper_eyelid: 159,
  left_eye_lower_eyelid: 145,
  right_eye_upper_eyelid: 386,
  right_eye_lower_eyelid: 374,
  mouth_left: 61,
  mouth_right: 291,
  cupids_bow: 13,
  labrale_inferius: 14,
  left_top_gonion: 172,
  right_top_gonion: 397,
  left_bottom_gonion: 150,
  right_bottom_gonion: 379,
  left_cheek: 234,
  right_cheek: 454,
  left_nose_bridge: 98,
  right_nose_bridge: 327,
  glabella: 168,
  subnasale: 2,
  menton: 152,
  chin_left: 149,
  chin_right: 378,
  nasion: 6,
  pronasale: 1,
  side_glabella: 168,
  side_subnasale: 2,
  pogonion: 152,
  side_nasion: 6,
  rhinion: 197,
  supratip: 195,
  infratip: 5,
  columella: 4,
  side_pronasale: 1,
};

const reasonPenaltyMultiplier = (reasonCodes: ReasonCode[]) => {
  let factor = 1;
  if (reasonCodes.includes("bad_pose")) factor *= 0.84;
  if (reasonCodes.includes("not_enough_yaw")) factor *= 0.6;
  if (reasonCodes.includes("excessive_pitch")) factor *= 0.8;
  if (reasonCodes.includes("excessive_roll")) factor *= 0.92;
  if (reasonCodes.includes("side_ok_three_quarter")) factor *= 0.96;
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
  requiredLandmarkIds?: string[];
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
  manualByIndex: Map<string, ManualLandmarkPoint>;
  manualById: Map<string, ManualLandmarkPoint>;
  frontManualAligned: Map<string, Landmark>;
  sideManualAligned: Map<string, Landmark>;
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
  ipd: number;
  frontFaceWidth: number;
  frontLowerFaceHeight: number;
  sideScale: number;
  strictManual: boolean;
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
  viewWeight: 0,
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
      if (v == null || !Number.isFinite(v)) return 1;
      return clamp01(v);
    })
    .filter(Number.isFinite);

  if (!vis.length) return 1;
  const maxVis = Math.max(...vis);
  const minVis = Math.min(...vis);
  // FaceLandmarker often emits 0 visibility for all points in IMAGE mode.
  if (maxVis <= 0.001 && minVis >= 0) return 1;
  return avg(vis);
};

const metricBaseConfidence = (
  view: MetricView,
  ctx: ScoreContext,
  requiredPoints: number[],
  requiredLandmarkIds?: string[]
) => {
  const frontPoints = pointVisibilityFactor(ctx.frontAligned, requiredPoints);
  const sidePoints = pointVisibilityFactor(ctx.sideAligned, requiredPoints);
  const manualFactor = meanManualConfidence(requiredLandmarkIds, ctx.manualById);

  if (view === "front") {
    return (
      clamp01(ctx.frontQuality.confidence) *
      reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes) *
      frontPoints *
      manualFactor
    );
  }

  if (view === "side") {
    return (
      clamp01(ctx.sideQuality.confidence) *
      clamp01(ctx.sideQuality.viewWeight) *
      reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes) *
      sidePoints *
      manualFactor
    );
  }

  const front =
    clamp01(ctx.frontQuality.confidence) *
    reasonPenaltyMultiplier(ctx.frontQuality.reasonCodes) *
    frontPoints;
  const side =
    clamp01(ctx.sideQuality.confidence) *
    clamp01(ctx.sideQuality.viewWeight) *
    reasonPenaltyMultiplier(ctx.sideQuality.reasonCodes) *
    sidePoints;
  return clamp01((front * 0.65 + side * 0.35) * manualFactor);
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

const buildAlignedManualMap = (
  points: ManualLandmarkPoint[],
  view: "front" | "side",
  center: Landmark,
  rollDeg: number
) => {
  const angleRad = (-rollDeg * Math.PI) / 180;
  const map = new Map<string, Landmark>();
  for (const point of points) {
    if (point.view !== view) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (!point.confirmed) continue;
    const aligned = rotatePoint(
      { x: point.x, y: point.y, z: 0, visibility: point.confidence },
      center,
      angleRad
    );
    map.set(point.id, aligned);
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

const validateManualForMetric = (
  metric: MetricDefinition,
  ctx: ScoreContext
): {
  valid: boolean;
  reason: string | null;
} => {
  if (metric.requiredLandmarkIds?.length) {
    const matched = metric.requiredLandmarkIds
      .map((id) => ctx.manualById.get(id))
      .filter((point): point is ManualLandmarkPoint => point != null);

    if (!matched.length) {
      return { valid: true, reason: null };
    }

    const invalid = matched.filter((point) => !point.confirmed);
    if (invalid.length) {
      return {
        valid: false,
        reason: `manual_unconfirmed:${invalid.map((point) => point.id).join(",")}`,
      };
    }
    return { valid: true, reason: null };
  }

  const views: Array<"front" | "side"> =
    metric.view === "either" ? ["front", "side"] : [metric.view];

  let hasManualCoverage = false;
  const invalidPoints: string[] = [];

  for (const view of views) {
    for (const index of metric.requiredPoints) {
      const point = ctx.manualByIndex.get(manualKey(view, index));
      if (!point) continue;
      hasManualCoverage = true;
      if (!point.confirmed) {
        invalidPoints.push(point.id);
      }
    }
  }

  if (!hasManualCoverage) {
    return { valid: true, reason: null };
  }

  if (invalidPoints.length) {
    return {
      valid: false,
      reason: `manual_unconfirmed:${Array.from(new Set(invalidPoints)).join(",")}`,
    };
  }

  return { valid: true, reason: null };
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

const pointFromManualOrFallback = (
  ctx: ScoreContext,
  id: string,
  view: "front" | "side",
  fallbackIndex: number | null
) => {
  const manual =
    view === "front" ? ctx.frontManualAligned.get(id) : ctx.sideManualAligned.get(id);
  if (manual) return manual;
  if (ctx.strictManual) return null;

  if (fallbackIndex == null) return null;
  const source = view === "front" ? ctx.frontAligned : ctx.sideAligned;
  return getPoint(source, fallbackIndex);
};

const metricDefinitions: MetricDefinition[] = [
  {
    id: "harmony_symmetry",
    title: "Symmetry",
    pillar: "harmony",
    view: "front",
    baseWeight: 1.4,
    requiredPoints: FRONT_MIRROR_PAIRS.flat(),
    requiredLandmarkIds: [
      "left_eye_lateral_canthus",
      "right_eye_lateral_canthus",
      "left_eye_medial_canthus",
      "right_eye_medial_canthus",
      "left_cheek",
      "right_cheek",
      "left_top_gonion",
      "right_top_gonion",
      "left_bottom_gonion",
      "right_bottom_gonion",
      "mouth_left",
      "mouth_right",
      "chin_left",
      "chin_right",
    ],
    band: { min: 0, optMin: 0, optMax: 0.04, max: 0.2 },
    notes: [
      "Left-right balance is strong.",
      "Symmetry is moderately balanced.",
      "Symmetry drift detected.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const leftEye = p("left_eye_medial_canthus");
      const rightEye = p("right_eye_medial_canthus");
      if (!leftEye || !rightEye) return null;
      const midX = (leftEye.x + rightEye.x) / 2;
      const pairs: Array<[string, string]> = [
        ["left_eye_lateral_canthus", "right_eye_lateral_canthus"],
        ["left_eye_medial_canthus", "right_eye_medial_canthus"],
        ["mouth_left", "mouth_right"],
        ["left_top_gonion", "right_top_gonion"],
        ["left_bottom_gonion", "right_bottom_gonion"],
        ["left_cheek", "right_cheek"],
        ["chin_left", "chin_right"],
      ];
      const errors = pairs
        .map(([leftId, rightId]) => {
          const left = p(leftId);
          const right = p(rightId);
          if (!left || !right) return null;
          const dx = Math.abs(((left.x + right.x) / 2 - midX) * 2);
          const dy = Math.abs(left.y - right.y);
          return (dx + dy) / Math.max(ctx.ipd, 1e-6);
        })
        .filter((value): value is number => value != null);
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
    requiredLandmarkIds: ["glabella", "subnasale", "menton"],
    band: { min: 0.55, optMin: 0.8, optMax: 1.15, max: 1.7 },
    notes: [
      "Vertical proportions are balanced.",
      "Vertical proportions are acceptable.",
      "Vertical proportion drift detected.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const brow = p("glabella");
      const noseBase = p("subnasale");
      const chin = p("menton");
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
    requiredLandmarkIds: ["left_top_gonion", "right_top_gonion", "left_cheek", "right_cheek"],
    band: { min: 0.6, optMin: 0.78, optMax: 0.96, max: 1.18 },
    notes: [
      "Jaw-cheek proportion is balanced.",
      "Jaw-cheek proportion is moderate.",
      "Jaw-cheek proportion appears imbalanced.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const jawLeft = p("left_top_gonion");
      const jawRight = p("right_top_gonion");
      const cheekLeft = p("left_cheek");
      const cheekRight = p("right_cheek");
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
    requiredPoints: [33, 263, 61, 291],
    requiredLandmarkIds: [
      "left_eye_lateral_canthus",
      "right_eye_lateral_canthus",
      "mouth_left",
      "mouth_right",
    ],
    band: { min: 0.55, optMin: 0.75, optMax: 1.1, max: 1.5 },
    notes: [
      "Eye-mouth ratio is balanced.",
      "Eye-mouth ratio is near neutral.",
      "Eye-mouth ratio is outside stable range.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const eyeLeft = p("left_eye_lateral_canthus");
      const eyeRight = p("right_eye_lateral_canthus");
      const mouthLeft = p("mouth_left");
      const mouthRight = p("mouth_right");
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
    requiredLandmarkIds: ["side_glabella", "side_subnasale", "pogonion"],
    band: { min: 0.55, optMin: 0.8, optMax: 1.2, max: 1.8 },
    notes: [
      "Profile thirds are balanced.",
      "Profile thirds are moderate.",
      "Profile thirds are outside stable range.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "side", FALLBACK_INDEX[id] ?? null);
      const brow = p("side_glabella");
      const noseBase = p("side_subnasale");
      const chin = p("pogonion");
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
    requiredLandmarkIds: ["left_top_gonion", "right_top_gonion", "subnasale", "menton"],
    band: { min: 0.6, optMin: 0.95, optMax: 1.4, max: 1.95 },
    notes: [
      "Lower-face structure appears angular.",
      "Lower-face structure is moderate.",
      "Lower-face structure appears soft.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const jawLeft = p("left_top_gonion");
      const jawRight = p("right_top_gonion");
      const noseBase = p("subnasale");
      const chin = p("menton");
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
    requiredLandmarkIds: ["chin_left", "chin_right", "left_top_gonion", "right_top_gonion"],
    band: { min: 0.25, optMin: 0.4, optMax: 0.65, max: 0.9 },
    notes: [
      "Chin taper is well defined.",
      "Chin taper is moderate.",
      "Chin taper is weak or uncertain.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const chinLeft = p("chin_left");
      const chinRight = p("chin_right");
      const jawLeft = p("left_top_gonion");
      const jawRight = p("right_top_gonion");
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
    requiredLandmarkIds: ["pogonion", "side_subnasale"],
    band: { min: 0.02, optMin: 0.1, optMax: 0.3, max: 0.55 },
    notes: [
      "Profile chin projection is strong.",
      "Profile chin projection is moderate.",
      "Profile chin projection is limited or uncertain.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "side", FALLBACK_INDEX[id] ?? null);
      const chin = p("pogonion");
      const noseBase = p("side_subnasale");
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
    requiredLandmarkIds: ["left_cheek", "right_cheek", "glabella", "subnasale"],
    band: { min: 1.2, optMin: 1.55, optMax: 2.15, max: 2.8 },
    notes: [
      "Upper-face width-height ratio is strong.",
      "Upper-face width-height ratio is moderate.",
      "Upper-face width-height ratio is low or uncertain.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const cheekLeft = p("left_cheek");
      const cheekRight = p("right_cheek");
      const brow = p("glabella");
      const noseBase = p("subnasale");
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
    requiredLandmarkIds: ["subnasale", "menton", "left_cheek", "right_cheek"],
    band: { min: 0.35, optMin: 0.52, optMax: 0.82, max: 1.2 },
    notes: [
      "Lower-face ratio is robust.",
      "Lower-face ratio is moderate.",
      "Lower-face ratio is low-confidence or soft.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const noseBase = p("subnasale");
      const chin = p("menton");
      const cheekLeft = p("left_cheek");
      const cheekRight = p("right_cheek");
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
    requiredLandmarkIds: ["left_top_gonion", "right_top_gonion", "left_cheek", "right_cheek"],
    band: { min: 0.58, optMin: 0.8, optMax: 1.02, max: 1.22 },
    notes: [
      "Jaw-cheek relationship appears strong.",
      "Jaw-cheek relationship is moderate.",
      "Jaw-cheek relationship appears weak or uncertain.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const jawLeft = p("left_top_gonion");
      const jawRight = p("right_top_gonion");
      const cheekLeft = p("left_cheek");
      const cheekRight = p("right_cheek");
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
    requiredLandmarkIds: ["left_eye_lateral_canthus", "right_eye_lateral_canthus"],
    band: { min: 0, optMin: 3, optMax: 14, max: 26 },
    notes: [
      "Eye tilt appears balanced.",
      "Eye tilt is moderate.",
      "Eye tilt is outside stable range.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const outerLeft = p("left_eye_lateral_canthus");
      const outerRight = p("right_eye_lateral_canthus");
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
    requiredLandmarkIds: [
      "left_eye_lateral_canthus",
      "left_eye_medial_canthus",
      "left_eye_upper_eyelid",
      "left_eye_lower_eyelid",
      "right_eye_lateral_canthus",
      "right_eye_medial_canthus",
      "right_eye_upper_eyelid",
      "right_eye_lower_eyelid",
    ],
    band: { min: 0.06, optMin: 0.14, optMax: 0.32, max: 0.5 },
    notes: [
      "Eye aperture appears healthy.",
      "Eye aperture is moderate.",
      "Eye aperture appears limited or uncertain.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const lOuter = p("left_eye_lateral_canthus");
      const lInner = p("left_eye_medial_canthus");
      const lTop = p("left_eye_upper_eyelid");
      const lBottom = p("left_eye_lower_eyelid");
      const rOuter = p("right_eye_lateral_canthus");
      const rInner = p("right_eye_medial_canthus");
      const rTop = p("right_eye_upper_eyelid");
      const rBottom = p("right_eye_lower_eyelid");
      if (!lOuter || !lInner || !lTop || !lBottom || !rOuter || !rInner || !rTop || !rBottom) {
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
    requiredLandmarkIds: ["nasion", "pronasale", "left_nose_bridge", "right_nose_bridge"],
    band: { min: 0.8, optMin: 1.2, optMax: 2.0, max: 2.9 },
    notes: [
      "Nasal proportion appears balanced.",
      "Nasal proportion is moderate.",
      "Nasal proportion appears outside stable range.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const bridge = p("nasion");
      const tip = p("pronasale");
      const wingLeft = p("left_nose_bridge");
      const wingRight = p("right_nose_bridge");
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
    requiredLandmarkIds: ["cupids_bow", "labrale_inferius", "mouth_left", "mouth_right"],
    band: { min: 0.04, optMin: 0.1, optMax: 0.24, max: 0.42 },
    notes: [
      "Lip proportion appears balanced.",
      "Lip proportion is moderate.",
      "Lip proportion appears low-confidence or off-range.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null);
      const upper = p("cupids_bow");
      const lower = p("labrale_inferius");
      const left = p("mouth_left");
      const right = p("mouth_right");
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
    requiredLandmarkIds: [
      "side_nasion",
      "rhinion",
      "supratip",
      "infratip",
      "columella",
      "side_pronasale",
    ],
    band: { min: 0, optMin: 0, optMax: 0.028, max: 0.12 },
    notes: [
      "Nasal dorsum appears straight.",
      "Nasal dorsum is moderately straight.",
      "Nasal dorsum appears irregular or low-confidence.",
    ],
    formula: (ctx) => {
      const p = (id: string) =>
        pointFromManualOrFallback(ctx, id, "side", FALLBACK_INDEX[id] ?? null);
      const sequence = [
        p("side_nasion"),
        p("rhinion"),
        p("supratip"),
        p("infratip"),
        p("columella"),
        p("side_pronasale"),
      ].filter((point): point is Landmark => point != null);
      if (sequence.length < 4) return null;
      const start = sequence[0];
      const end = sequence[sequence.length - 1];
      return lineDeviation(sequence, start, end, ctx.sideScale);
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

  const manualFrontLeftEye =
    manualById.get("left_eye_medial_canthus") ??
    manualById.get("left_eye_lateral_canthus");
  const manualFrontRightEye =
    manualById.get("right_eye_medial_canthus") ??
    manualById.get("right_eye_lateral_canthus");
  const manualFrontCenter =
    manualFrontLeftEye &&
    manualFrontRightEye &&
    manualFrontLeftEye.confirmed &&
    manualFrontRightEye.confirmed
      ? midpoint(
          {
            x: manualFrontLeftEye.x,
            y: manualFrontLeftEye.y,
          },
          {
            x: manualFrontRightEye.x,
            y: manualFrontRightEye.y,
          }
        )
      : faceCenter;

  const manualSideA =
    manualById.get("side_nasion")?.confirmed && manualById.get("side_nasion")
      ? {
          x: manualById.get("side_nasion")?.x ?? sideCenter.x,
          y: manualById.get("side_nasion")?.y ?? sideCenter.y,
        }
      : null;
  const manualSideB =
    manualById.get("pogonion")?.confirmed && manualById.get("pogonion")
      ? {
          x: manualById.get("pogonion")?.x ?? sideCenter.x,
          y: manualById.get("pogonion")?.y ?? sideCenter.y,
        }
      : null;
  const manualSideCenter =
    manualSideA && manualSideB ? midpoint(manualSideA, manualSideB) : sideCenter;

  const frontManualAligned = buildAlignedManualMap(
    manualPoints,
    "front",
    manualFrontCenter,
    frontQuality.poseRoll
  );
  const sideManualAligned = buildAlignedManualMap(
    manualPoints,
    "side",
    manualSideCenter,
    sideQuality.poseRoll
  );

  const hasConfirmedManual = manualPoints.some((point) => point.confirmed);

  return {
    front: frontLandmarks,
    side: sideLandmarks,
    frontAligned,
    sideAligned,
    manualByIndex,
    manualById,
    frontManualAligned,
    sideManualAligned,
    frontQuality,
    sideQuality,
    ipd,
    frontFaceWidth,
    frontLowerFaceHeight,
    sideScale,
    strictManual: hasConfirmedManual,
  };
};

const evaluateMetric = (metric: MetricDefinition, ctx: ScoreContext): MetricResult => {
  const manualValidation = validateManualForMetric(metric, ctx);
  if (!manualValidation.valid) {
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
      validityReason: manualValidation.reason ?? "manual_unconfirmed",
      reasonCodes: ["manual_unconfirmed"],
      errorBar: null,
    };
  }

  const hasRequiredByIds = () => {
    if (!metric.requiredLandmarkIds?.length) return null;
    if (metric.view === "front") {
      return metric.requiredLandmarkIds.every(
        (id) =>
          pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null) != null
      );
    }
    if (metric.view === "side") {
      return metric.requiredLandmarkIds.every(
        (id) =>
          pointFromManualOrFallback(ctx, id, "side", FALLBACK_INDEX[id] ?? null) != null
      );
    }
    return metric.requiredLandmarkIds.every(
      (id) =>
        pointFromManualOrFallback(ctx, id, "front", FALLBACK_INDEX[id] ?? null) != null ||
        pointFromManualOrFallback(ctx, id, "side", FALLBACK_INDEX[id] ?? null) != null
    );
  };

  const requiredOnView =
    hasRequiredByIds() ??
    (metric.view === "front"
      ? hasRequiredPoints(ctx.frontAligned, metric.requiredPoints)
      : metric.view === "side"
        ? hasRequiredPoints(ctx.sideAligned, metric.requiredPoints)
        :
            hasRequiredPoints(ctx.frontAligned, metric.requiredPoints) ||
            hasRequiredPoints(ctx.sideAligned, metric.requiredPoints));

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

  const value = metric.formula(ctx);
  const reasonCodes =
    metric.view === "front"
      ? ctx.frontQuality.reasonCodes
      : metric.view === "side"
        ? ctx.sideQuality.reasonCodes
        : Array.from(
            new Set([...ctx.frontQuality.reasonCodes, ...ctx.sideQuality.reasonCodes])
          );

  const confidence = metricBaseConfidence(
    metric.view,
    ctx,
    metric.requiredPoints,
    metric.requiredLandmarkIds
  );
  const confidenceThreshold =
    metric.view === "side" ? 0.16 : metric.view === "either" ? 0.22 : 0.24;

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

  const ctx = buildContext(
    front,
    side,
    frontQuality,
    sideQuality,
    manualLandmarks ?? []
  );
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
