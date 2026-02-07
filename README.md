# Blackpill (MVP)

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## MediaPipe Assets

By default the app tries local assets first and falls back to CDN/model URLs.

- Local wasm path: `public/mediapipe/wasm`
- Local models path: `public/mediapipe/models`

If local assets are missing, internet access is required to load MediaPipe runtime/models.

## Optional Persistence

Set `FACE_STORE_PERSIST=1` to persist the in-memory store to `.data/faces.json`.

```bash
FACE_STORE_PERSIST=1 npm run dev
```

## API Check (curl)

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/subscription
curl -s -X POST http://localhost:3000/api/faces -H "Content-Type: application/json" -d '{"frontPhotoUrl":"data:image/png;base64,FAKE","sidePhotoUrl":"data:image/png;base64,FAKE","gender":"unspecified","race":"unspecified"}'
curl -s http://localhost:3000/api/faces/FACE_ID
curl -s -X POST http://localhost:3000/api/faces/FACE_ID/mediapipe -H "Content-Type: application/json" -d '{"landmarks":[{"x":0.5,"y":0.5}]}' && curl -s http://localhost:3000/api/faces/FACE_ID/mediapipe
```
