import type { Landmark, ManualLandmarkPoint, PhotoQuality } from "./types";

export type LandmarkCalibrationView = "front" | "side";

export type LandmarkProfile = {
  gender: string;
  ethnicity: string;
};

export type LandmarkCalibrationDef = {
  id: string;
  name: string;
  subtitle: string;
  view: LandmarkCalibrationView;
  howToFind: string;
  mediapipeIndex: number | null;
  required: boolean;
  forceManual?: boolean;
  hairSensitive?: boolean;
  assetKey: string;
  referenceFallbackKeys?: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const dedupe = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

type NormalizedPoint = {
  x: number;
  y: number;
  visibility: number;
};

type LandmarkStats = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

const normalizeLandmarkArray = (points: Landmark[]): NormalizedPoint[] => {
  if (!points.length) return [];
  const maxX = Math.max(...points.map((point) => Math.abs(point.x)));
  const maxY = Math.max(...points.map((point) => Math.abs(point.y)));
  const scaleX = maxX > 2 ? maxX : 1;
  const scaleY = maxY > 2 ? maxY : 1;
  return points.map((point) => ({
    x: clamp01(point.x / scaleX),
    y: clamp01(point.y / scaleY),
    visibility:
      point.visibility == null || !Number.isFinite(point.visibility)
        ? 1
        : clamp01(point.visibility),
  }));
};

const statsFor = (points: NormalizedPoint[]): LandmarkStats | null => {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1e-3, maxX - minX);
  const height = Math.max(1e-3, maxY - minY);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
};

const pointAtNormalized = (points: NormalizedPoint[], index: number | null) => {
  if (index == null) return null;
  if (index < 0 || index >= points.length) return null;
  const point = points[index];
  if (!point) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point;
};

const estimateFaceDirection = (
  points: NormalizedPoint[],
  stats: LandmarkStats
): 1 | -1 => {
  const nose = pointAtNormalized(points, 1);
  if (!nose) return 1;
  return nose.x >= stats.cx ? 1 : -1;
};

const heuristicsForPoint = (
  definition: LandmarkCalibrationDef,
  points: NormalizedPoint[]
): NormalizedPoint | null => {
  const stats = statsFor(points);
  if (!stats) return null;

  const dir = estimateFaceDirection(points, stats);
  const frontX = dir > 0 ? stats.maxX : stats.minX;
  const backX = dir > 0 ? stats.minX : stats.maxX;
  const seed = (x: number, y: number, visibility = 0.55): NormalizedPoint => ({
    x: clamp01(x),
    y: clamp01(y),
    visibility: clamp01(visibility),
  });

  if (definition.view === "front") {
    switch (definition.id) {
      case "trichion":
        return seed(stats.cx, stats.minY + stats.height * 0.05, 0.5);
      case "forehead":
        return seed(stats.cx, stats.minY + stats.height * 0.12, 0.56);
      default:
        return null;
    }
  }

  switch (definition.id) {
    case "vertex":
      return seed(stats.cx, stats.minY - stats.height * 0.08, 0.5);
    case "occiput":
      return seed(backX - dir * stats.width * 0.08, stats.minY + stats.height * 0.18, 0.48);
    case "side_trichion":
      return seed(frontX - dir * stats.width * 0.05, stats.minY + stats.height * 0.08, 0.52);
    case "intertragic_notch":
      return seed(backX + dir * stats.width * 0.09, stats.cy + stats.height * 0.06, 0.5);
    case "neck_point":
      return seed(backX + dir * stats.width * 0.2, stats.maxY + stats.height * 0.1, 0.5);
    case "porion":
      return seed(backX + dir * stats.width * 0.1, stats.minY + stats.height * 0.34, 0.48);
    case "tragus":
      return seed(backX + dir * stats.width * 0.08, stats.cy, 0.48);
    default:
      return null;
  }
};

