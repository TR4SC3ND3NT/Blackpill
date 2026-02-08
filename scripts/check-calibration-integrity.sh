#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/5] Check overview diagnostics removed"
if rg -n "Overlay health|Raw Metrics Export|sectionEyebrow">/dev/null app/results/[id]/page.tsx; then
  if rg -n "Overlay health|Raw Metrics Export" app/results/[id]/page.tsx >/dev/null; then
    echo "FAIL: diagnostics/raw metrics strings still present"
    exit 1
  fi
fi

echo "[2/5] Check calibrator has no diagram tab"
if rg -n "Diagram" components/LandmarkCalibrator.tsx >/dev/null; then
  echo "FAIL: Diagram UI still present"
  exit 1
fi

echo "[3/5] Check strict manual scoring enabled"
if ! rg -n "strictManual" lib/scoring.ts >/dev/null; then
  echo "FAIL: strictManual mode not found in scoring"
  exit 1
fi

echo "[4/5] Check registry asset files exist"
npm run -s check:refs

echo "[5/5] Check single-point step mode markers"
if ! rg -n "isStepPhase\(phase\).*activePoint|Continue to Side/Profile|Continue to Analysis" components/LandmarkCalibrator.tsx >/dev/null; then
  echo "FAIL: step/review flow markers not found"
  exit 1
fi

echo "All integrity checks passed."
