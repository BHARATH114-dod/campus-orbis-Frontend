import { useEffect, useRef, useState } from 'react';

// Diagnostic logger for the model-init path — this is the ONLY place
// "Recognition service unavailable" actually originates from (modelStatus
// === 'error' below). It is a purely client-side load of face-api.js +
// its weight files from /models; it never touches the backend. Kept in
// production (cheap console output) because a live report from a real
// device's console is the only way to tell, with certainty, whether a
// failure here is a network blip, a slow/unreliable mobile connection,
// a WebGL/TFJS backend init failure, or a genuinely missing/renamed
// asset — without this, every failure looks identical: "error".
// NEVER logs descriptors, cookies, or auth tokens — this path doesn't
// touch any of those, only the model-loading step itself.
function log(tag, extra) {
  // eslint-disable-next-line no-console
  console.log(`[FaceAttendance] ${tag}`, extra ?? '');
}

// Models are loaded once per page load and shared by every component
// that uses this hook (Face Registration + Face Recognition Attendance),
// so switching between them never re-downloads weights.
//
// IMPORTANT: previously, a single rejected load (e.g. a dropped request
// on a flaky mobile connection) cached the REJECTED promise forever —
// every future mount of every component using this hook replayed the
// same failure with zero chance of recovery short of a full page
// reload. That is very plausibly why mobile specifically gets stuck on
// "Recognition service unavailable": mobile networks are more likely to
// have a transient hiccup on one of the three model fetches, and once
// that happens the feature was permanently bricked for the rest of the
// tab's life. modelsPromise is now cleared on failure so the next
// call to loadModels() (e.g. the user tapping Retry) starts a fresh
// attempt instead of replaying the cached rejection.
let modelsPromise = null;
function loadModels() {
  if (!modelsPromise) {
    log('service:init:start');
    modelsPromise = import('face-api.js')
      .then(async (faceapi) => {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        log('service:init:success');
        return faceapi;
      })
      .catch((err) => {
        // Reset so a subsequent call gets a fresh attempt instead of the
        // same cached rejection forever.
        modelsPromise = null;
        log('service:init:error', {
          name: err?.name,
          message: err?.message,
          // Most likely on a fetch failure (network/CORS/404) — undefined
          // for anything that isn't an HTTP-shaped error (e.g. a WebGL/TFJS
          // backend init failure inside face-api.js has no status code).
          status: err?.status ?? err?.response?.status,
        });
        throw err;
      });
  }
  return modelsPromise;
}

// Eye Aspect Ratio from 6 landmark points around one eye — the standard
// formula used for blink detection. Falls below ~0.2 while the eye is
// closed and recovers above it once open again.
function eyeAspectRatio(eye) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  return (vertical1 + vertical2) / (2 * horizontal);
}

const EAR_CLOSED_THRESHOLD = 0.22;

/**
 * Loads face-api.js + its models once, and exposes:
 *  - status: 'loading' | 'ready' | 'error'
 *  - detectSingleFace(video): best single-face match with landmarks +
 *    full descriptor, or null. Used once per registration — at the moment
 *    a blink is confirmed — to produce the actual captured descriptor.
 *  - detectFaceLite(video): landmarks + eye-state only, no descriptor.
 *    Used by the registration tracking loop on every tick (positioning +
 *    blink detection) since the descriptor isn't needed until capture.
 *  - detectAllFacesLite(video): every face's descriptor in the current
 *    frame (no landmarks needed once liveness has already been
 *    established for the session). Used for attendance.
 *  - blinkTracker: a small stateful helper — call .sample(eyeState) on
 *    every frame during registration and it reports whether a full
 *    close→open blink cycle has been observed yet.
 */