const initConfidence = (
  def: LandmarkCalibrationDef,
  point: { x: number; y: number; visibility: number } | null,
  quality: PhotoQuality
) => {
  let confidence = clamp01(quality.confidence || 0);
  const reasons: string[] = [];

  if (!point) {
    confidence = 0;
    reasons.push("missing_autoguess");
    return {
      confidence,
      reasons,
    };
  }

  confidence *= clamp01(point.visibility || 1);
  if (quality.reasonCodes.includes("occlusion")) {
    confidence *= 0.72;
    reasons.push("occlusion");
  }
  if (quality.reasonCodes.includes("out_of_frame")) {
    confidence *= 0.8;
    reasons.push("out_of_frame");
  }
  if (quality.reasonCodes.includes("blur")) {
    confidence *= 0.86;
    reasons.push("blur");
  }
  if (point.x < 0.03 || point.x > 0.97 || point.y < 0.03 || point.y > 0.97) {
    confidence *= 0.72;
    reasons.push("edge_point");
  }
  if (def.hairSensitive && point.y < 0.22) {
    confidence = Math.min(confidence, 0.42);
    reasons.push("hair_occlusion");
  }
  if (def.forceManual) {
    confidence = Math.min(confidence, 0.45);
    reasons.push("manual_recommended");
  }

  return {
    confidence: clamp01(confidence),
    reasons,
  };
};

