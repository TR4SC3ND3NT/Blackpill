import fs from "node:fs";
import path from "node:path";

import {
  LANDMARK_CALIBRATION_REGISTRY,
  LANDMARK_REFERENCE_BASE_PATH,
} from "../lib/landmark-registry";

const cwd = process.cwd();
const publicDir = path.join(cwd, "public");
const baseDir = path.join(
  publicDir,
  LANDMARK_REFERENCE_BASE_PATH.replace(/^\//, "")
);

const assets = new Set<string>();
const owners = new Map<string, string[]>();

const addAsset = (asset: string, owner: string) => {
  if (!asset) return;
  assets.add(asset);
  const existing = owners.get(asset) ?? [];
  existing.push(owner);
  owners.set(asset, existing);
};

for (const def of LANDMARK_CALIBRATION_REGISTRY) {
  addAsset(def.referenceAsset, def.id);
  for (const fallback of def.referenceFallbackAssets ?? []) {
    addAsset(fallback, def.id);
  }
}

const missing: string[] = [];
for (const asset of Array.from(assets).sort()) {
  const assetPath = path.join(baseDir, asset);
  if (!fs.existsSync(assetPath)) missing.push(assetPath);
}

if (missing.length) {
  console.error(`FAIL: missing ${missing.length} reference assets`);
  for (const file of missing) {
    const assetName = path.basename(file);
    const usedBy = owners.get(assetName) ?? [];
    const suffix = usedBy.length ? ` (used by: ${usedBy.join(", ")})` : "";
    console.error(`- ${file}${suffix}`);
  }
  process.exit(1);
}

console.log(`OK: ${assets.size} reference assets found in ${baseDir}`);
