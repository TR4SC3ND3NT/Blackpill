import type { Landmark, ManualLandmarkPoint, PhotoQuality } from "./types";

export type LandmarkCalibrationView = "front" | "side";

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
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const dedupe = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const pointAt = (points: Landmark[], index: number | null): Landmark | null => {
  if (index == null) return null;
  if (index < 0 || index >= points.length) return null;
  const point = points[index];
  if (!point) return null;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point;
};

const normalizePoint = (point: Landmark | null) => {
  if (!point) return null;
  const x = point.x <= 2 ? point.x : point.x / 1024;
  const y = point.y <= 2 ? point.y : point.y / 1024;
  return {
    x: clamp01(x),
    y: clamp01(y),
    visibility:
      point.visibility == null || !Number.isFinite(point.visibility)
        ? 1
        : clamp01(point.visibility),
  };
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
      requiresManual: true,
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
    confidence = Math.min(confidence, 0.4);
    reasons.push("hair_occlusion");
  }
  if (def.forceManual) {
    confidence = Math.min(confidence, 0.42);
    reasons.push("manual_required");
  }

  const requiresManual = def.forceManual || confidence < 0.58 || reasons.includes("hair_occlusion");
  return {
    confidence: clamp01(confidence),
    reasons,
    requiresManual,
  };
};

