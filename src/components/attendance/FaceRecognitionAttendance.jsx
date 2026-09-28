import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import { startFaceSession, detectFaces, confirmFaceSession, cancelFaceSession } from '../../services/faceService';
import ErrorBoundary from '../common/ErrorBoundary';
import LoadingSpinner from '../common/LoadingSpinner';
import { slotLabel } from './FacultyAttendance';

// Root-cause fix for "recognition reacts too slowly": bulk scanning is
// throttled (by design — sending every camera frame to the backend would
// be wasteful, item 8) but the old value was needlessly conservative, and
// the very first detection didn't run until a full interval had already
// elapsed after the loop started. 600ms is comfortably inside what the
// busyRef backpressure below can sustain on a mid-range Android device for
// a 224px TinyFaceDetector pass (verified: a tick that overruns just skips
// the next tick rather than overlapping, so this can't cause a pile-up even
// on a slow device) while feeling meaningfully more responsive than 900ms.
const DETECT_INTERVAL_MS = 600;

// How long we wait for the video element to report real dimensions before
// treating camera start as failed. Some Android WebViews are slow to fire
// 'loadedmetadata' even once the stream is flowing.
const VIDEO_READY_TIMEOUT_MS = 8000;

const CAMERA = {
  IDLE: 'idle',
  STARTING: 'starting',
  LIVE: 'live',
  ERROR: 'error',
};

// Diagnostic tags match the exact taxonomy used to trace the "camera works
// for ~1s then the ErrorBoundary fires" report: one line per stage of
// camera:start -> ... -> recognition:first-frame -> recognition:detection-
// result -> recognition:matching -> recognition:attendance-request ->
// recognition:attendance-success (or recognition:error) -> camera:cleanup.
// Kept in production (not stripped) because it's cheap console output and
// is the fastest way to see, from a real user's browser console, exactly
// which stage stopped happening right before a crash — a live repro is
// the only way to find that with certainty, and this makes the next
// occurrence self-diagnosing instead of needing another investigation pass.
function log(tag, extra) {
  // eslint-disable-next-line no-console
  console.log(`[FaceAttendance] ${tag}`, extra ?? '');
}

function logError(operation, err) {
  // eslint-disable-next-line no-console
  console.error(`[FaceAttendance] recognition:error`, { operation, message: err?.message || String(err), stack: err?.stack });
}

// Defensive shape checks for anything that crosses the network boundary
// and is about to become React state. These exist because the ONLY way an
// asynchronous operation (a rejected promise, a bad API response) can ever
// reach the ErrorBoundary is indirectly: it calls setState with a value
// that is the wrong shape, and the *next render* throws on it (React error
// boundaries only catch render-time throws, never promise rejections or
// event-handler exceptions directly). Validating here means a malformed
// response degrades to "nothing changed this tick" (logged loudly) instead
// of ever reaching render with a shape the JSX below doesn't expect.
function isPlainArray(x) {
  return Array.isArray(x);
}
function isValidTallyShape(t) {
  return !!t && typeof t === 'object' && isPlainArray(t.present);
}
function isValidRosterShape(r) {
  return isPlainArray(r) && r.every((s) => s && typeof s.username === 'string');
}

function readableCameraError(err) {
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access for this site and retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app or tab. Close it and retry.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'The camera does not support the requested settings.';
  }
  if (name === 'SecurityError') {
    return 'Camera access is blocked on this connection (camera requires HTTPS).';
  }
  if (name === 'AbortError') {
    return 'Camera initialization was interrupted. Please retry.';
  }
  if (err?.message === 'NO_MEDIA_DEVICES_API') {
    return 'This browser does not support camera access.';
  }
  if (err?.message === 'VIDEO_NOT_READY_TIMEOUT') {
    return 'Camera opened but no video signal was received. Please retry.';
  }
  return 'Camera could not be started. Please allow camera permission and try again.';
}