const FRONT_REGISTRY_RAW: LandmarkCalibrationDef[] = [
  {
    id: "trichion",
    name: "Hairline",
    subtitle: "Trichion",
    view: "front",
    howToFind:
      "Place on the central frontal hairline transition. If occluded by hair, use the best anatomical estimate.",
    mediapipeIndex: 10,
    required: false,
    forceManual: true,
    hairSensitive: true,
    assetKey: "trichion",
    referenceFallbackKeys: ["forehead"],
  },
  {
    id: "forehead",
    name: "Forehead",
    subtitle: "Mid-forehead",
    view: "front",
    howToFind: "Place on mid-forehead center below hairline.",
    mediapipeIndex: 10,
    required: false,
    hairSensitive: true,
    assetKey: "forehead",
  },
  {
    id: "glabella",
    name: "Glabella",
    subtitle: "Brow midpoint",
    view: "front",
    howToFind: "Place between eyebrows at the brow root.",
    mediapipeIndex: 9,
    required: true,
    assetKey: "glabella",
  },
  {
    id: "nasion",
    name: "Nasion",
    subtitle: "Nasal root",
    view: "front",
    howToFind: "Place where nasal bridge starts between the eyes.",
    mediapipeIndex: 6,
    required: true,
    assetKey: "nasion",
  },
  {
    id: "left_eye_pupil",
    name: "Left Pupil",
    subtitle: "Pupillary center",
    view: "front",
    howToFind: "Center on left pupil.",
    mediapipeIndex: 468,
    required: true,
    assetKey: "leftEyePupil",
  },
  {
    id: "right_eye_pupil",
    name: "Right Pupil",
    subtitle: "Pupillary center",
    view: "front",
    howToFind: "Center on right pupil.",
    mediapipeIndex: 473,
    required: true,
    assetKey: "rightEyePupil",
  },
  {
    id: "left_eye_medial_canthus",
    name: "Left Eye Medial Canthus",
    subtitle: "Inner corner",
    view: "front",
    howToFind: "Place at inner left eye corner.",
    mediapipeIndex: 133,
    required: true,
    assetKey: "leftEyeMedialCanthus",
  },
  {
    id: "left_eye_lateral_canthus",
    name: "Left Eye Lateral Canthus",
    subtitle: "Outer corner",
    view: "front",
    howToFind: "Place at outer left eye corner.",
    mediapipeIndex: 33,
    required: true,
    assetKey: "leftEyeLateralCanthus",
  },
  {
    id: "left_eye_upper_eyelid",
    name: "Left Upper Eyelid",
    subtitle: "Upper lid apex",
    view: "front",
    howToFind: "Highest point of left upper eyelid.",
    mediapipeIndex: 159,
    required: true,
    assetKey: "leftEyeUpperEyelid",
  },
  {
    id: "left_eye_lower_eyelid",
    name: "Left Lower Eyelid",
    subtitle: "Lower lid apex",
    view: "front",
    howToFind: "Lowest point of left lower eyelid.",
    mediapipeIndex: 145,
    required: true,
    assetKey: "leftEyeLowerEyelid",
  },
  {
    id: "left_eyelid_hood_end",
    name: "Left Eyelid Hood End",
    subtitle: "Lateral hood end",
    view: "front",
    howToFind: "Place at lateral end of upper hood/crease region.",
    mediapipeIndex: 246,
    required: false,
    assetKey: "leftEyelidHoodEnd",
  },
  {
    id: "left_brow_head",
    name: "Left Brow Head",
    subtitle: "Medial brow start",
    view: "front",
    howToFind: "Inner start of left eyebrow.",
    mediapipeIndex: 70,
    required: false,
    assetKey: "leftBrowHead",
  },
  {
    id: "left_brow_inner_corner",
    name: "Left Brow Inner Corner",
    subtitle: "Inner brow anchor",
    view: "front",
    howToFind: "Inner corner/anchor of left brow.",
    mediapipeIndex: 63,
    required: false,
    assetKey: "leftBrowInnerCorner",
  },
  {
    id: "left_brow_arch",
    name: "Left Brow Arch",
    subtitle: "Arch region",
    view: "front",
    howToFind: "Point on the left brow arch.",
    mediapipeIndex: 105,
    required: false,
    assetKey: "leftBrowArch",
  },
  {
    id: "left_brow_peak",
    name: "Left Brow Peak",
    subtitle: "Max arch",
    view: "front",
    howToFind: "Highest/most projected point of left brow arch.",
    mediapipeIndex: 66,
    required: false,
    assetKey: "leftBrowPeak",
  },
  {
    id: "left_brow_tail",
    name: "Left Brow Tail",
    subtitle: "Lateral brow end",
    view: "front",
    howToFind: "Lateral end of left brow.",
    mediapipeIndex: 107,
    required: false,
    assetKey: "leftBrowTail",
  },
  {
    id: "left_upper_eyelid_crease",
    name: "Left Upper Eyelid Crease",
    subtitle: "Crease center",
    view: "front",
    howToFind: "Center point on left upper eyelid crease.",
    mediapipeIndex: 160,
    required: false,
    assetKey: "leftUpperEyelidCrease",
  },
  {
    id: "right_eye_medial_canthus",
    name: "Right Eye Medial Canthus",
    subtitle: "Inner corner",
    view: "front",
    howToFind: "Place at inner right eye corner.",
    mediapipeIndex: 362,
    required: true,
    assetKey: "rightEyeMedialCanthus",
  },
  {
    id: "right_eye_lateral_canthus",
    name: "Right Eye Lateral Canthus",
    subtitle: "Outer corner",
    view: "front",
    howToFind: "Place at outer right eye corner.",
    mediapipeIndex: 263,
    required: true,
    assetKey: "rightEyeLateralCanthus",
  },
  {
    id: "right_eye_upper_eyelid",
    name: "Right Upper Eyelid",
    subtitle: "Upper lid apex",
    view: "front",
    howToFind: "Highest point of right upper eyelid.",
    mediapipeIndex: 386,
    required: true,
    assetKey: "rightEyeUpperEyelid",
  },
  {
    id: "right_eye_lower_eyelid",
    name: "Right Lower Eyelid",
    subtitle: "Lower lid apex",
    view: "front",
    howToFind: "Lowest point of right lower eyelid.",
    mediapipeIndex: 374,
    required: true,
    assetKey: "rightEyeLowerEyelid",
  },
  {
    id: "right_eyelid_hood_end",
    name: "Right Eyelid Hood End",
    subtitle: "Lateral hood end",
    view: "front",
    howToFind: "Place at lateral end of upper hood/crease region.",
    mediapipeIndex: 466,
    required: false,
    assetKey: "rightEyelidHoodEnd",
  },
  {
    id: "right_brow_head",
    name: "Right Brow Head",
    subtitle: "Medial brow start",
    view: "front",
    howToFind: "Inner start of right eyebrow.",
    mediapipeIndex: 300,
    required: false,
    assetKey: "rightBrowHead",
  },
  {
    id: "right_brow_inner_corner",
    name: "Right Brow Inner Corner",
    subtitle: "Inner brow anchor",
    view: "front",
    howToFind: "Inner corner/anchor of right brow.",
    mediapipeIndex: 293,
    required: false,
    assetKey: "rightBrowInnerCorner",
  },
  {
    id: "right_brow_arch",
    name: "Right Brow Arch",
    subtitle: "Arch region",
    view: "front",
    howToFind: "Point on the right brow arch.",
    mediapipeIndex: 334,
    required: false,
    assetKey: "rightBrowArch",
  },
  {
    id: "right_brow_peak",
    name: "Right Brow Peak",
    subtitle: "Max arch",
    view: "front",
    howToFind: "Highest/most projected point of right brow arch.",
    mediapipeIndex: 296,
    required: false,
    assetKey: "rightBrowPeak",
  },
  {
    id: "right_brow_tail",
    name: "Right Brow Tail",
    subtitle: "Lateral brow end",
    view: "front",
    howToFind: "Lateral end of right brow.",
    mediapipeIndex: 336,
    required: false,
    assetKey: "rightBrowTail",
  },
  {
    id: "right_upper_eyelid_crease",
    name: "Right Upper Eyelid Crease",
    subtitle: "Crease center",
    view: "front",
    howToFind: "Center point on right upper eyelid crease.",
    mediapipeIndex: 387,
    required: false,
    assetKey: "rightUpperEyelidCrease",
  },
  {
    id: "nasal_base",
    name: "Nasal Base",
    subtitle: "Nose base center",
    view: "front",
    howToFind: "Base center of the nose where nostrils anchor.",
    mediapipeIndex: 2,
    required: true,
    assetKey: "nasalBase",
  },
  {
    id: "nose_bottom",
    name: "Nose Bottom",
    subtitle: "Inferior nose tip",
    view: "front",
    howToFind: "Lowest contour point of nose tip/base.",
    mediapipeIndex: 2,
    required: false,
    assetKey: "noseBottom",
  },
  {
    id: "left_nose_bridge",
    name: "Left Nose Bridge",
    subtitle: "Bridge edge",
    view: "front",
    howToFind: "Left lateral edge of nasal bridge.",
    mediapipeIndex: 98,
    required: true,
    assetKey: "leftNoseBridge",
  },
  {
    id: "right_nose_bridge",
    name: "Right Nose Bridge",
    subtitle: "Bridge edge",
    view: "front",
    howToFind: "Right lateral edge of nasal bridge.",
    mediapipeIndex: 327,
    required: true,
    assetKey: "rightNoseBridge",
  },
  {
    id: "mouth_left",
    name: "Mouth Left",
    subtitle: "Left cheilion",
    view: "front",
    howToFind: "Left corner of mouth.",
    mediapipeIndex: 61,
    required: true,
    assetKey: "mouthLeft",
  },
  {
    id: "mouth_right",
    name: "Mouth Right",
    subtitle: "Right cheilion",
    view: "front",
    howToFind: "Right corner of mouth.",
    mediapipeIndex: 291,
    required: true,
    assetKey: "mouthRight",
  },
  {
    id: "mouth_middle",
    name: "Mouth Middle",
    subtitle: "Lip midpoint",
    view: "front",
    howToFind: "Midpoint between mouth corners on lip line.",
    mediapipeIndex: 0,
    required: false,
    assetKey: "mouthMiddle",
  },
  {
    id: "cupids_bow",
    name: "Cupid's Bow",
    subtitle: "Upper lip center",
    view: "front",
    howToFind: "Top center point of upper lip cupid bow.",
    mediapipeIndex: 13,
    required: true,
    assetKey: "cupidsBow",
  },
  {
    id: "inner_cupids_bow",
    name: "Inner Cupid's Bow",
    subtitle: "Inner upper vermilion",
    view: "front",
    howToFind: "Inner upper vermillion center.",
    mediapipeIndex: 13,
    required: false,
    assetKey: "innerCupidsBow",
  },
  {
    id: "labrale_superius",
    name: "Labrale Superius",
    subtitle: "Upper vermillion",
    view: "front",
    howToFind: "Most anterior point on upper vermillion border.",
    mediapipeIndex: 13,
    required: false,
    assetKey: "labraleSuperius",
    referenceFallbackKeys: ["cupidsBow"],
  },
  {
    id: "labrale_inferius",
    name: "Labrale Inferius",
    subtitle: "Lower vermillion",
    view: "front",
    howToFind: "Most anterior point on lower vermillion border.",
    mediapipeIndex: 14,
    required: true,
    assetKey: "labraleInferius",
    referenceFallbackKeys: ["lowerLip"],
  },
  {
    id: "lower_lip",
    name: "Lower Lip",
    subtitle: "Lower lip center",
    view: "front",
    howToFind: "Center of visible lower lip contour.",
    mediapipeIndex: 14,
    required: false,
    assetKey: "lowerLip",
  },
  {
    id: "left_top_gonion",
    name: "Left Top Gonion",
    subtitle: "Upper jaw angle",
    view: "front",
    howToFind: "Upper mandibular angle on left.",
    mediapipeIndex: 172,
    required: true,
    assetKey: "leftTopGonion",
  },
  {
    id: "right_top_gonion",
    name: "Right Top Gonion",
    subtitle: "Upper jaw angle",
    view: "front",
    howToFind: "Upper mandibular angle on right.",
    mediapipeIndex: 397,
    required: true,
    assetKey: "rightTopGonion",
  },
  {
    id: "left_bottom_gonion",
    name: "Left Bottom Gonion",
    subtitle: "Lower jaw angle",
    view: "front",
    howToFind: "Lower mandibular angle on left.",
    mediapipeIndex: 150,
    required: true,
    assetKey: "leftBottomGonion",
  },
  {
    id: "right_bottom_gonion",
    name: "Right Bottom Gonion",
    subtitle: "Lower jaw angle",
    view: "front",
    howToFind: "Lower mandibular angle on right.",
    mediapipeIndex: 379,
    required: true,
    assetKey: "rightBottomGonion",
  },
  {
    id: "chin_left",
    name: "Chin Left",
    subtitle: "Left chin flank",
    view: "front",
    howToFind: "Left border of chin.",
    mediapipeIndex: 149,
    required: true,
    assetKey: "chinLeft",
  },
  {
    id: "chin_right",
    name: "Chin Right",
    subtitle: "Right chin flank",
    view: "front",
    howToFind: "Right border of chin.",
    mediapipeIndex: 378,
    required: true,
    assetKey: "chinRight",
  },
  {
    id: "chin_bottom",
    name: "Chin Bottom",
    subtitle: "Inferior chin",
    view: "front",
    howToFind: "Lowest visible soft tissue point on chin.",
    mediapipeIndex: 152,
    required: false,
    assetKey: "chinBottom",
  },
  {
    id: "menton",
    name: "Menton",
    subtitle: "Lowest chin point",
    view: "front",
    howToFind: "Lowest median point of chin.",
    mediapipeIndex: 152,
    required: true,
    assetKey: "menton",
    referenceFallbackKeys: ["chinBottom"],
  },
  {
    id: "left_cheek",
    name: "Left Cheek",
    subtitle: "Zygomatic width",
    view: "front",
    howToFind: "Most lateral left cheekbone contour.",
    mediapipeIndex: 234,
    required: true,
    assetKey: "leftCheek",
  },
  {
    id: "right_cheek",
    name: "Right Cheek",
    subtitle: "Zygomatic width",
    view: "front",
    howToFind: "Most lateral right cheekbone contour.",
    mediapipeIndex: 454,
    required: true,
    assetKey: "rightCheek",
  },
  {
    id: "left_temple",
    name: "Left Temple",
    subtitle: "Temporal contour",
    view: "front",
    howToFind: "Left temporal contour near upper lateral face.",
    mediapipeIndex: 54,
    required: false,
    assetKey: "leftTemple",
  },
  {
    id: "right_temple",
    name: "Right Temple",
    subtitle: "Temporal contour",
    view: "front",
    howToFind: "Right temporal contour near upper lateral face.",
    mediapipeIndex: 284,
    required: false,
    assetKey: "rightTemple",
  },
];