export const LANDMARK_CALIBRATION_REGISTRY: LandmarkCalibrationDef[] = [
  {
    id: "trichion",
    name: "Hairline",
    subtitle: "Trichion (front view)",
    view: "front",
    howToFind:
      "Place this on the central hairline transition. If hair covers the line, move to the most probable natural boundary.",
    mediapipeIndex: 10,
    required: false,
    forceManual: true,
    hairSensitive: true,
  },
  {
    id: "glabella",
    name: "Glabella",
    subtitle: "Between eyebrows",
    view: "front",
    howToFind:
      "Set the midpoint between the inner brows, above the nasal root.",
    mediapipeIndex: 9,
    required: false,
  },
  {
    id: "left_eye_pupil",
    name: "Left Pupil",
    subtitle: "Pupillary center",
    view: "front",
    howToFind: "Center on the visible left pupil.",
    mediapipeIndex: 468,
    required: false,
  },
  {
    id: "right_eye_pupil",
    name: "Right Pupil",
    subtitle: "Pupillary center",
    view: "front",
    howToFind: "Center on the visible right pupil.",
    mediapipeIndex: 473,
    required: false,
  },
  {
    id: "left_eye_lateral_canthus",
    name: "Left Eye Lateral Canthus",
    subtitle: "Outer eye corner",
    view: "front",
    howToFind: "Place on the outer corner where upper/lower lids meet.",
    mediapipeIndex: 33,
    required: true,
  },
  {
    id: "left_eye_medial_canthus",
    name: "Left Eye Medial Canthus",
    subtitle: "Inner eye corner",
    view: "front",
    howToFind: "Place on the inner corner nearest the nose bridge.",
    mediapipeIndex: 133,
    required: true,
  },
  {
    id: "right_eye_medial_canthus",
    name: "Right Eye Medial Canthus",
    subtitle: "Inner eye corner",
    view: "front",
    howToFind: "Place on the inner corner nearest the nose bridge.",
    mediapipeIndex: 362,
    required: true,
  },
  {
    id: "right_eye_lateral_canthus",
    name: "Right Eye Lateral Canthus",
    subtitle: "Outer eye corner",
    view: "front",
    howToFind: "Place on the outer corner where upper/lower lids meet.",
    mediapipeIndex: 263,
    required: true,
  },
  {
    id: "left_eye_upper_eyelid",
    name: "Left Upper Eyelid",
    subtitle: "Upper lid apex",
    view: "front",
    howToFind: "Mark the highest point of the visible upper left eyelid.",
    mediapipeIndex: 159,
    required: true,
  },
  {
    id: "left_eye_lower_eyelid",
    name: "Left Lower Eyelid",
    subtitle: "Lower lid apex",
    view: "front",
    howToFind: "Mark the lowest point of the visible lower left eyelid.",
    mediapipeIndex: 145,
    required: true,
  },
  {
    id: "right_eye_upper_eyelid",
    name: "Right Upper Eyelid",
    subtitle: "Upper lid apex",
    view: "front",
    howToFind: "Mark the highest point of the visible upper right eyelid.",
    mediapipeIndex: 386,
    required: true,
  },
  {
    id: "right_eye_lower_eyelid",
    name: "Right Lower Eyelid",
    subtitle: "Lower lid apex",
    view: "front",
    howToFind: "Mark the lowest point of the visible lower right eyelid.",
    mediapipeIndex: 374,
    required: true,
  },
  {
    id: "left_midface",
    name: "Left Midface",
    subtitle: "Infraorbital contour",
    view: "front",
    howToFind: "Place on the left lateral midface under the outer eye region.",
    mediapipeIndex: 93,
    required: true,
  },
  {
    id: "right_midface",
    name: "Right Midface",
    subtitle: "Infraorbital contour",
    view: "front",
    howToFind: "Place on the right lateral midface under the outer eye region.",
    mediapipeIndex: 323,
    required: true,
  },
  {
    id: "left_face_side",
    name: "Left Face Side",
    subtitle: "Lateral facial border",
    view: "front",
    howToFind: "Place on the left lateral border around malar-jaw transition.",
    mediapipeIndex: 132,
    required: true,
  },
  {
    id: "right_face_side",
    name: "Right Face Side",
    subtitle: "Lateral facial border",
    view: "front",
    howToFind: "Place on the right lateral border around malar-jaw transition.",
    mediapipeIndex: 361,
    required: true,
  },
  {
    id: "left_upper_jaw",
    name: "Left Upper Jaw",
    subtitle: "Lateral lower-third",
    view: "front",
    howToFind: "Place on upper-lateral lower face (left) near mandibular contour.",
    mediapipeIndex: 58,
    required: true,
  },
  {
    id: "right_upper_jaw",
    name: "Right Upper Jaw",
    subtitle: "Lateral lower-third",
    view: "front",
    howToFind: "Place on upper-lateral lower face (right) near mandibular contour.",
    mediapipeIndex: 288,
    required: true,
  },
  {
    id: "left_cheek",
    name: "Left Cheek",
    subtitle: "Zygomatic width",
    view: "front",
    howToFind: "Place on the most lateral visible left cheekbone contour.",
    mediapipeIndex: 234,
    required: true,
  },
  {
    id: "right_cheek",
    name: "Right Cheek",
    subtitle: "Zygomatic width",
    view: "front",
    howToFind: "Place on the most lateral visible right cheekbone contour.",
    mediapipeIndex: 454,
    required: true,
  },
  {
    id: "left_top_gonion",
    name: "Left Top Gonion",
    subtitle: "Jaw angle upper",
    view: "front",
    howToFind: "Place on upper gonial contour (left side).",
    mediapipeIndex: 172,
    required: true,
  },
  {
    id: "right_top_gonion",
    name: "Right Top Gonion",
    subtitle: "Jaw angle upper",
    view: "front",
    howToFind: "Place on upper gonial contour (right side).",
    mediapipeIndex: 397,
    required: true,
  },
  {
    id: "left_bottom_gonion",
    name: "Left Bottom Gonion",
    subtitle: "Jaw angle lower",
    view: "front",
    howToFind: "Place on lower gonial contour (left side).",
    mediapipeIndex: 150,
    required: true,
  },
  {
    id: "right_bottom_gonion",
    name: "Right Bottom Gonion",
    subtitle: "Jaw angle lower",
    view: "front",
    howToFind: "Place on lower gonial contour (right side).",
    mediapipeIndex: 379,
    required: true,
  },
  {
    id: "nasion",
    name: "Nasion",
    subtitle: "Nasal root",
    view: "front",
    howToFind: "Place at the nasal root between eyes where bridge begins.",
    mediapipeIndex: 6,
    required: true,
  },
  {
    id: "pronasale",
    name: "Pronasale",
    subtitle: "Nasal tip",
    view: "front",
    howToFind: "Place at the most projecting nasal tip point.",
    mediapipeIndex: 1,
    required: true,
  },
  {
    id: "subnasale",
    name: "Subnasale",
    subtitle: "Nose base midpoint",
    view: "front",
    howToFind: "Place where columella meets upper lip at center.",
    mediapipeIndex: 2,
    required: true,
  },
  {
    id: "left_nose_bridge",
    name: "Left Nose Bridge",
    subtitle: "Lateral nasal bridge",
    view: "front",
    howToFind: "Place on left bridge contour where bony dorsum transitions.",
    mediapipeIndex: 98,
    required: true,
  },
  {
    id: "right_nose_bridge",
    name: "Right Nose Bridge",
    subtitle: "Lateral nasal bridge",
    view: "front",
    howToFind: "Place on right bridge contour where bony dorsum transitions.",
    mediapipeIndex: 327,
    required: true,
  },
  {
    id: "mouth_left",
    name: "Mouth Left",
    subtitle: "Left cheilion",
    view: "front",
    howToFind: "Place at left mouth corner.",
    mediapipeIndex: 61,
    required: true,
  },
  {
    id: "mouth_right",
    name: "Mouth Right",
    subtitle: "Right cheilion",
    view: "front",
    howToFind: "Place at right mouth corner.",
    mediapipeIndex: 291,
    required: true,
  },
  {
    id: "cupids_bow",
    name: "Cupid's Bow",
    subtitle: "Upper vermillion center",
    view: "front",
    howToFind: "Place at central upper-lip bow point.",
    mediapipeIndex: 13,
    required: true,
  },
  {
    id: "labrale_inferius",
    name: "Labrale Inferius",
    subtitle: "Lower vermillion center",
    view: "front",
    howToFind: "Place at central lower-lip vermillion border.",
    mediapipeIndex: 14,
    required: true,
  },
  {
    id: "chin_left",
    name: "Chin Left",
    subtitle: "Left menton flank",
    view: "front",
    howToFind: "Place on left lateral chin border.",
    mediapipeIndex: 149,
    required: true,
  },
  {
    id: "chin_right",
    name: "Chin Right",
    subtitle: "Right menton flank",
    view: "front",
    howToFind: "Place on right lateral chin border.",
    mediapipeIndex: 378,
    required: true,
  },
  {
    id: "menton",
    name: "Menton",
    subtitle: "Lowest chin point",
    view: "front",
    howToFind: "Place at the lowest visible point of the chin.",
    mediapipeIndex: 152,
    required: true,
  },
  {
    id: "side_glabella",
    name: "Glabella",
    subtitle: "Profile brow prominence",
    view: "side",
    howToFind: "Place on brow prominence in profile.",
    mediapipeIndex: 168,
    required: true,
  },
  {
    id: "side_nasion",
    name: "Nasion",
    subtitle: "Profile nasal root",
    view: "side",
    howToFind: "Place where frontal bone transitions into nasal bridge.",
    mediapipeIndex: 6,
    required: true,
  },
  {
    id: "side_rhinion",
    name: "Rhinion",
    subtitle: "Nasal dorsum",
    view: "side",
    howToFind: "Place on dorsal ridge around the bony-cartilaginous transition.",
    mediapipeIndex: 197,
    required: true,
  },
  {
    id: "side_supratip",
    name: "Supratip",
    subtitle: "Above nasal tip",
    view: "side",
    howToFind: "Place on supratip point just proximal to nasal tip.",
    mediapipeIndex: 195,
    required: true,
  },
  {
    id: "side_infratip",
    name: "Infratip",
    subtitle: "Below tip",
    view: "side",
    howToFind: "Place just distal to tip along columellar segment.",
    mediapipeIndex: 5,
    required: true,
  },
  {
    id: "side_columella",
    name: "Columella",
    subtitle: "Columellar apex",
    view: "side",
    howToFind: "Place on central columellar contour in profile.",
    mediapipeIndex: 4,
    required: true,
  },
  {
    id: "side_pronasale",
    name: "Pronasale",
    subtitle: "Profile nasal tip",
    view: "side",
    howToFind: "Place at the furthest forward nasal tip point.",
    mediapipeIndex: 1,
    required: true,
  },
  {
    id: "side_subnasale",
    name: "Subnasale",
    subtitle: "Nasal base",
    view: "side",
    howToFind: "Place where columella meets upper lip in profile.",
    mediapipeIndex: 2,
    required: true,
  },
  {
    id: "side_pogonion",
    name: "Pogonion",
    subtitle: "Most projecting chin point",
    view: "side",
    howToFind: "Place at the most anterior point of soft-tissue chin.",
    mediapipeIndex: 152,
    required: true,
  },
  {
    id: "side_cervical_point",
    name: "Cervical Point",
    subtitle: "Submental-neck transition",
    view: "side",
    howToFind: "Place where submental contour transitions into neck plane.",
    mediapipeIndex: 377,
    required: false,
  },
  {
    id: "side_gonion_top",
    name: "Gonion Top",
    subtitle: "Mandibular angle upper",
    view: "side",
    howToFind: "Place on upper mandibular angle contour.",
    mediapipeIndex: 172,
    required: false,
  },
  {
    id: "side_gonion_bottom",
    name: "Gonion Bottom",
    subtitle: "Mandibular angle lower",
    view: "side",
    howToFind: "Place on lower mandibular angle contour.",
    mediapipeIndex: 150,
    required: false,
  },
  {
    id: "side_porion",
    name: "Porion",
    subtitle: "External auditory reference",
    view: "side",
    howToFind: "Place near superior border of external auditory opening.",
    mediapipeIndex: 234,
    required: false,
    forceManual: true,
  },
  {
    id: "side_tragus",
    name: "Tragus",
    subtitle: "Ear tragus",
    view: "side",
    howToFind: "Place on tragus prominence anterior to ear canal.",
    mediapipeIndex: 132,
    required: false,
    forceManual: true,
  },
  {
    id: "side_orbitale",
    name: "Orbitale",
    subtitle: "Inferior orbital rim",
    view: "side",
    howToFind: "Place at the lowest visible infraorbital rim point.",
    mediapipeIndex: 33,
    required: false,
  },
  {
    id: "side_corneal_apex",
    name: "Corneal Apex",
    subtitle: "Eye apex in profile",
    view: "side",
    howToFind: "Place at central corneal bulge on visible eye.",
    mediapipeIndex: 468,
    required: false,
  },
];

