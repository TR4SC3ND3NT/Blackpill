import type { Assessment, Landmark, PhotoQuality } from "./types";
import { normalizeLandmarks, type LandmarkInput } from "./landmarks";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const blendWithConfidence = (score: number, confidence: number, neutral = 56) => {
  const c = clamp01(confidence);
  return clamp(score * c + neutral * (1 - c));
};

const confidenceFloor = (confidence: number) => {
  if (confidence >= 0.82) return 6;
  if (confidence >= 0.62) return 12;
  if (confidence >= 0.42) return 18;
  return 22;
};

const stabilizeScore = (score: number, confidence: number, neutral = 56) => {
  const c = clamp01(confidence);
  const blended = blendWithConfidence(score, c, neutral);
  return clamp(blended, confidenceFloor(c), 98);
};

const severityFromScore = (score: number): Assessment["severity"] => {
  if (score >= 75) return "low";
  if (score >= 55) return "medium";
  return "high";
};

const noteFor = (score: number, high: string, mid: string, low: string) => {
  if (score >= 75) return high;
  if (score >= 55) return mid;
  return low;
};

const buildAssessments = (
  items: Array<{ title: string; score: number; notes: [string, string, string] }>
): Assessment[] =>
  items.map((item) => ({
    title: item.title,
    score: clamp(Math.round(item.score)),
    note: noteFor(item.score, ...item.notes),
    severity: severityFromScore(item.score),
  }));

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

const getPoint = (points: Landmark[], index: number) =>
  index >= 0 && index < points.length ? points[index] : null;

