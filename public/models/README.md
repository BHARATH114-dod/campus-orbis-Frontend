# Face recognition model weights

Face Registration and Face Recognition Attendance run entirely in the
browser using [face-api.js](https://github.com/justadudewhohacks/face-api.js),
which needs its pretrained model weight files available at `/models`
(this folder). These are binary files (a few MB total) and are **not**
included in the source tree — download them once during setup:

1. `npm install` in `Frontend/` (pulls in the `face-api.js` package).
2. Copy the following files from `node_modules/face-api.js/weights/`
   (or download them from the face-api.js GitHub repo's `weights/`
   folder) into this `public/models/` folder:
   - `tiny_face_detector_model-weights_manifest.json` + `tiny_face_detector_model-shard1`
   - `face_landmark_68_model-weights_manifest.json` + `face_landmark_68_model-shard1`
   - `face_recognition_model-weights_manifest.json` + `face_recognition_model-shard1` + `face_recognition_model-shard2`

A one-line copy command once `node_modules` exists:

```bash
cp node_modules/face-api.js/weights/tiny_face_detector_model-* \
   node_modules/face-api.js/weights/face_landmark_68_model-* \
   node_modules/face-api.js/weights/face_recognition_model-* \
   public/models/
```

`useFaceApi.js` (`src/hooks/useFaceApi.js`) loads these from
`/models` at runtime via `faceapi.nets.*.loadFromUri('/models')`. If
this folder is empty, Face Registration and Face Recognition
Attendance will show a "Recognition service unavailable" error state —
normal manual attendance is unaffected either way.