export const LANDMARK_REGISTRY_BY_ID = new Map(
  LANDMARK_CALIBRATION_REGISTRY.map((definition) => [definition.id, definition])
);

type InitArgs = {
  frontLandmarks: Landmark[];
  sideLandmarks: Landmark[];
  frontQuality: PhotoQuality;
  sideQuality: PhotoQuality;
};

export const initManualLandmarks = ({
  frontLandmarks,
  sideLandmarks,
  frontQuality,
  sideQuality,
}: InitArgs): ManualLandmarkPoint[] => {
  return LANDMARK_CALIBRATION_REGISTRY.map((definition) => {
    const viewLandmarks = definition.view === "front" ? frontLandmarks : sideLandmarks;
    const quality = definition.view === "front" ? frontQuality : sideQuality;
    const rawPoint = normalizePoint(pointAt(viewLandmarks, definition.mediapipeIndex));
    const confidenceData = initConfidence(definition, rawPoint, quality);

    return {
      id: definition.id,
      name: definition.name,
      view: definition.view,
      x: rawPoint?.x ?? 0.5,
      y: rawPoint?.y ?? 0.5,
      source: "auto",
      confidence: confidenceData.confidence,
      reasonCodes: dedupe([...quality.reasonCodes, ...confidenceData.reasons]),
      confirmed: false,
      required: definition.required,
      mediapipeIndex: definition.mediapipeIndex,
    } satisfies ManualLandmarkPoint;
  });
};