const getBBox = (points: Landmark[]) => {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  const xs = points.map((pt) => pt.x);
  const ys = points.map((pt) => pt.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  return { minX, maxX, minY, maxY, width, height };
};

const MIRROR_PAIRS: Array<[number, number]> = [
  [33, 263],
  [133, 362],
  [61, 291],
  [234, 454],
  [172, 397],
  [58, 288],
  [136, 365],
  [150, 379],
  [176, 400],
  [93, 323],
  [132, 361],
  [70, 300],
];

const computeSymmetryScore = (front: Landmark[]) => {
  const errors: number[] = [];
  for (const [leftIdx, rightIdx] of MIRROR_PAIRS) {
    const left = getPoint(front, leftIdx);
    const right = getPoint(front, rightIdx);
    if (!left || !right) continue;
    const horizontalError = Math.abs(left.x + right.x - 1);
    const verticalError = Math.abs(left.y - right.y);
    errors.push(horizontalError * 360 + verticalError * 220);
  }
  if (!errors.length) return 45;
  return clamp(100 - avg(errors));
};

const computeFrontMetrics = (front: Landmark[]) => {
  if (!front.length) {
    return {
      frontScore: 24,
      symmetryScore: 22,
      ratioScore: 24,
      eyeSpacingScore: 20,
      mouthScore: 22,
      verticalBalanceScore: 24,
      jawRatioScore: 22,
      chinProjectionScore: 24,
    };
  }

  const bbox = getBBox(front);
  const widthHeightRatio = bbox.width / Math.max(bbox.height, 1e-6);
  const ratioScore = clamp(100 - Math.abs(widthHeightRatio - 0.68) * 230);

  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  const centerScore = clamp(
    100 - Math.abs(centerX - 0.5) * 170 - Math.abs(centerY - 0.5) * 100
  );

  const leftEyeInner = getPoint(front, 133);
  const rightEyeInner = getPoint(front, 362);
  const leftMouth = getPoint(front, 61);
  const rightMouth = getPoint(front, 291);
  const noseTip = getPoint(front, 1);
  const forehead = getPoint(front, 10);
  const chin = getPoint(front, 152);
  const jawLeft = getPoint(front, 172) ?? getPoint(front, 234);
  const jawRight = getPoint(front, 397) ?? getPoint(front, 454);
  const cheekLeft = getPoint(front, 234);
  const cheekRight = getPoint(front, 454);

  const symmetryScore = computeSymmetryScore(front);

  const faceWidth = cheekLeft && cheekRight ? dist(cheekLeft, cheekRight) : bbox.width;
  const faceHeight = forehead && chin ? dist(forehead, chin) : bbox.height;

  const eyeSpacingRatio =
    leftEyeInner && rightEyeInner ? dist(leftEyeInner, rightEyeInner) / Math.max(faceWidth, 1e-6) : 0;
  const mouthRatio =
    leftMouth && rightMouth ? dist(leftMouth, rightMouth) / Math.max(faceWidth, 1e-6) : 0;

  const eyeSpacingScore = eyeSpacingRatio
    ? clamp(100 - Math.abs(eyeSpacingRatio - 0.35) * 300)
    : 45;
  const mouthScore = mouthRatio ? clamp(100 - Math.abs(mouthRatio - 0.39) * 310) : 45;

  const upperFace = forehead && noseTip ? dist(forehead, noseTip) : 0;
  const lowerFace = noseTip && chin ? dist(noseTip, chin) : 0;
  const verticalBalance =
    upperFace > 1e-6 && lowerFace > 1e-6 ? upperFace / lowerFace : 0;
  const verticalBalanceScore = verticalBalance
    ? clamp(100 - Math.abs(verticalBalance - 0.9) * 180)
    : 45;

  const jawWidth = jawLeft && jawRight ? dist(jawLeft, jawRight) : faceWidth * 0.85;
  const jawRatio = jawWidth / Math.max(faceWidth, 1e-6);
  const jawRatioScore = clamp(100 - Math.abs(jawRatio - 0.89) * 260);

  const chinProjection =
    noseTip && chin ? Math.abs(noseTip.y - chin.y) / Math.max(faceHeight, 1e-6) : 0;
  const chinProjectionScore = chinProjection
    ? clamp(100 - Math.abs(chinProjection - 0.43) * 220)
    : 45;

  const frontScore = clamp(
    ratioScore * 0.2 +
      centerScore * 0.14 +
      symmetryScore * 0.24 +
      eyeSpacingScore * 0.14 +
      mouthScore * 0.1 +
      verticalBalanceScore * 0.1 +
      jawRatioScore * 0.08
  );

  return {
    frontScore,
    symmetryScore,
    ratioScore,
    eyeSpacingScore,
    mouthScore,
    verticalBalanceScore,
    jawRatioScore,
    chinProjectionScore,
  };
};

const computeSideMetrics = (side: Landmark[], sideQuality?: PhotoQuality | null) => {
  if (!side.length) {
    return {
      sideScore: 20,
      profileRatioScore: 22,
      poseScore: 20,
      depthScore: 20,
    };
  }

  const bbox = getBBox(side);
  const ratio = bbox.width / Math.max(bbox.height, 1e-6);
  const profileRatioScore = clamp(100 - Math.abs(ratio - 0.64) * 170);

  const poseYaw = sideQuality?.poseYaw;
  const absYaw = poseYaw == null ? null : Math.abs(poseYaw);
  const yawScore = absYaw == null ? 62 : clamp(100 - Math.abs(absYaw - 24) * 2.4);
  const viewAdjust =
    sideQuality?.detectedView === "side"
      ? 10
      : sideQuality?.detectedView === "front"
        ? -14
        : 0;
  const poseScore = clamp(yawScore + viewAdjust);

  const noseTip = getPoint(side, 1);
  const chin = getPoint(side, 152);
  const depthRatio =
    noseTip && chin ? Math.abs(noseTip.x - chin.x) / Math.max(bbox.width, 1e-6) : 0;
  const depthScore = depthRatio
    ? clamp(100 - Math.abs(depthRatio - 0.19) * 190)
    : 52;

  const sideScore = clamp(
    profileRatioScore * 0.38 + poseScore * 0.34 + depthScore * 0.28
  );

  return {
    sideScore,
    profileRatioScore,
    poseScore,
    depthScore,
  };
};

const issuePenalty = (quality?: PhotoQuality | null, scale = 1) => {
  if (!quality) return 0;
  return Math.min(8 * scale, (quality.issues.length ?? 0) * 0.9 * scale);
};

const landmarkConfidence = (count: number, quality?: PhotoQuality | null) => {
  if (count <= 0) return 0;
  const countFactor = clamp01(count / 478);
  const qualityFactor = quality?.quality === "ok" ? 1 : 0.88;
  const frameFactor = quality?.faceInFrame === false ? 0.82 : 1;
  return clamp01(countFactor * qualityFactor * frameFactor);
};

const computeQualityPenalty = (
  frontCount: number,
  sideCount: number,
  frontQuality?: PhotoQuality | null,
  sideQuality?: PhotoQuality | null
) => {
  let penalty = 0;

  if (frontCount < 300) penalty += 6;
  if (frontCount < 180) penalty += 10;

  if (sideCount < 300) penalty += 5;
  if (sideCount < 140) penalty += 9;

  if (frontQuality?.quality === "low") penalty += 7;
  if (sideQuality?.quality === "low") penalty += 6;

  if (frontQuality?.faceInFrame === false) penalty += 5;
  if (sideQuality?.faceInFrame === false) penalty += 4;

  if (frontQuality && frontQuality.blurVariance < 80) penalty += 3;
  if (sideQuality && sideQuality.blurVariance < 80) penalty += 2;

  if (sideCount === 0) penalty += 16;

  penalty += issuePenalty(frontQuality, 0.8);
  penalty += issuePenalty(sideQuality, 0.8);

  return clamp(penalty, 0, 32);
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

  const frontCount = front.length;
  const sideCount = side.length;

  if (!frontCount) {
    const fallback = {
      overallScore: 34,
      harmonyScore: 35,
      frontHarmonyScore: 33,
      sideHarmonyScore: sideCount ? 36 : 22,
      dimorphismScore: 34,
      angularityScore: 33,
      featuresScore: 36,
    };

    return {
      ...fallback,
      angularityAssessments: buildAssessments([
        {
          title: "Jawline definition",
          score: 34,
          notes: [
            "Structured lower face contour.",
            "Moderate jawline definition.",
            "Low-confidence jawline estimate due to detection quality.",
          ],
        },
        {
          title: "Cheek contour",
          score: 33,
          notes: [
            "Cheek contour appears clear.",
            "Average cheek contour.",
            "Cheek contour estimate is uncertain.",
          ],
        },
        {
          title: "Chin projection",
          score: 32,
          notes: [
            "Balanced chin projection.",
            "Slightly soft chin projection.",
            "Projection estimate is low-confidence.",
          ],
        },
      ]),
      dimorphismAssessments: buildAssessments([
        {
          title: "Facial contrast",
          score: 34,
          notes: [
            "Good structural contrast.",
            "Moderate contrast.",
            "Contrast estimate is uncertain due to missing landmarks.",
          ],
        },
        {
          title: "Lower-face robustness",
          score: 33,
          notes: [
            "Lower face appears robust.",
            "Average lower-face robustness.",
            "Insufficient landmark confidence.",
          ],
        },
        {
          title: "Profile depth",
          score: sideCount ? 35 : 22,
          notes: [
            "Strong profile depth.",
            "Moderate profile depth.",
            "Profile depth unavailable or low-confidence.",
          ],
        },
      ]),
      featuresAssessments: buildAssessments([
        {
          title: "Eye spacing",
          score: 35,
          notes: [
            "Eye spacing looks balanced.",
            "Eye spacing is near average.",
            "Eye spacing estimate is low-confidence.",
          ],
        },
        {
          title: "Nasal proportion",
          score: 36,
          notes: [
            "Nasal proportion appears balanced.",
            "Slight nasal proportion drift.",
            "Nasal estimate is uncertain.",
          ],
        },
        {
          title: "Lip balance",
          score: 35,
          notes: [
            "Lip balance appears solid.",
            "Minor lip balance asymmetry.",
            "Lip balance estimate is low-confidence.",
          ],
        },
      ]),
    };
  }

  const frontMetrics = computeFrontMetrics(front);
  const sideMetrics = computeSideMetrics(side, sideQuality);

  const qualityPenalty = computeQualityPenalty(
    frontCount,
    sideCount,
    frontQuality,
    sideQuality
  );

  const frontConfidence = landmarkConfidence(frontCount, frontQuality);
  const sideConfidence = landmarkConfidence(sideCount, sideQuality);
  const combinedConfidence = clamp01(frontConfidence * 0.58 + sideConfidence * 0.42);
  const structureConfidence = clamp01(frontConfidence * 0.52 + sideConfidence * 0.48);
  const featuresConfidence = clamp01(frontConfidence * 0.74 + sideConfidence * 0.26);

  const frontHarmonyRaw = frontMetrics.frontScore - qualityPenalty * 0.22;
  const sideHarmonyRaw = sideMetrics.sideScore - qualityPenalty * 0.28;
  const frontHarmonyScore = stabilizeScore(frontHarmonyRaw, frontConfidence, 58);
  let sideHarmonyScore = sideCount
    ? stabilizeScore(sideHarmonyRaw, sideConfidence, 55)
    : stabilizeScore(sideHarmonyRaw, 0.24, 44);
  if (!sideCount) {
    sideHarmonyScore = Math.min(sideHarmonyScore, 55);
  }

  const sideWeight = sideCount ? 0.4 : 0.18;
  const harmonyRaw = frontHarmonyScore * (1 - sideWeight) + sideHarmonyScore * sideWeight;
  const harmonyScore = stabilizeScore(harmonyRaw, combinedConfidence, 57);

  const angularityRaw =
    frontMetrics.jawRatioScore * 0.48 +
    frontMetrics.chinProjectionScore * 0.29 +
    sideMetrics.depthScore * 0.23 -
    qualityPenalty * 0.34;
  const angularityScore = stabilizeScore(angularityRaw, structureConfidence, 55);

  const dimorphismRaw =
    frontMetrics.jawRatioScore * 0.34 +
    sideMetrics.depthScore * 0.3 +
    frontMetrics.ratioScore * 0.2 +
    frontMetrics.verticalBalanceScore * 0.16 -
    qualityPenalty * 0.32;
  const dimorphismScore = stabilizeScore(dimorphismRaw, structureConfidence, 55);

  const featuresRaw =
    frontMetrics.eyeSpacingScore * 0.26 +
    frontMetrics.mouthScore * 0.22 +
    frontMetrics.verticalBalanceScore * 0.2 +
    frontMetrics.symmetryScore * 0.32 -
    qualityPenalty * 0.28;
  const featuresScore = stabilizeScore(featuresRaw, featuresConfidence, 56);

  const overallRaw =
    harmonyScore * 0.34 +
    angularityScore * 0.22 +
    dimorphismScore * 0.22 +
    featuresScore * 0.22;
  const uncertaintyPenalty = (1 - combinedConfidence) * 14 + (sideCount ? 0 : 8);
  let overallScore = stabilizeScore(overallRaw - uncertaintyPenalty, combinedConfidence, 56);
  if (!sideCount) {
    overallScore = Math.min(overallScore, 67);
  }

  const jawlineAssessment = stabilizeScore(
    frontMetrics.jawRatioScore - qualityPenalty * 0.22,
    frontConfidence,
    56
  );
  const cheekAssessment = stabilizeScore(
    frontMetrics.ratioScore - qualityPenalty * 0.18,
    frontConfidence,
    54
  );
  const chinAssessment = stabilizeScore(
    frontMetrics.chinProjectionScore * 0.62 +
      sideMetrics.depthScore * 0.38 -
      qualityPenalty * 0.2,
    clamp01(frontConfidence * 0.55 + sideConfidence * 0.45),
    54
  );

  const facialContrastAssessment = stabilizeScore(
    frontMetrics.symmetryScore * 0.34 +
      frontMetrics.jawRatioScore * 0.3 +
      sideMetrics.depthScore * 0.22 +
      sideMetrics.profileRatioScore * 0.14 -
      qualityPenalty * 0.2,
    structureConfidence,
    56
  );
  const lowerFaceAssessment = stabilizeScore(
    frontMetrics.jawRatioScore * 0.68 +
      sideMetrics.depthScore * 0.32 -
      qualityPenalty * 0.18,
    structureConfidence,
    55
  );
  let profileDepthAssessment = sideCount
    ? stabilizeScore(sideMetrics.depthScore - qualityPenalty * 0.16, sideConfidence, 52)
    : stabilizeScore(34 - qualityPenalty * 0.08, 0.22, 45);
  if (!sideCount) {
    profileDepthAssessment = Math.min(profileDepthAssessment, 52);
  }

  const eyeSpacingAssessment = stabilizeScore(
    frontMetrics.eyeSpacingScore - qualityPenalty * 0.16,
    frontConfidence,
    55
  );
  const nasalAssessmentRaw = sideCount
    ? frontMetrics.verticalBalanceScore * 0.58 + sideMetrics.profileRatioScore * 0.42
    : frontMetrics.verticalBalanceScore * 0.8 + 44 * 0.2;
  const nasalAssessment = stabilizeScore(
    nasalAssessmentRaw - qualityPenalty * 0.16,
    clamp01(frontConfidence * 0.62 + sideConfidence * 0.38),
    55
  );
  const lipAssessment = stabilizeScore(
    frontMetrics.mouthScore - qualityPenalty * 0.15,
    frontConfidence,
    56
  );

  const rounded = {
    overallScore: Math.round(overallScore),
    harmonyScore: Math.round(harmonyScore),
    frontHarmonyScore: Math.round(frontHarmonyScore),
    sideHarmonyScore: Math.round(sideHarmonyScore),
    dimorphismScore: Math.round(dimorphismScore),
    angularityScore: Math.round(angularityScore),
    featuresScore: Math.round(featuresScore),
  };

  return {
    ...rounded,
    angularityAssessments: buildAssessments([
      {
        title: "Jawline definition",
        score: jawlineAssessment,
        notes: [
          "Jawline appears clear and structured.",
          "Jawline is moderately defined.",
          "Jawline definition looks soft or low-confidence.",
        ],
      },
      {
        title: "Cheek contour",
        score: cheekAssessment,
        notes: [
          "Cheek contour is well balanced.",
          "Cheek contour is average.",
          "Cheek contour appears flat or uncertain.",
        ],
      },
      {
        title: "Chin projection",
        score: chinAssessment,
        notes: [
          "Chin projection appears balanced.",
          "Chin projection is moderate.",
          "Chin projection looks limited or low-confidence.",
        ],
      },
    ]),
    dimorphismAssessments: buildAssessments([
      {
        title: "Facial contrast",
        score: facialContrastAssessment,
        notes: [
          "Facial structural contrast is strong.",
          "Facial contrast is moderate.",
          "Facial contrast appears soft.",
        ],
      },
      {
        title: "Lower-face robustness",
        score: lowerFaceAssessment,
        notes: [
          "Lower face appears robust.",
          "Lower face is moderately robust.",
          "Lower face robustness is limited.",
        ],
      },
      {
        title: "Profile depth",
        score: profileDepthAssessment,
        notes: [
          "Profile depth is well defined.",
          "Profile depth is average.",
          "Profile depth is weak or undetected.",
        ],
      },
    ]),
    featuresAssessments: buildAssessments([
      {
        title: "Eye spacing",
        score: eyeSpacingAssessment,
        notes: [
          "Eye spacing appears balanced.",
          "Eye spacing is close to average.",
          "Eye spacing appears uneven.",
        ],
      },
      {
        title: "Nasal proportion",
        score: nasalAssessment,
        notes: [
          "Nasal proportion appears balanced.",
          "Nasal proportion is moderate.",
          "Nasal proportion looks off or low-confidence.",
        ],
      },
      {
        title: "Lip balance",
        score: lipAssessment,
        notes: [
          "Lip balance appears stable.",
          "Lip balance is moderately stable.",
          "Lip balance appears asymmetric.",
        ],
      },
    ]),
  };
};