const FRONT_REGISTRY_ORDER = [
  "trichion",
  "forehead",
  "glabella",
  "nasion",
  "left_eye_pupil",
  "right_eye_pupil",
  "left_eye_medial_canthus",
  "right_eye_medial_canthus",
  "left_eye_lateral_canthus",
  "right_eye_lateral_canthus",
  "left_eye_upper_eyelid",
  "right_eye_upper_eyelid",
  "left_eye_lower_eyelid",
  "right_eye_lower_eyelid",
  "left_eyelid_hood_end",
  "right_eyelid_hood_end",
  "left_upper_eyelid_crease",
  "right_upper_eyelid_crease",
  "left_brow_head",
  "right_brow_head",
  "left_brow_inner_corner",
  "right_brow_inner_corner",
  "left_brow_arch",
  "right_brow_arch",
  "left_brow_peak",
  "right_brow_peak",
  "left_brow_tail",
  "right_brow_tail",
  "nasal_base",
  "nose_bottom",
  "left_nose_bridge",
  "right_nose_bridge",
  "mouth_left",
  "mouth_right",
  "mouth_middle",
  "cupids_bow",
  "inner_cupids_bow",
  "labrale_superius",
  "labrale_inferius",
  "lower_lip",
  "left_top_gonion",
  "right_top_gonion",
  "left_bottom_gonion",
  "right_bottom_gonion",
  "chin_left",
  "chin_right",
  "chin_bottom",
  "menton",
  "left_cheek",
  "right_cheek",
  "left_temple",
  "right_temple",
] as const;

