// Test Monitoring — camera/mic capability + permission detection.
//
// This is the single place that decides WHY a getUserMedia() request
// failed, so the rest of the app never has to guess. Getting this wrong
// is what previously caused "Your browser does not support camera/
// microphone access" to show up even on browsers that support it fine:
// that message must only ever mean the API itself is missing (old
// browser, insecure/non-HTTPS origin, etc.) — never permission denial,
// never a busy/missing device, and never the normal in-flight time while
// the browser's permission prompt is still open.
//
// IMPORTANT: camera/mic access is OPTIONAL monitoring, never a
// requirement to open or write a test. Every message below is written as
// an informational heads-up ("the test will open without live
// monitoring"), never as a blocker — the caller (StudentTests.jsx) always
// proceeds to open the test regardless of what this module returns.

// Distinct failure reasons — kept separate (rather than one generic
// "camera error") so the UI can show one precise, correctly-worded
// message instead of repeating a catch-all string for every case.
export const MEDIA_ERROR = {
  UNSUPPORTED: 'unsupported', // navigator.mediaDevices / getUserMedia isn't available at all
  DENIED: 'denied', // the student (or a browser/OS policy) refused the permission prompt
  IN_USE: 'in_use', // device exists but is locked by another app/tab
  CAMERA_UNAVAILABLE: 'camera_unavailable',
  MIC_UNAVAILABLE: 'mic_unavailable',
  BOTH_UNAVAILABLE: 'both_unavailable',
  UNKNOWN: 'unknown',
};

// True only when the browser actually exposes the API this test needs.
// This is a synchronous capability check — it never depends on whether
// permission has been granted yet, so it can't be confused with a
// permission-denied or still-pending state.
export function isMediaApiSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

function classifyKnownError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return MEDIA_ERROR.DENIED;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return MEDIA_ERROR.IN_USE;
  }
  // NotFoundError / DevicesNotFoundError / OverconstrainedError, or any
  // other unrecognized error, all mean "this one device isn't available" —
  // the caller only needs granted/denied/unavailable, and unavailable is
  // the correct fallback for all of these.
  return MEDIA_ERROR.UNKNOWN;
}

// Requests camera and microphone INDEPENDENTLY of each other — this is
// what item 11 requires: if the camera isn't available (no device,
// permission denied, busy) the student is never blocked from writing the
// test, and audio-only monitoring is used instead whenever a microphone
// IS available (and vice versa). A single combined request is tried
// first (one permission prompt, best UX when both work); only on failure
// do camera and mic get requested separately so each one's real
// availability can be determined independently instead of one failing
// device taking the other down with it.
// Resolves to:
//   { ok: true,  stream, camera: 'granted'|'denied'|'unavailable', audio: 'granted'|'denied'|'unavailable' }
//   { ok: false, camera: ..., audio: ..., reason: MEDIA_ERROR.* }
// `ok` is true as soon as EITHER track was obtained — camera-only,
// audio-only, or both are all valid "monitoring is on" outcomes. `ok` is
// only false when neither camera nor mic could be obtained at all, and
// even then the caller (StudentTests.jsx) still opens the test normally.
export async function requestMonitoringStream() {
  if (!isMediaApiSupported()) {
    return { ok: false, camera: 'unavailable', audio: 'unavailable', reason: MEDIA_ERROR.UNSUPPORTED };
  }
  const videoConstraints = {
    width: { ideal: 320, max: 640 },
    height: { ideal: 240, max: 480 },
    frameRate: { ideal: 10, max: 15 },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
    if (stream) return { ok: true, stream, camera: 'granted', audio: 'granted' };
  } catch {
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (fallbackStream) return { ok: true, stream: fallbackStream, camera: 'granted', audio: 'granted' };
    } catch { /* fall through to independent requests below */ }
  }

  const [videoResult, audioResult] = await Promise.all([
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        return { ok: true, stream: s };
      } catch {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: true });
          return { ok: true, stream: s };
        } catch (err) {
          return { ok: false, reason: classifyKnownError(err) };
        }
      }
    })(),
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        return { ok: true, stream: s };
      } catch (err) {
        return { ok: false, reason: classifyKnownError(err) };
      }
    })(),
  ]);

  const statusFor = (result) => (result.ok ? 'granted' : result.reason === MEDIA_ERROR.DENIED ? 'denied' : 'unavailable');
  const camera = statusFor(videoResult);
  const audio = statusFor(audioResult);

  const tracks = [];
  if (videoResult.ok) tracks.push(...videoResult.stream.getVideoTracks());
  if (audioResult.ok) tracks.push(...audioResult.stream.getAudioTracks());

  if (tracks.length === 0) {
    const reason = camera === 'denied' && audio === 'denied' ? MEDIA_ERROR.DENIED
      : camera === 'denied' || audio === 'denied' ? MEDIA_ERROR.DENIED
      : MEDIA_ERROR.BOTH_UNAVAILABLE;
    return { ok: false, camera, audio, reason };
  }
  return { ok: true, stream: new MediaStream(tracks), camera, audio };
}

// One canonical message per camera/audio status pair — informational
// only, since monitoring is always optional and the test always opens
// regardless of what this returns.
export function monitoringStatusMessage(camera, audio) {
  if (camera === 'granted' && audio === 'granted') return null; // nothing to say — full monitoring is on
  if (camera === 'granted' && audio !== 'granted') return 'Microphone monitoring is unavailable, but camera monitoring is on — your test will open normally.';
  if (camera !== 'granted' && audio === 'granted') return 'Camera monitoring is unavailable, so audio-only monitoring will be used — your test will open normally.';
  if (camera === 'denied' && audio === 'denied') return 'Camera and microphone access was denied — your test will open normally without live monitoring. You can allow access in your browser settings any time.';
  return 'No camera or microphone was detected on this device, so live monitoring will be unavailable — your test will open normally.';
}

// One canonical message per reason — this is what keeps the student from
// ever seeing more than one (correct) message for a given failure. Every
// message below is deliberately informational, not alarming: camera/mic
// monitoring is optional, so none of these ever tell the student the
// test itself is blocked — the test always opens regardless.
export function mediaErrorMessage(reason) {
  switch (reason) {
    case MEDIA_ERROR.UNSUPPORTED:
      return 'Your browser does not support camera/microphone access, so live monitoring will be unavailable — your test will open normally.';
    case MEDIA_ERROR.DENIED:
      return 'Camera and microphone access was denied — your test will open normally without live monitoring. You can allow access in your browser settings any time.';
    case MEDIA_ERROR.IN_USE:
      return 'Your camera or microphone is already in use by another app or tab, so live monitoring will be unavailable — your test will open normally.';
    case MEDIA_ERROR.CAMERA_UNAVAILABLE:
      return 'No camera was detected on this device, so live monitoring will be unavailable — your test will open normally.';
    case MEDIA_ERROR.MIC_UNAVAILABLE:
      return 'No microphone was detected on this device, so live monitoring will be unavailable — your test will open normally.';
    case MEDIA_ERROR.BOTH_UNAVAILABLE:
      return 'No camera or microphone was detected on this device, so live monitoring will be unavailable — your test will open normally.';
    default:
      return 'Live camera monitoring could not be started, so it will be unavailable for this attempt — your test will open normally.';
  }
}
