import type { FaceIQRatios } from "./scoring";

export type CohortGender = "male" | "female";
export type CohortAge = "young" | "mature";

// Keep these stable: UI values in `components/page-parts/steps/EthnicityStep.tsx` map directly.
export const COHORT_ETHNICITIES = [
  "asian",
  "black",
  "latino",
  "middle_eastern",
  "white",
  // Extra cohorts for parity with the 32-cohort requirement (not currently selectable in UI).
  "south_asian",
  "east_asian",
  "mixed",
] as const;

export type CohortEthnicity = (typeof COHORT_ETHNICITIES)[number];
export type CohortKey = `${CohortEthnicity}_${CohortGender}_${CohortAge}`;

export const DEFAULT_COHORT_KEY: CohortKey = "white_male_young";

export const BASE_COHORT: FaceIQRatios = {
  // HARMONY (20)
  fWHR: 0.95,
  verticalThirds: 1,
  horizontalFifths: 0.42,
  eyeMouthRatio: 0.95,
  jawCheekRatio: 0.88,
  symmetryError: 0.035,
  phiFaceHeight: 1.62,
  ipdToFaceWidth: 0.42,
  intercanthalToIPD: 0.38,
  mouthToNoseWidth: 1.55,
  noseWidthToFaceWidth: 0.24,
  mouthWidthToFaceWidth: 0.46,
  browToEyeHeight: 0.19,
  browToMouthHeight: 0.62,
  noseToChinHeight: 0.63,
  jawWidthToFaceWidth: 0.82,
  chinWidthToJawWidth: 0.32,
  cheekboneToTempleWidth: 0.92,
  eyeWidthToFaceWidth: 0.76,
  noseLengthToFaceHeight: 0.36,

  // ANGULARITY (15)
  gonialAngleL: 124,
  gonialAngleR: 124,
  gonialAngleAvg: 124,
  bigonialWidth: 0.52,
  ramusHeightL: 0.22,
  ramusHeightR: 0.22,
  jawlineSlopeL: 14,
  jawlineSlopeR: 14,
  chinProjection: 0.12,
  facialConvexity: 165,
  mandibularPlaneAngle: 26,
  neckChinAngle: 118,
  browRidgeAngle: 150,
  jawNeckRatio: 0.72,
  cheekboneProjection: 0.08,

  // DIMORPHISM (10)
  lowerFaceRatio: 0.78,
  jawFaceRatio: 0.82,
  chinTaper: 0.32,
  jawCheekStrength: 0.88,
  faceLengthToWidth: 1.05,
  browToJawHeightRatio: 0.62,
  eyeSizeRatio: 0.22,
  noseSizeRatio: 0.34,
  mouthSizeRatio: 0.46,
  cheekProminenceRatio: 1.08,

  // FEATURES (15)
  canthalTiltL: 6,
  canthalTiltR: 6,
  eyeAspectRatioL: 0.22,
  eyeAspectRatioR: 0.22,
  nasalIndex: 0.65,
  philtrumLength: 0.12,
  lipHeightRatio: 0.2,
  cupidBowDepth: 0.08,
  noseBridgeWidthRatio: 0.22,
  eyeBrowDistanceL: 0.08,
  eyeBrowDistanceR: 0.08,
  upperLipProjection: 0.06,
  lowerLipProjection: 0.05,
  dorsumStraightness: 0.02,
  earJawDistanceRatio: 0.38,
};

const GENDER_MODS: Record<CohortGender, Partial<FaceIQRatios>> = {
  male: {
    jawCheekRatio: 0.9,
    jawWidthToFaceWidth: 0.83,
    chinProjection: 0.13,
    gonialAngleAvg: 122,
    browRidgeAngle: 152,
    eyeSizeRatio: 0.21,
    lipHeightRatio: 0.19,
  },
  female: {
    jawCheekRatio: 0.86,
    jawWidthToFaceWidth: 0.8,
    chinProjection: 0.11,
    gonialAngleAvg: 126,
    browRidgeAngle: 148,
    eyeSizeRatio: 0.235,
    lipHeightRatio: 0.215,
  },
};

const AGE_MODS: Record<CohortAge, Partial<FaceIQRatios>> = {
  young: {},
  mature: {
    symmetryError: 0.038,
    phiFaceHeight: 1.6,
    jawNeckRatio: 0.74,
    browToJawHeightRatio: 0.64,
  },
};

const ETHNICITY_MODS: Record<CohortEthnicity, Partial<FaceIQRatios>> = {
  asian: {
    nasalIndex: 0.67,
    noseWidthToFaceWidth: 0.25,
    intercanthalToIPD: 0.385,
  },
  east_asian: {
    nasalIndex: 0.675,
    noseWidthToFaceWidth: 0.25,
    intercanthalToIPD: 0.39,
  },
  south_asian: {
    nasalIndex: 0.69,
    noseWidthToFaceWidth: 0.245,
    phiFaceHeight: 1.61,
  },
  black: {
    nasalIndex: 0.75,
    noseWidthToFaceWidth: 0.27,
    mouthWidthToFaceWidth: 0.48,
    lipHeightRatio: 0.22,
  },
  latino: {
    nasalIndex: 0.7,
    noseWidthToFaceWidth: 0.255,
    mouthWidthToFaceWidth: 0.47,
  },
  middle_eastern: {
    nasalIndex: 0.68,
    noseLengthToFaceHeight: 0.37,
    noseBridgeWidthRatio: 0.23,
  },
  white: {
    nasalIndex: 0.64,
    noseWidthToFaceWidth: 0.235,
    noseLengthToFaceHeight: 0.365,
  },
  mixed: {},
};

const mergeCohort = (...parts: Array<Partial<FaceIQRatios>>): FaceIQRatios => {
  return Object.assign({}, BASE_COHORT, ...parts);
};

const buildCohorts = (): Record<CohortKey, FaceIQRatios> => {
  const genders: CohortGender[] = ["male", "female"];
  const ages: CohortAge[] = ["young", "mature"];
  const output = {} as Record<CohortKey, FaceIQRatios>;

  for (const ethnicity of COHORT_ETHNICITIES) {
    for (const gender of genders) {
      for (const age of ages) {
        const key = `${ethnicity}_${gender}_${age}` as CohortKey;
        output[key] = mergeCohort(
          ETHNICITY_MODS[ethnicity],
          GENDER_MODS[gender],
          AGE_MODS[age]
        );
      }
    }
  }

  return output;
};

export const FACEIQ_COHORTS: Record<CohortKey, FaceIQRatios> = buildCohorts();