const FRONT_REGISTRY: LandmarkCalibrationDef[] = FRONT_REGISTRY_ORDER.map((id) => {
  const definition = FRONT_REGISTRY_RAW.find((item) => item.id === id);
  if (!definition) {
    throw new Error(`Missing front landmark definition for '${id}'.`);
  }
  return definition;
});

const SIDE_REGISTRY: LandmarkCalibrationDef[] = [
  {
    id: "vertex",
    name: "Vertex",
    subtitle: "Cranial apex",
    view: "side",
    howToFind: "Highest point of cranial contour in profile.",
    mediapipeIndex: null,
    required: false,
    assetKey: "vertex",
  },
  {
    id: "occiput",
    name: "Occiput",
    subtitle: "Posterior skull contour",
    view: "side",
    howToFind: "Most posterior occipital contour point.",
    mediapipeIndex: null,
    required: false,
    assetKey: "occiput",
  },
  {
    id: "side_glabella",
    name: "Glabella",
    subtitle: "Brow prominence",
    view: "side",
    howToFind: "Brow prominence in profile.",
    mediapipeIndex: 168,
    required: true,
    assetKey: "glabella",
  },
  {
    id: "side_forehead",
    name: "Forehead",
    subtitle: "Frontal contour",
    view: "side",
    howToFind: "Anterior forehead contour.",
    mediapipeIndex: 10,
    required: false,
    assetKey: "forehead",
  },
  {
    id: "side_trichion",
    name: "Trichion",
    subtitle: "Hairline point",
    view: "side",
    howToFind: "Frontal hairline point in profile.",
    mediapipeIndex: 10,
    required: false,
    forceManual: true,
    hairSensitive: true,
    assetKey: "trichion",
  },
  {
    id: "side_nasion",
    name: "Nasion",
    subtitle: "Nasal root",
    view: "side",
    howToFind: "Root of nose between glabella and dorsum.",
    mediapipeIndex: 6,
    required: true,
    assetKey: "nasion",
  },
  {
    id: "rhinion",
    name: "Rhinion",
    subtitle: "Dorsum point",
    view: "side",
    howToFind: "Bony-cartilaginous transition on dorsum.",
    mediapipeIndex: 197,
    required: true,
    assetKey: "rhinion",
  },
  {
    id: "supratip",
    name: "Supratip",
    subtitle: "Above tip",
    view: "side",
    howToFind: "Point immediately above nasal tip.",
    mediapipeIndex: 195,
    required: true,
    assetKey: "supratip",
  },
  {
    id: "infratip",
    name: "Infratip",
    subtitle: "Below tip",
    view: "side",
    howToFind: "Point immediately below nasal tip.",
    mediapipeIndex: 5,
    required: true,
    assetKey: "infratip",
  },
  {
    id: "columella",
    name: "Columella",
    subtitle: "Columellar contour",
    view: "side",
    howToFind: "Central columellar contour.",
    mediapipeIndex: 4,
    required: true,
    assetKey: "columella",
  },
  {
    id: "side_pronasale",
    name: "Pronasale",
    subtitle: "Nasal tip projection",
    view: "side",
    howToFind: "Most projected nasal tip point.",
    mediapipeIndex: 1,
    required: true,
    assetKey: "pronasale",
  },
  {
    id: "side_subnasale",
    name: "Subnasale",
    subtitle: "Nasal base",
    view: "side",
    howToFind: "Junction of columella and upper lip.",
    mediapipeIndex: 2,
    required: true,
    assetKey: "subnasale",
  },
  {
    id: "subalare",
    name: "Subalare",
    subtitle: "Alar base",
    view: "side",
    howToFind: "Base of nostril ala.",
    mediapipeIndex: 98,
    required: false,
    assetKey: "subalare",
  },
  {
    id: "labrale_superius_side",
    name: "Labrale Superius",
    subtitle: "Upper lip projection",
    view: "side",
    howToFind: "Most projected point of upper lip vermillion.",
    mediapipeIndex: 13,
    required: false,
    assetKey: "labraleSuperius",
  },
  {
    id: "cheilion",
    name: "Cheilion",
    subtitle: "Mouth corner",
    view: "side",
    howToFind: "Visible mouth corner in profile.",
    mediapipeIndex: 61,
    required: false,
    assetKey: "cheilion",
  },
  {
    id: "labrale_inferius_side",
    name: "Labrale Inferius",
    subtitle: "Lower lip projection",
    view: "side",
    howToFind: "Most projected point of lower lip vermillion.",
    mediapipeIndex: 14,
    required: false,
    assetKey: "labraleInferius",
  },
  {
    id: "sublabiale",
    name: "Sublabiale",
    subtitle: "Labio-mental sulcus",
    view: "side",
    howToFind: "Deepest point between lower lip and chin.",
    mediapipeIndex: 17,
    required: false,
    assetKey: "sublabiale",
  },
  {
    id: "pogonion",
    name: "Pogonion",
    subtitle: "Chin projection",
    view: "side",
    howToFind: "Most projected point of soft tissue chin.",
    mediapipeIndex: 152,
    required: true,
    assetKey: "pogonion",
  },
  {
    id: "menton_side",
    name: "Menton",
    subtitle: "Lower chin",
    view: "side",
    howToFind: "Lowest soft tissue point of chin profile.",
    mediapipeIndex: 152,
    required: true,
    assetKey: "menton",
  },
  {
    id: "cervical_point",
    name: "Cervical Point",
    subtitle: "Submental-neck transition",
    view: "side",
    howToFind: "Transition point from submental contour to neck.",
    mediapipeIndex: 377,
    required: true,
    assetKey: "cervicalPoint",
  },
  {
    id: "gonion_top",
    name: "Gonion Top",
    subtitle: "Upper jaw angle",
    view: "side",
    howToFind: "Upper mandibular angle contour.",
    mediapipeIndex: 172,
    required: false,
    assetKey: "gonionTop",
  },
  {
    id: "gonion_bottom",
    name: "Gonion Bottom",
    subtitle: "Lower jaw angle",
    view: "side",
    howToFind: "Lower mandibular angle contour.",
    mediapipeIndex: 150,
    required: false,
    assetKey: "gonionBottom",
  },
  {
    id: "porion",
    name: "Porion",
    subtitle: "Ear landmark",
    view: "side",
    howToFind: "Superior border of external auditory opening.",
    mediapipeIndex: 234,
    required: false,
    forceManual: true,
    assetKey: "porion",
  },
  {
    id: "orbitale",
    name: "Orbitale",
    subtitle: "Infraorbital landmark",
    view: "side",
    howToFind: "Lowest point on infraorbital rim.",
    mediapipeIndex: 33,
    required: false,
    assetKey: "orbitale",
  },
  {
    id: "tragus",
    name: "Tragus",
    subtitle: "Ear tragus",
    view: "side",
    howToFind: "Tragus prominence anterior to ear canal.",
    mediapipeIndex: 132,
    required: false,
    forceManual: true,
    assetKey: "tragus",
  },
  {
    id: "intertragic_notch",
    name: "Intertragic Notch",
    subtitle: "Ear notch",
    view: "side",
    howToFind: "Notch between tragus and antitragus.",
    mediapipeIndex: null,
    required: false,
    assetKey: "intertragicNotch",
  },
  {
    id: "corneal_apex",
    name: "Corneal Apex",
    subtitle: "Eye projection",
    view: "side",
    howToFind: "Most projected point of corneal surface.",
    mediapipeIndex: 468,
    required: false,
    assetKey: "cornealApex",
  },
  {
    id: "cheekbone",
    name: "Cheekbone",
    subtitle: "Zygomatic profile",
    view: "side",
    howToFind: "Most projected zygomatic contour in profile.",
    mediapipeIndex: 234,
    required: false,
    assetKey: "cheekbone",
  },
  {
    id: "eyelid_end",
    name: "Eyelid End",
    subtitle: "Lateral eyelid",
    view: "side",
    howToFind: "Lateral end of visible eyelid contour.",
    mediapipeIndex: 33,
    required: false,
    assetKey: "eyelidEnd",
  },
  {
    id: "lower_eyelid_side",
    name: "Lower Eyelid",
    subtitle: "Lower lid profile",
    view: "side",
    howToFind: "Lower eyelid contour in profile.",
    mediapipeIndex: 145,
    required: false,
    assetKey: "lowerEyelid",
  },
  {
    id: "neck_point",
    name: "Neck Point",
    subtitle: "Neck contour",
    view: "side",
    howToFind: "Visible neck contour anchor point.",
    mediapipeIndex: null,
    required: false,
    assetKey: "neckPoint",
  },
];

