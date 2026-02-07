import assert from "node:assert/strict";
import test from "node:test";
import { resolvePoseFromMatrix } from "../lib/mediapipe";
import type { PoseEstimate } from "../lib/types";

type Vec3 = { x: number; y: number; z: number };

const normalize = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!length) return { x: 0, y: 0, z: 1 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const buildRowMajorMatrix = (yawDeg: number, pitchDeg: number, rollDeg: number) => {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const roll = (rollDeg * Math.PI) / 180;

  const forward = normalize({
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  });

  const worldUp = Math.abs(forward.y) > 0.92 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const rightBase = normalize(cross(worldUp, forward));
  const upBase = normalize(cross(forward, rightBase));

  const right = normalize({
    x: rightBase.x * Math.cos(roll) - upBase.x * Math.sin(roll),
    y: rightBase.y * Math.cos(roll) - upBase.y * Math.sin(roll),
    z: rightBase.z * Math.cos(roll) - upBase.z * Math.sin(roll),
  });
  const up = normalize({
    x: upBase.x * Math.cos(roll) + rightBase.x * Math.sin(roll),
    y: upBase.y * Math.cos(roll) + rightBase.y * Math.sin(roll),
    z: upBase.z * Math.cos(roll) + rightBase.z * Math.sin(roll),
  });

  return [
    right.x,
    up.x,
    forward.x,
    0,
    right.y,
    up.y,
    forward.y,
    0,
    right.z,
    up.z,
    forward.z,
    0,
    0,
    0,
    0,
    1,
  ];
};

const toColumnMajor = (rowMajor: number[]) => {
  const matrix = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      matrix[col * 4 + row] = rowMajor[row * 4 + col];
    }
  }
  return matrix;
};

const fallbackPose: PoseEstimate = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  source: "fallback",
  matrix: null,
  confidence: 0.4,
  view: "front",
  validFront: true,
  validSide: false,
};

test("row-major synthetic side matrix resolves to side-valid pose", () => {
  const matrix = buildRowMajorMatrix(80, 6, 12);
  const pose = resolvePoseFromMatrix(matrix, fallbackPose, "side");

  assert.equal(pose.source, "matrix");
  assert.ok(Math.abs(pose.yaw) >= 65);
  assert.ok(Math.abs(pose.pitch) <= 20);
  assert.equal(pose.validSide, true);
  assert.equal(pose.view, "side");
  assert.ok((pose.candidates?.length ?? 0) >= 2);
});

test("front pose remains valid with large roll (roll is warning only)", () => {
  const matrix = buildRowMajorMatrix(4, -5, 29);
  const pose = resolvePoseFromMatrix(matrix, fallbackPose, "front");

  assert.equal(pose.validFront, true);
  assert.ok(Math.abs(pose.roll) >= 20);
  assert.ok(Math.abs(pose.yaw) <= 20);
  assert.ok(Math.abs(pose.pitch) <= 20);
});

test("column-major encoded matrix is decoded and selected for side", () => {
  const rowMajor = buildRowMajorMatrix(74, 3, -8);
  const columnMajor = toColumnMajor(rowMajor);
  const pose = resolvePoseFromMatrix(columnMajor, fallbackPose, "side");

  assert.equal(pose.source, "matrix");
  assert.ok(Math.abs(pose.yaw) >= 60);
  assert.ok(Math.abs(pose.pitch) <= 20);
  assert.equal(pose.validSide, true);
  assert.ok(
    (pose.selectedLabel ?? "").includes("column-major") ||
      (pose.candidates ?? []).some((candidate) => candidate.label.includes("column-major"))
  );
});
