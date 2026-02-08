# Landmark Reference Images

This folder contains universal anatomical landmark reference images used by the Landmark Calibration UI.

- Files are served from `/landmarks/reference/<file>`.
- Filenames are referenced by `lib/landmark-registry.ts` (`referenceAsset` / `referenceFallbackAssets`).
- Run `npm run check:refs` to verify the registry points to existing files.
