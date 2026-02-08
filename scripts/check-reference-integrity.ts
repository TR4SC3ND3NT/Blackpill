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
for (const def of LANDMARK_CALIBRATION_REGISTRY) {
  if (def.referenceAsset) assets.add(def.referenceAsset);
  for (const fallback of def.referenceFallbackAssets ?? []) {
    if (fallback) assets.add(fallback);
  }
}

const missing: string[] = [];
for (const asset of Array.from(assets).sort()) {
  const assetPath = path.join(baseDir, asset);
  if (!fs.existsSync(assetPath)) missing.push(assetPath);
}

if (missing.length) {
  console.error(`FAIL: missing ${missing.length} reference assets`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`OK: ${assets.size} reference assets found in ${baseDir}`);
