# Optional Local MediaPipe Assets

Place these files here to avoid external CDN/model downloads:

- `public/mediapipe/wasm/...` (contents of `@mediapipe/tasks-vision` wasm folder)
- `public/mediapipe/models/face_landmarker.task`
- `public/mediapipe/models/blaze_face_short_range.tflite`

If files are missing, the app automatically falls back to remote URLs.