export const FRONT_LANDMARK_REGISTRY = FRONT_REGISTRY;
export const SIDE_LANDMARK_REGISTRY = SIDE_REGISTRY;
export const LANDMARK_CALIBRATION_REGISTRY: LandmarkCalibrationDef[] = [
  ...FRONT_REGISTRY,
  ...SIDE_REGISTRY,
];

export const LANDMARK_REGISTRY_BY_ID = new Map(
  LANDMARK_CALIBRATION_REGISTRY.map((definition) => [definition.id, definition])
);

const normalizeProfileToken = (token: string, fallback: string) => {
  const value = token.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "middle-eastern") return "middleEastern";
  if (value === "black") return "black";
  if (value === "white") return "white";
  if (value === "asian") return "asian";
  if (value === "latino") return "latino";
  return value.replace(/[^a-z0-9]/g, "") || fallback;
};

export const getReferenceSources = (
  definition: LandmarkCalibrationDef,
  profile: LandmarkProfile
) => {
  const gender = normalizeProfileToken(profile.gender, "male");
  const ethnicity = normalizeProfileToken(profile.ethnicity, "white");
  const keys = [definition.assetKey, ...(definition.referenceFallbackKeys ?? [])];
  const sources: string[] = [];
  for (const key of keys) {
    sources.push(`/landmarks/${gender}/${ethnicity}/${definition.view}/${key}.webp`);
    sources.push(`/landmarks/${gender}/${ethnicity}/${key}.webp`);
    sources.push(`https://beta.faceiqlabs.com/images/landmarks/${gender}/${ethnicity}/${key}.webp?v=1`);
  }
  return {
    sources: dedupe(sources),
  };
};

