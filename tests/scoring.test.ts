import assert from "node:assert/strict";
import test from "node:test";
import { computeScores } from "../lib/scoring";
import type { Landmark, PhotoQuality, PoseEstimate } from "../lib/types";

const setPoint = (points: Landmark[], index: number, x: number, y: number) => {
  points[index] = { x, y, z: points[index]?.z ?? 0, visibility: 1 };
};

const buildFrontLandmarks = () => {
  const points: Landmark[] = Array.from({ length: 478 }, (_, index) => ({
    x: 0.45 + (index % 7) * 0.005,
    y: 0.45 + ((index / 7) % 7) * 0.005,
    z: 0,
    visibility: 1,
  }));

  setPoint(points, 33, 0.37, 0.42);
  setPoint(points, 263, 0.63, 0.42);
  setPoint(points, 133, 0.43, 0.42);
  setPoint(points, 362, 0.57, 0.42);
  setPoint(points, 132, 0.41, 0.50);
  setPoint(points, 361, 0.59, 0.50);
  setPoint(points, 93, 0.35, 0.52);
  setPoint(points, 323, 0.65, 0.52);
  setPoint(points, 58, 0.34, 0.58);
  setPoint(points, 288, 0.66, 0.58);
  setPoint(points, 61, 0.42, 0.64);
  setPoint(points, 291, 0.58, 0.64);
  setPoint(points, 150, 0.38, 0.73);
  setPoint(points, 379, 0.62, 0.73);
  setPoint(points, 172, 0.39, 0.74);
  setPoint(points, 397, 0.61, 0.74);
  setPoint(points, 149, 0.45, 0.79);
  setPoint(points, 378, 0.55, 0.79);
  setPoint(points, 234, 0.33, 0.56);
  setPoint(points, 454, 0.67, 0.56);
  setPoint(points, 168, 0.50, 0.31);
  setPoint(points, 6, 0.50, 0.39);
  setPoint(points, 2, 0.50, 0.54);
  setPoint(points, 1, 0.50, 0.56);
  setPoint(points, 152, 0.50, 0.82);
  setPoint(points, 98, 0.46, 0.55);
  setPoint(points, 327, 0.54, 0.55);
  setPoint(points, 13, 0.50, 0.62);
  setPoint(points, 14, 0.50, 0.66);
  setPoint(points, 159, 0.43, 0.40);
  setPoint(points, 145, 0.43, 0.44);
  setPoint(points, 386, 0.57, 0.40);
  setPoint(points, 374, 0.57, 0.44);

  return points;
};

const buildSideLandmarks = () => {
  const points = buildFrontLandmarks();
  setPoint(points, 168, 0.66, 0.31);
  setPoint(points, 6, 0.66, 0.37);
  setPoint(points, 197, 0.665, 0.41);
  setPoint(points, 195, 0.67, 0.45);
  setPoint(points, 5, 0.675, 0.49);
  setPoint(points, 4, 0.68, 0.53);
  setPoint(points, 1, 0.685, 0.57);
  setPoint(points, 2, 0.67, 0.55);
  setPoint(points, 152, 0.61, 0.83);
  return points;
};

const mapLandmarks = (
  points: Landmark[],
  transform: (point: Landmark) => Landmark
): Landmark[] => points.map((point) => ({ ...transform(point), visibility: point.visibility ?? 1 }));

const makePose = (expectedView: "front" | "side", patch?: Partial<PoseEstimate>): PoseEstimate => {
  const base: PoseEstimate =
    expectedView === "front"
      ? {
          yaw: 0,
          pitch: 0,
          roll: 0,
          source: "matrix",
          matrix: null,
          confidence: 0.95,
          view: "front",
          validFront: true,
          validSide: false,
        }
      : {
          yaw: 82,
          pitch: 0,
          roll: 0,
          source: "matrix",
          matrix: null,
          confidence: 0.9,
          view: "side",
          validFront: false,
          validSide: true,
        };

  return { ...base, ...patch };
};

const makeQuality = (
  expectedView: "front" | "side",
  patch?: Partial<PhotoQuality>
): PhotoQuality => {
  const pose = patch?.pose ?? makePose(expectedView);
  const viewValid = expectedView === "front" ? pose.validFront : pose.validSide;
  const viewWeight = expectedView === "side" ? (viewValid ? 1 : 0) : 1;
  return {
    poseYaw: pose.yaw,
    posePitch: pose.pitch,
    poseRoll: pose.roll,
    detectedView: pose.view,
    faceInFrame: true,
    minSidePx: 768,
    blurVariance: 540,
    landmarkCount: 478,
    quality: "ok",
    issues: [],
    confidence: pose.confidence,
    pose,
    expectedView,
    viewValid,
    viewWeight,
    reasonCodes: [],
    ...patch,
  };
};

