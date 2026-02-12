
✅ 60+ ratios vs 32 ethnicity/gender cohorts  
✅ #F6F7FB glassmorphism + sidebar history  
✅ Big orange radial chart "82/100"  
✅ Calibration: red dot 1.5x + full reference images  
✅ 5-tab results: Ratios(60+) | Strengths | Flaws | Plan  

```bash
./setup.sh
```

Open `http://localhost:3000`.

## MediaPipe Assets

By default the app tries local assets first and falls back to CDN/model URLs.

- Local wasm path: `public/mediapipe/wasm`
- Local models path: `public/mediapipe/models`

If local assets are missing, internet access is required to load MediaPipe runtime/models.

## Landmark Reference Assets

Landmark Calibration uses static, universal reference images stored locally:

- `public/landmarks/reference`

To verify the registry maps to real files:

```bash
npm run check:refs
```

## Optional Persistence

Set `FACE_STORE_PERSIST=1` to persist the in-memory store to `.data/faces.json`.

```bash
FACE_STORE_PERSIST=1 npm run dev
```