type InitArgs = {
  frontLandmarks: Landmark[];
  sideLandmarks: Landmark[];
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
};

const isSideCalibrationEnabled = (quality: PhotoQuality) => {
  if (!quality.landmarkCount) return false;
  if (quality.reasonCodes.includes("side_disabled")) return false;
  if (quality.viewWeight <= 0.1) return false;
  return true;
};

export const initManualLandmarks = ({
  frontLandmarks,
  sideLandmarks,
  frontQuality,
  sideQuality,
}: InitArgs): ManualLandmarkPoint[] => {
  const sideEnabled = isSideCalibrationEnabled(sideQuality);
  const frontNorm = normalizeLandmarkArray(frontLandmarks);
  const sideNorm = normalizeLandmarkArray(sideLandmarks);

  return LANDMARK_CALIBRATION_REGISTRY.map((definition) => {
    const viewLandmarks = definition.view === "front" ? frontNorm : sideNorm;
    const quality = definition.view === "front" ? frontQuality : sideQuality;
    const detectedPoint = pointAtNormalized(viewLandmarks, definition.mediapipeIndex);
    const heuristicPoint = detectedPoint ? null : heuristicsForPoint(definition, viewLandmarks);
    const rawPoint = detectedPoint ?? heuristicPoint;
    const confidenceData = initConfidence(definition, rawPoint, quality);
    const confidence =
      !detectedPoint && rawPoint ? Math.min(confidenceData.confidence, 0.62) : confidenceData.confidence;
    const required = definition.view === "side" && !sideEnabled ? false : definition.required;

    return {
      id: definition.id,
      name: definition.name,
      view: definition.view,
      x: rawPoint?.x ?? 0.5,
      y: rawPoint?.y ?? 0.5,
      source: "auto",
      confidence,
      reasonCodes: dedupe([
        ...quality.reasonCodes,
        ...confidenceData.reasons,
        ...(!detectedPoint && rawPoint ? ["heuristic_seed"] : []),
        ...(definition.view === "side" && !sideEnabled ? ["side_not_suitable"] : []),
      ]),
      confirmed: false,
      required,
      mediapipeIndex: definition.mediapipeIndex,
    } satisfies ManualLandmarkPoint;
  });
};

export const countManualCompletion = (
  points: ManualLandmarkPoint[],
  view?: LandmarkCalibrationView
) => {
  const filtered = view ? points.filter((point) => point.view === view) : points;
  const required = filtered.filter((point) => point.required).length;
  const requiredConfirmed = filtered.filter(
    (point) => point.required && point.confirmed
  ).length;
  const totalConfirmed = filtered.filter((point) => point.confirmed).length;

  return {
    total: filtered.length,
    totalConfirmed,
    required,
    requiredConfirmed,
    ready: required > 0 ? requiredConfirmed >= required : true,
  };
};