test("score is stable to global scale and translation", () => {
  const front = buildFrontLandmarks();
  const side = buildSideLandmarks();
  const base = computeScores({
    frontLandmarks: front,
    sideLandmarks: side,
    frontQuality: makeQuality("front"),
    sideQuality: makeQuality("side"),
  });

  const transformedFront = mapLandmarks(
    front,
    (point) => ({ ...point, x: point.x * 1.1 + 0.08, y: point.y * 1.1 - 0.03 })
  );
  const transformedSide = mapLandmarks(
    side,
    (point) => ({ ...point, x: point.x * 1.1 + 0.08, y: point.y * 1.1 - 0.03 })
  );
  const transformed = computeScores({
    frontLandmarks: transformedFront,
    sideLandmarks: transformedSide,
    frontQuality: makeQuality("front"),
    sideQuality: makeQuality("side"),
  });

  assert.ok(Math.abs(base.overallScore - transformed.overallScore) <= 1);
  assert.ok(Math.abs(base.harmonyScore - transformed.harmonyScore) <= 1);
  assert.ok(Math.abs(base.angularityScore - transformed.angularityScore) <= 1);
});

test("small valid front yaw changes do not destabilize score", () => {
  const front = buildFrontLandmarks();
  const side = buildSideLandmarks();

  const neutral = computeScores({
    frontLandmarks: front,
    sideLandmarks: side,
    frontQuality: makeQuality("front", { pose: makePose("front", { yaw: 2 }) }),
    sideQuality: makeQuality("side"),
  });

  const tilted = computeScores({
    frontLandmarks: front,
    sideLandmarks: side,
    frontQuality: makeQuality(
      "front",
      {
        pose: makePose("front", { yaw: 8, pitch: 6, roll: 2, confidence: 0.88 }),
        confidence: 0.88,
      }
    ),
    sideQuality: makeQuality("side"),
  });

  assert.ok(Math.abs(neutral.overallScore - tilted.overallScore) <= 8);
  assert.ok(Math.abs(neutral.harmonyScore - tilted.harmonyScore) <= 20);
});

test("invalid side pose disables side metrics without collapsing overall", () => {
  const front = buildFrontLandmarks();
  const side = buildSideLandmarks();
  const sidePoseInvalid = makePose("side", {
    yaw: 35,
    view: "unknown",
    validSide: false,
    confidence: 0.72,
  });

  const result = computeScores({
    frontLandmarks: front,
    sideLandmarks: side,
    frontQuality: makeQuality("front"),
    sideQuality: makeQuality("side", {
      pose: sidePoseInvalid,
      poseYaw: sidePoseInvalid.yaw,
      posePitch: sidePoseInvalid.pitch,
      poseRoll: sidePoseInvalid.roll,
      detectedView: sidePoseInvalid.view,
      confidence: sidePoseInvalid.confidence,
      viewValid: false,
      viewWeight: 0,
      quality: "low",
      reasonCodes: ["bad_pose", "not_enough_yaw", "side_disabled"],
      issues: ["side invalid"],
    }),
  });

  const sideMetrics = result.metricDiagnostics.filter((metric) => metric.view === "side");
  assert.ok(sideMetrics.length > 0);
  assert.ok(sideMetrics.every((metric) => metric.scored === false));
  assert.ok(sideMetrics.every((metric) => metric.insufficient));
  assert.ok(result.overallScore >= 45);

  const allAssessments = [
    ...result.angularityAssessments,
    ...result.dimorphismAssessments,
    ...result.featuresAssessments,
  ];
  const insufficient = allAssessments.filter((item) => item.insufficient);
  assert.ok(insufficient.every((item) => item.score >= 50));
});

test("three-quarter side keeps profile metrics scored with reduced weight", () => {
  const front = buildFrontLandmarks();
  const side = buildSideLandmarks();

  const sidePose = makePose("side", {
    yaw: 42,
    pitch: 4,
    roll: 16,
    view: "three_quarter",
    validSide: false,
    confidence: 0.82,
  });

  const result = computeScores({
    frontLandmarks: front,
    sideLandmarks: side,
    frontQuality: makeQuality("front"),
    sideQuality: makeQuality("side", {
      pose: sidePose,
      poseYaw: sidePose.yaw,
      posePitch: sidePose.pitch,
      poseRoll: sidePose.roll,
      detectedView: sidePose.view,
      confidence: 0.72,
      viewValid: true,
      viewWeight: 0.45,
      quality: "low",
      reasonCodes: ["side_ok_three_quarter", "excessive_roll"],
      issues: ["three-quarter"],
    }),
  });

  const sideMetrics = result.metricDiagnostics.filter((metric) => metric.view === "side");
  assert.ok(sideMetrics.length > 0);
  assert.ok(sideMetrics.some((metric) => metric.scored));
  assert.ok(sideMetrics.some((metric) => metric.usedWeight > 0));
});