// Same facingMode-first strategy as FaceRegistration.jsx's requestFacingCamera:
// `exact` is tried first so a tap on "Switch Camera" actually swaps physical
// cameras on devices that have both; browsers/devices that can't satisfy
// `exact` (a laptop with only one camera, or a phone that only reports one
// under `exact` for a given mode) fall back to a plain facingMode request
// rather than failing the switch outright.
async function requestFacingCamera(facingMode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('NO_MEDIA_DEVICES_API');
  }
  const base = facingMode === 'user' ? { facingMode: { exact: 'user' } } : { facingMode: { exact: 'environment' } };
  try {
    return await navigator.mediaDevices.getUserMedia({ video: base, audio: false });
  } catch (err) {
    if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError' || err?.name === 'NotFoundError') {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    }
    throw err;
  }
}

function FaceRecognitionAttendanceInner({ slot, date, onConfirmed }) {
  const { showToast } = useToast();
  const { status: modelStatus, lastError: modelError, retry: retryModel, detectAllFacesLite } = useFaceApi();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionIdRef = useRef(null);
  const busyRef = useRef(false); // prevents overlapping detect calls if one is slow
  const startTokenRef = useRef(0); // guards against a stale start() finishing after a newer one began
  const mountedRef = useRef(true);
  const firstFrameLoggedRef = useRef(false);
  // Item 2: individual verification target. A ref (not just state) because
  // the recognition setInterval closure reads it on every tick without
  // needing the loop itself to be torn down and restarted each time
  // faculty clicks "Verify" on a different student.
  const verifyTargetRef = useRef(null);
  // Mirrors facingMode state into a ref so start()/switchCamera() always read
  // the latest requested facing mode even inside an async continuation.
  const facingModeRef = useRef('environment');

  const [cameraState, setCameraState] = useState(CAMERA.IDLE);
  const [cameraError, setCameraError] = useState(null);
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [tally, setTally] = useState(null);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null); // { username, name } | null — mirrors verifyTargetRef for rendering
  // Item 1: front/back camera switch, same UX as student Face Registration.
  // Default intelligently — back camera on a phone (faculty scanning a room
  // of students), front camera on a laptop (the only camera it usually has)
  // — but this is only ever the starting point; faculty can always switch.
  const [facingMode, setFacingMode] = useState(() =>
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ? 'environment' : 'user')
  ); // 'user' (front) | 'environment' (back)
  const [canSwitchCamera, setCanSwitchCamera] = useState(true); // optimistic until enumerateDevices confirms
  const [switchingCamera, setSwitchingCamera] = useState(false);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const stopRecognitionLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopCamera = () => {
    stopRecognitionLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    log('camera:cleanup');
  };

  const resetAll = () => {
    startTokenRef.current += 1; // invalidate any in-flight start()
    stopCamera();
    sessionIdRef.current = null;
    firstFrameLoggedRef.current = false;
    verifyTargetRef.current = null;
    setSession(null);
    setRoster([]);
    setTally(null);
    setVerifyTarget(null);
    setCameraState(CAMERA.IDLE);
    setCameraError(null);
  };

  // Full teardown on unmount only.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startTokenRef.current += 1;
      stopCamera();
    };
  }, []);

  // If faculty switches to a different timetable hour/date while a session
  // is open, tear everything down instead of leaving a stale camera/session
  // running against the wrong slot.
  useEffect(() => {
    if (cameraState !== CAMERA.IDLE || session) {
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.id, date]);

  const waitForVideoReady = (video) =>
    new Promise((resolve, reject) => {
      const isReady = () => video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

      if (isReady()) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('VIDEO_NOT_READY_TIMEOUT'));
      }, VIDEO_READY_TIMEOUT_MS);

      const onLoaded = () => {
        if (isReady()) {
          cleanup();
          resolve();
        }
      };

      function cleanup() {
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('resize', onLoaded);
      }

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('loadeddata', onLoaded);
      video.addEventListener('resize', onLoaded);
    });

  const startRecognitionLoop = (myToken) => {
    stopRecognitionLoop();

    const runTick = async () => {
      if (startTokenRef.current !== myToken) return; // superseded / torn down
      const video = videoRef.current;
      const stream = streamRef.current;
      if (!video || !stream || !stream.active) {
        log('camera:error', 'stream inactive during recognition');
        stopRecognitionLoop();
        if (mountedRef.current) {
          setCameraState(CAMERA.ERROR);
          setCameraError('Camera feed was lost. Please retry.');
        }
        return;
      }
      if (busyRef.current || video.readyState < 2 || video.videoWidth === 0) return;
      busyRef.current = true;
      const target = verifyTargetRef.current; // snapshot for this tick — read once so a mid-tick clear can't mix modes

      try {
        const faces = await detectAllFacesLite(video);

        if (!firstFrameLoggedRef.current) {
          firstFrameLoggedRef.current = true;
          log('recognition:first-frame', { facesFound: faces?.length ?? 0 });
        }

        // detectAllFacesLite's own contract is "always resolves to an
        // array" (see useFaceApi.js) — this check exists anyway because
        // that guarantee is exactly the kind of thing a library upgrade
        // silently breaks, and a non-array here going straight into
        // .map()/.length below is precisely how a "1 second in" render
        // crash of this shape would happen.
        if (!isPlainArray(faces)) {
          logError('detectAllFacesLite-shape', new Error(`expected array, got ${typeof faces}`));
          return;
        }
        log('recognition:detection-result', { faceCount: faces.length, mode: target ? `verify:${target.username}` : 'bulk' });
        if (faces.length === 0) return;

        log('recognition:matching', { faceCount: faces.length });
        log('recognition:attendance-request', { sessionId: sessionIdRef.current, target: target?.username ?? null });
        const result = await detectFaces(
          sessionIdRef.current,
          faces.map((f) => ({ descriptor: f.descriptor })),
          target?.username ?? null
        );

        if (!isValidTallyShape(result)) {
          // A malformed/unexpected response body — never let this reach
          // setState. Logged loudly instead of thrown so the recognition
          // loop keeps running next tick rather than taking the whole
          // component down over one bad response.
          logError('attendance-response-shape', new Error(`unexpected detect response shape: ${JSON.stringify(result)?.slice(0, 200)}`));
          return;
        }
        log('recognition:attendance-success', { presentCount: result.present_count, unknownCount: result.unknown_count });

        if (mountedRef.current && startTokenRef.current === myToken) {
          setTally(result);
          if (target && result.target_result?.matched) {
            showToast(`${result.target_result.name || target.name} marked Present`, 'success');
            verifyTargetRef.current = null;
            setVerifyTarget(null);
          }
        }
      } catch (err) {
        // Transient network/model hiccups shouldn't kill the whole session —
        // the interval just tries again next tick. Logged (not swallowed
        // silently) so a real recurring failure is visible in the console
        // instead of just looking like "recognition stopped working".
        logError('recognition-tick', err);
      } finally {
        busyRef.current = false;
      }
    };

    // Fire the first detection immediately instead of waiting a full
    // DETECT_INTERVAL_MS after the camera/session are already live — that
    // dead wait was part of what made recognition feel slow to start.
    // Subsequent ticks are then paced by setInterval as before.
    runTick();
    intervalRef.current = setInterval(runTick, DETECT_INTERVAL_MS);
    log('recognition:loop-started');
  };

  // Item 2/3: faculty clicks "Verify" next to one student. Reuses the
  // exact same running camera/session/recognition loop — it just narrows
  // what the next ticks send to the backend, rather than spinning up a
  // second camera flow. Bulk scanning resumes automatically once matched
  // (verifyTargetRef is cleared above) or when faculty cancels below.
  const startVerify = (student) => {
    if (!session) return;
    verifyTargetRef.current = { username: student.username, name: student.name };
    setVerifyTarget({ username: student.username, name: student.name });
  };
  const cancelVerify = () => {
    verifyTargetRef.current = null;
    setVerifyTarget(null);
  };

  const start = async () => {
    if (starting) return; // prevent duplicate concurrent starts
    const myToken = ++startTokenRef.current;
    setStarting(true);
    setCameraError(null);
    setCameraState(CAMERA.STARTING);
    firstFrameLoggedRef.current = false;
    log('camera:start');

    // Stop any previous stream before requesting a new one — never allow two
    // simultaneous active cameras for this session.
    if (streamRef.current) stopCamera();

    try {
      const stream = await requestFacingCamera(facingModeRef.current);
      if (startTokenRef.current !== myToken) {
        // A newer start (or a reset) happened while we were waiting — discard this one.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      log('camera:stream-created', stream.getVideoTracks().map((t) => t.label));
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('VIDEO_ELEMENT_MISSING');

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      log('camera:video-attached');

      // Device labels are only populated once permission has been granted at
      // least once — probe for a second camera now so "Switch Camera" can
      // hide itself on single-camera devices instead of offering a switch
      // that will always fail. Same approach as FaceRegistration.jsx.
      navigator.mediaDevices.enumerateDevices?.()
        .then((devices) => {
          if (startTokenRef.current !== myToken || !mountedRef.current) return;
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setCanSwitchCamera(videoInputs.length > 1);
        })
        .catch(() => {}); // if enumeration fails, leave the button available — worst case a switch attempt fails gracefully

      try {
        await video.play();
        log('camera:play-started');
      } catch (playErr) {
        // Autoplay can be blocked in rare cases; metadata wait below will
        // still confirm whether frames are actually arriving.
        logError('video.play', playErr);
      }

      await waitForVideoReady(video);
      if (startTokenRef.current !== myToken) return; // superseded while waiting
      log('camera:metadata-ready', `${video.videoWidth}x${video.videoHeight}`);

      // Only now — with a confirmed live frame — do we say the camera is on.
      if (mountedRef.current) setCameraState(CAMERA.LIVE);
      log('camera:live');

      if (modelStatus !== 'ready') {
        // The model can still be finishing its own async load even though
        // the camera is already live — this is fine, the recognition loop
        // below will simply see empty detections until it settles. Logged
        // so a "camera live but never recognizes anything" report is
        // distinguishable at a glance from an actual crash.
        log('recognition:model-not-ready-yet', modelStatus);
      } else {
        log('recognition:model-ready');
      }

      const { session: newSession, roster: newRoster } = await startFaceSession({
        sectionId: slot.section_id, date, hour: slot.hour, subjectId: slot.subject_id,
      });
      if (startTokenRef.current !== myToken || !mountedRef.current) return;

      if (!isValidRosterShape(newRoster)) {
        // Same reasoning as the detect-response guard in the recognition
        // loop: never let a malformed API payload become React state.
        // This is the other place (besides a bad /detect response) a
        // render-time throw could plausibly originate from, since `roster`
        // feeds `roster.filter(...)`/`roster.map(...)` directly below.
        logError('startFaceSession-roster-shape', new Error(`unexpected roster shape: ${JSON.stringify(newRoster)?.slice(0, 200)}`));
        throw new Error('SESSION_ROSTER_INVALID');
      }

      sessionIdRef.current = newSession.id;
      setSession(newSession);
      setRoster(newRoster);
      setTally({ present_count: 0, unknown_count: 0, present: [] });

      startRecognitionLoop(myToken);
    } catch (err) {
      logError('start', err);
      if (startTokenRef.current === myToken && mountedRef.current) {
        setCameraState(CAMERA.ERROR);
        setCameraError(err?.message === 'SESSION_ROSTER_INVALID'
          ? 'Could not load the student list for this session. Please retry.'
          : readableCameraError(err));
      }
      stopCamera(); // already logs camera:cleanup
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  // Item 1: front/back camera switch. Unlike start()/resetAll(), this never
  // touches the session, roster, or tally — the timetable slot and
  // in-progress attendance session are preserved exactly as they were;
  // only the video stream is torn down and replaced. The recognition loop
  // is paused for the duration of the swap (so it can't run against a
  // stream that's mid-teardown) and resumed once the new stream is
  // confirmed live, using the same start token so a superseded switch (or
  // a reset that happened mid-switch) can't resurrect a stale loop.
  const switchCamera = async () => {
    if (switchingCamera || cameraState !== CAMERA.LIVE) return;
    const myToken = startTokenRef.current;
    const previousFacing = facingModeRef.current;
    const nextFacing = previousFacing === 'user' ? 'environment' : 'user';
    setSwitchingCamera(true);
    stopRecognitionLoop();
    log('camera:switch-start', { from: previousFacing, to: nextFacing });

    // Release the current camera before requesting the next one — never
    // hold two simultaneous active streams.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const attach = async (stream, mode) => {
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        try { await video.play(); } catch (playErr) { logError('video.play(switch)', playErr); }
        await waitForVideoReady(video);
      }
      if (startTokenRef.current !== myToken || !mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      facingModeRef.current = mode;
      setFacingMode(mode);
      return true;
    };

    try {
      const stream = await requestFacingCamera(nextFacing);
      if (startTokenRef.current !== myToken || !mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const attached = await attach(stream, nextFacing);
      if (attached) {
        log('camera:switched', nextFacing);
        if (sessionIdRef.current) startRecognitionLoop(myToken); // resume scanning — same session, same roster
      }
    } catch (err) {
      logError('switchCamera', err);
      // Don't leave faculty with a dead preview just because the OTHER
      // camera isn't available right now — try to recover the one that was
      // already working before reporting failure.
      try {
        const fallbackStream = await requestFacingCamera(previousFacing);
        if (startTokenRef.current !== myToken || !mountedRef.current) {
          fallbackStream.getTracks().forEach((t) => t.stop());
          return;
        }
        const attached = await attach(fallbackStream, previousFacing);
        if (attached) {
          showToast('Could not switch camera — kept the current one.', 'error');
          if (sessionIdRef.current) startRecognitionLoop(myToken);
        }
      } catch (fallbackErr) {
        logError('switchCamera-fallback', fallbackErr);
        if (mountedRef.current) {
          setCameraState(CAMERA.ERROR);
          setCameraError(readableCameraError(fallbackErr));
        }
      }
    } finally {
      if (mountedRef.current) setSwitchingCamera(false);
    }
  };

  const confirm = async () => {
    setFinishing(true);
    try {
      const result = await confirmFaceSession(sessionIdRef.current);
      resetAll();
      showToast(`Attendance saved — ${result.present_count} of ${result.total_count} present.`, 'success');
      onConfirmed();
    } catch (err) {
      showToast(err.message || 'Could not confirm attendance.', 'error');
    } finally {
      if (mountedRef.current) setFinishing(false);
    }
  };

  const cancel = async () => {
    setFinishing(true);
    try {
      if (sessionIdRef.current) await cancelFaceSession(sessionIdRef.current);
    } catch (err) {
      // best-effort — camera stops regardless
    } finally {
      resetAll();
      if (mountedRef.current) setFinishing(false);
    }
  };

  if (slot.already_taken) {
    return <p className="text-sm text-ink-light">🔒 Attendance for this hour was already submitted and is locked.</p>;
  }

  const cameraLive = cameraState === CAMERA.LIVE;
  const notDetected = roster.filter((s) => !tally?.present?.some((p) => p.username === s.username));

  return (
    <div>
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-light">
        {slotLabel(slot)} · {slot.subject_name}
      </h2>

      {cameraState === CAMERA.IDLE && (
        <>
          {modelStatus === 'error' && (
            <div className="mb-3">
              <p className="text-sm text-crimson">Recognition service unavailable. Please try again later.</p>
              {import.meta.env.DEV && modelError && (
                <p className="mt-1 text-xs text-ink-light">
                  Dev diagnostic: {modelError.name || 'Error'} — {modelError.message || 'no message'}
                </p>
              )}
              <button
                type="button"
                onClick={retryModel}
                className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light"
              >
                Retry Loading Recognition Model
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={start}
            disabled={starting || modelStatus !== 'ready'}
            className="rounded-lg bg-hero-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {starting ? 'Starting…' : modelStatus === 'loading' ? 'Loading recognition model…' : 'Start Face Attendance'}
          </button>
        </>
      )}

      {(cameraState === CAMERA.STARTING || cameraLive || cameraState === CAMERA.ERROR) && (
        <>
          <p className="mb-3 text-xs text-ink-light">
            {cameraState === CAMERA.STARTING && 'Camera: Starting…'}
            {cameraLive && !session && 'Camera: ON — connecting to attendance session…'}
            {cameraLive && session && 'Camera: ON — recognition running continuously. Confirm when everyone visible has been marked.'}
            {cameraState === CAMERA.ERROR && 'Camera: OFF'}
          </p>

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-black">
              {/* Kept mounted across STARTING/LIVE/ERROR so the stream can be
                  attached to a real DOM node the instant getUserMedia resolves —
                  gating this on `session` was the root cause of the black
                  preview: the stream had nowhere to attach to yet. object-cover
                  fills the frame without stretching; the surrounding
                  aspect-video box keeps a consistent shape in portrait and
                  landscape alike. Only the front camera is mirrored, matching
                  the same convention used in student Face Registration. */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {cameraLive && (
                <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                  Live
                </span>
              )}
              {cameraLive && canSwitchCamera && (
                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={switchingCamera}
                  className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {switchingCamera ? 'Switching…' : `Switch to ${facingMode === 'user' ? 'Back' : 'Front'} Camera`}
                </button>
              )}
              {switchingCamera && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">
                  Switching camera…
                </div>
              )}
              {cameraState === CAMERA.STARTING && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">
                  Starting camera…
                </div>
              )}
              {cameraState === CAMERA.ERROR && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
                  <p className="text-xs text-white">{cameraError}</p>
                  <button
                    type="button"
                    onClick={start}
                    disabled={starting}
                    className="rounded-lg bg-hero-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {starting ? 'Retrying…' : 'Retry Camera'}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <StatRow label="Faces in frame" value={tally?.detected_this_frame ?? 0} accent="ink-light" />
              <StatRow label="Present" value={tally?.present_count ?? 0} accent="teal" />
              <StatRow label="Unknown faces" value={tally?.unknown_count ?? 0} accent="crimson" />
              <StatRow label="Not yet detected" value={notDetected.length} accent="ink-light" />
              <StatRow label="Total students" value={roster.length} accent="ink-light" />
            </div>
          </div>

          {session && (
            <>
              <p className="mb-2 text-xs font-semibold text-ink-light">
                {verifyTarget
                  ? `Verifying ${verifyTarget.name} — hold their face in frame…`
                  : cameraLive ? 'Scanning…' : ''}
              </p>

              {/* Item 3: full eligible-student table — name, roll no, face
                  registration status, attendance status, and a per-student
                  Verify action — alongside the bulk scan that keeps running
                  in the background regardless of whether anyone is being
                  individually verified right now. */}
              <div className="mb-4 max-h-72 overflow-y-auto overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-paper-card text-xs uppercase tracking-wide text-ink-light">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Roll No</th>
                      <th className="px-3 py-2">Face</th>
                      <th className="px-3 py-2">Attendance</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => {
                      const present = tally?.present?.some((p) => p.username === s.username);
                      const isBeingVerified = verifyTarget?.username === s.username;
                      return (
                        <tr key={s.username} className="border-t border-line">
                          <td className="px-3 py-1.5">{s.name}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-ink-light">{s.roll_number}</td>
                          <td className="px-3 py-1.5">{s.face_registered ? '✓' : '✗'}</td>
                          <td className={`px-3 py-1.5 text-xs font-semibold ${present ? 'text-teal' : 'text-ink-light'}`}>
                            {present ? '✓ Present' : 'Not Present'}
                          </td>
                          <td className="px-3 py-1.5">
                            {!present && s.face_registered && (
                              isBeingVerified ? (
                                <button type="button" onClick={cancelVerify} className="text-xs font-semibold text-crimson">
                                  Stop
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startVerify(s)}
                                  disabled={!!verifyTarget}
                                  className="text-xs font-semibold text-hero-primary disabled:opacity-40"
                                >
                                  Verify
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={finishing}
                  className="rounded-lg bg-hero-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {finishing ? 'Saving…' : 'Confirm Attendance'}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={finishing}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink-light disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {cameraLive && !session && <LoadingSpinner size="sm" label="Starting attendance session…" />}
        </>
      )}
    </div>
  );
}

function StatRow({ label, value, accent }) {
  const color = accent === 'teal' ? 'text-teal' : accent === 'crimson' ? 'text-crimson' : 'text-ink-light';
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-3 py-2">
      <span className="text-xs text-ink-light">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}

// Wrapped in its own ErrorBoundary so a face-api/render exception during a
// live camera session shows a recoverable "Something went wrong" card
// instead of unmounting the whole Faculty Attendance page to a blank/white
// screen (there was previously no boundary anywhere above this component).
export default function FaceRecognitionAttendance(props) {
  return (
    <ErrorBoundary message="Something went wrong with Face Recognition Attendance.">
      <FaceRecognitionAttendanceInner {...props} />
    </ErrorBoundary>
  );
}