export function useFaceApi() {
  const [status, setStatus] = useState('loading');
  const [lastError, setLastError] = useState(null); // { name, message } — for dev-only diagnostics in the UI, never sensitive
  const faceapiRef = useRef(null);
  // Bumped by retry() to force the effect below to run loadModels() again
  // even though its dependency array is otherwise empty.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus((prev) => (attempt > 0 ? 'loading' : prev));
    loadModels()
      .then((faceapi) => {
        if (cancelled) return;
        faceapiRef.current = faceapi;
        setLastError(null);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLastError({ name: err?.name, message: err?.message });
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [attempt]);

  // Lets a user-facing "Retry" button attempt a fresh model load instead
  // of being permanently stuck after one transient failure (see loadModels
  // above — modelsPromise is cleared on error, so this actually re-fetches
  // rather than replaying the same rejection).
  function retry() {
    setAttempt((n) => n + 1);
  }

  async function detectSingleFace(video) {
    const faceapi = faceapiRef.current;
    if (!faceapi) return null;
    const result = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    // Registration quality gate (matches the score filter already applied
    // in detectAllFacesLite for attendance): don't hand back a descriptor
    // from a low-confidence detection (too far/blurry/partial face) — a
    // bad descriptor captured at registration silently degrades every
    // future recognition attempt against that student, in a way that's
    // invisible until someone notices they're never recognized.
    if (result.detection.score <= 0.6) return null;
    const landmarks = result.landmarks;
    const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
    const rightEAR = eyeAspectRatio(landmarks.getRightEye());
    const avgEAR = (leftEAR + rightEAR) / 2;
    return { descriptor: Array.from(result.descriptor), eyesClosed: avgEAR < EAR_CLOSED_THRESHOLD, box: result.detection.box };
  }

  // Root-cause fix for slow face registration: the tracking loop that runs
  // continuously while the student positions their face and blinks was
  // previously calling detectSingleFace() (detection + landmarks + full
  // 128-d descriptor forward pass — the single most expensive face-api.js
  // step) on EVERY animation frame, ~60 times a second. The descriptor is
  // only ever needed once, at the exact moment a blink is confirmed — every
  // other tick only needed to know "is a face here, roughly where, are the
  // eyes closed", which the landmark pass alone already answers. Skipping
  // descriptor extraction during tracking cuts the per-tick cost
  // dramatically (descriptor extraction is a second full neural-net forward
  // pass on top of detection+landmarks) with zero change to what's actually
  // captured: detectSingleFace (full descriptor) is still called exactly
  // once, right when the blink completes, to produce the real capture.
  // detectFaceLite now checks for MULTIPLE simultaneous faces too (item 5's
  // "Multiple faces detected" state) — switched from detectSingleFace to
  // detectAllFaces for this reason. Cost is unchanged: still landmarks-only,
  // no descriptor extraction, same TinyFaceDetector pass either way.
  async function detectFaceLite(video) {
    const faceapi = faceapiRef.current;
    if (!faceapi) return null;
    const results = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks();
    const valid = results.filter((r) => r.detection.score > 0.6);
    if (valid.length === 0) return null;
    if (valid.length > 1) return { multipleFaces: true, faceCount: valid.length };
    const landmarks = valid[0].landmarks;
    const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
    const rightEAR = eyeAspectRatio(landmarks.getRightEye());
    const avgEAR = (leftEAR + rightEAR) / 2;
    return { eyesClosed: avgEAR < EAR_CLOSED_THRESHOLD, box: valid[0].detection.box, multipleFaces: false, faceCount: 1 };
  }

  async function detectAllFacesLite(video) {
    const faceapi = faceapiRef.current;
    if (!faceapi) return [];
    const results = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    // Multi-frame consistency (item 11): a face only counts if it's not a
    // blurry/partial detection — face-api.js's own detection score is a
    // reasonable proxy, so low-confidence boxes are dropped here rather
    // than sent to the backend at all.
    return results
      .filter((r) => r.detection.score > 0.6)
      .map((r) => ({ descriptor: Array.from(r.descriptor), box: r.detection.box }));
  }

  function createBlinkTracker() {
    let wasClosed = false;
    let blinked = false;
    return {
      sample(eyesClosed) {
        if (eyesClosed) wasClosed = true;
        else if (wasClosed) { blinked = true; wasClosed = false; }
        return blinked;
      },
      get hasBlinked() { return blinked; },
      reset() { wasClosed = false; blinked = false; },
    };
  }

  return { status, lastError, retry, detectSingleFace, detectFaceLite, detectAllFacesLite, createBlinkTracker };
}