const ensureLength = (points: Landmark[], targetLength: number) => {
  if (points.length >= targetLength) return [...points];
  const next = [...points];
  while (next.length < targetLength) {
    next.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
  }
  return next;
};

export const applyManualLandmarks = (
  frontLandmarks: Landmark[],
  sideLandmarks: Landmark[],
  manualPoints: ManualLandmarkPoint[]
) => {
  const front = ensureLength(frontLandmarks, 478);
  const side = ensureLength(sideLandmarks, 478);

  for (const point of manualPoints) {
    if (!point.confirmed || point.mediapipeIndex == null) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

    const target = point.view === "front" ? front : side;
    const index = point.mediapipeIndex;
    if (index < 0 || index >= target.length) continue;

    const base = target[index] ?? { x: 0.5, y: 0.5, z: 0 };
    target[index] = {
      x: clamp01(point.x),
      y: clamp01(point.y),
      z: base.z ?? 0,
      visibility: 1,
    };
  }

  return { front, side };
};

export const countManualCompletion = (points: ManualLandmarkPoint[]) => {
  const required = points.filter((point) => point.required).length;
  const requiredConfirmed = points.filter(
    (point) => point.required && point.confirmed
  ).length;
  const totalConfirmed = points.filter((point) => point.confirmed).length;

  return {
    total: points.length,
    totalConfirmed,
    required,
    requiredConfirmed,
    ready: required > 0 ? requiredConfirmed >= required : true,
  };
};
