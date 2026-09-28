import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useFaceApi } from '../../hooks/useFaceApi';
import { fetchMyFaceStatus, registerFace, requestFaceUpdate } from '../../services/faceService';
import LoadingSpinner from '../common/LoadingSpinner';

// Registration walks the student through: open camera → position face →
// blink (liveness) → capture a stable descriptor → submit. It never
// submits a descriptor unless a real close→open blink cycle was observed
// during the same live session (see useFaceApi's blink tracker).
export default function FaceRegistration() {
  const { showToast } = useToast();
  const { status: modelStatus, lastError: modelError, retry: retryModel, detectSingleFace, detectFaceLite, createBlinkTracker } = useFaceApi();
  const [faceStatus, setFaceStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);

  const loadStatus = () => {
    setLoadingStatus(true);
    fetchMyFaceStatus()
      .then(setFaceStatus)
      .catch((err) => showToast(err.message || 'Could not load face registration status.', 'error'))
      .finally(() => setLoadingStatus(false));
  };
  useEffect(loadStatus, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canRegister = faceStatus && !faceStatus.registered &&
    (!faceStatus.update_request || faceStatus.update_request.status !== 'pending');
  const hasApprovedRequest = faceStatus?.update_request?.status === 'approved';

  if (loadingStatus) return <LoadingSpinner size="sm" label="Checking face registration…" />;
  if (!faceStatus) return null;

  return (
    <div className="rounded-2xl border border-line bg-paper-card p-5">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-light">Face Registration</h2>

      {faceStatus.registered ? (
        <>
          <p className="mb-3 text-sm font-semibold text-teal">✓ Registered</p>
          {faceStatus.update_request?.status === 'pending' ? (
            <p className="text-sm text-ink-light">
              Your face update request is <span className="font-semibold">pending</span> faculty review.
            </p>
          ) : faceStatus.update_request?.status === 'rejected' ? (
            <FaceUpdateRequestForm onSubmitted={loadStatus} rejected />
          ) : (
            <FaceUpdateRequestForm onSubmitted={loadStatus} open={reasonOpen} setOpen={setReasonOpen} />
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-amber-600">⚠ Not Registered</p>
          {faceStatus.update_request?.status === 'pending' ? (
            <p className="text-sm text-ink-light">Your face update request is pending faculty review.</p>
          ) : hasApprovedRequest || !faceStatus.update_request ? (
            capturing ? (
              <CaptureFlow
                modelStatus={modelStatus}
                modelError={modelError}
                retryModel={retryModel}
                detectSingleFace={detectSingleFace}
                detectFaceLite={detectFaceLite}
                createBlinkTracker={createBlinkTracker}
                onDone={() => { setCapturing(false); loadStatus(); }}
                onCancel={() => setCapturing(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCapturing(true)}
                className="rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white"
              >
                Register Face
              </button>
            )
          ) : (
            <p className="text-sm text-ink-light">Your face update request was rejected. Contact your faculty for details.</p>
          )}
        </>
      )}
    </div>
  );
}

function FaceUpdateRequestForm({ onSubmitted, open, setOpen, rejected }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!!rejected ? false : open);

  const submit = async () => {
    setSubmitting(true);
    try {
      await requestFaceUpdate(reason);
      showToast('Face update request sent to your faculty.', 'success');
      setShowForm(false);
      setOpen && setOpen(false);
      onSubmitted();
    } catch (err) {
      showToast(err.message || 'Could not send request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <div>
        <p className="mb-2 text-sm text-ink-light">Need to update your face?</p>
        <button
          type="button"
          onClick={() => { setShowForm(true); setOpen && setOpen(true); }}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
        >
          Request Face Update
        </button>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why do you need to update your registered face?"
        rows={3}
        className="mb-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !reason.trim()}
          className="rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send Request'}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-light">
          Cancel
        </button>
      </div>
    </div>
  );
}

const CAPTURE_STAGE = { POSITION: 'position', BLINK: 'blink', CAPTURED: 'captured', SUBMITTING: 'submitting' };

// Face registration must work with either camera (item 4). We switch by
// `facingMode` rather than a fixed deviceId — deviceIds aren't stable
// across browsers/permission states, and labels needed to tell "front"
// from "back" apart by deviceId aren't exposed until after permission is
// granted anyway. `exact` is tried first so the toggle actually swaps
// physical cameras where the device has both; browsers/devices that can't
// satisfy `exact` (e.g. a laptop with only one camera) fall back to a
// plain request so registration still works with whatever camera exists.
async function requestFacingCamera(facingMode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('NO_MEDIA_DEVICES_API');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facingMode } } });
  } catch (err) {
    if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError' || err?.name === 'NotFoundError') {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode } });
    }
    throw err;
  }
}

function CaptureFlow({ modelStatus, modelError, retryModel, detectSingleFace, detectFaceLite, createBlinkTracker, onDone, onCancel }) {
  const { showToast } = useToast();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const blinkTrackerRef = useRef(createBlinkTracker());
  const capturedDescriptorRef = useRef(null);

  const [cameraError, setCameraError] = useState(null);
  const [stage, setStage] = useState(CAPTURE_STAGE.POSITION);
  const [faceVisible, setFaceVisible] = useState(false);
  // item 5: specific, honest position/multi-face guidance instead of a
  // single binary "face visible" signal — "too far", "too close", "not
  // centered", and "multiple faces" are informational only and never block
  // capture on their own (capture still only requires a visible face +
  // confirmed blink), so a borderline-but-workable position never gets
  // stuck on a guidance message instead of just letting the blink through.
  const [guidance, setGuidance] = useState(null); // null | 'multiple' | 'far' | 'close' | 'off-center'
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) | 'environment' (back)
  const [canSwitchCamera, setCanSwitchCamera] = useState(true); // optimistic until we know otherwise
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCameraError(null);
    requestFacingCamera(facingMode)
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        // Device labels are only populated once permission has been
        // granted at least once — check for a second camera here so the
        // "Switch Camera" button can hide itself on single-camera devices
        // instead of offering a switch that will always fail.
        navigator.mediaDevices.enumerateDevices?.()
          .then((devices) => {
            if (cancelled) return;
            const videoInputs = devices.filter((d) => d.kind === 'videoinput');
            setCanSwitchCamera(videoInputs.length > 1);
          })
          .catch(() => {}); // if enumeration fails, leave the button available — worst case a switch attempt fails gracefully below
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was denied. Allow camera access for this site and retry.');
        } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
          setCameraError('The camera is already in use by another app or tab. Close it and retry.');
        } else if (err?.message === 'NO_MEDIA_DEVICES_API') {
          setCameraError('This browser does not support camera access.');
        } else {
          setCameraError('Camera permission denied or unavailable.');
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  const switchCamera = () => {
    if (switching || stage === CAPTURE_STAGE.CAPTURED || stage === CAPTURE_STAGE.SUBMITTING) return;
    setSwitching(true);
    blinkTrackerRef.current.reset();
    capturedDescriptorRef.current = null;
    setStage(CAPTURE_STAGE.POSITION);
    setFaceVisible(false);
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    // The effect above tears down the old stream and requests the new
    // one; there's no separate async step here to await, so just clear
    // the busy flag on the next tick once the new facingMode has applied.
    setTimeout(() => setSwitching(false), 0);
  };

  // Tracking loop: runs continuously while positioning + waiting for a
  // blink. Throttled to a fixed cadence via setTimeout (~120ms, ~8
  // ticks/sec) instead of requestAnimationFrame's ~60 ticks/sec — a human
  // blink lasts roughly 100-400ms, so 8 samples/sec comfortably catches
  // every blink with no perceptible added latency, while cutting face-api.js
  // inference calls by ~85% during positioning. Each tick uses
  // detectFaceLite (landmarks/eye-state only — no descriptor forward pass),
  // which is the actual root-cause fix: the previous loop ran full
  // descriptor extraction on every one of the ~60 ticks/sec even though the
  // descriptor is only needed once, at capture. detectSingleFace (full
  // descriptor) now runs exactly once per registration, the instant a
  // blink completes.
  const TRACK_INTERVAL_MS = 120;
  useEffect(() => {
    if (modelStatus !== 'ready' || cameraError || stage === CAPTURE_STAGE.CAPTURED || stage === CAPTURE_STAGE.SUBMITTING) return;
    let active = true;
    let timeoutId = null;
    let busy = false; // guards against an overlapping tick if one detection call runs long
    const tick = async () => {
      if (!active) return;
      if (busy || !videoRef.current || videoRef.current.readyState < 2) {
        timeoutId = setTimeout(tick, TRACK_INTERVAL_MS);
        return;
      }
      busy = true;
      try {
        const result = await detectFaceLite(videoRef.current);
        if (!active) return;

        if (result?.multipleFaces) {
          // Only one person should be in frame for a registration capture —
          // surfaced distinctly so the student knows exactly why nothing is
          // progressing, instead of it just looking stuck on "position your
          // face". Loop must keep going (not just stop), so the tick is
          // rescheduled here explicitly — a bare `return` from inside this
          // try would skip the trailing reschedule at the bottom of tick()
          // entirely, silently freezing tracking the first time two faces
          // ever appeared in frame.
          setFaceVisible(false);
          setGuidance('multiple');
          blinkTrackerRef.current.reset();
          if (active) timeoutId = setTimeout(tick, TRACK_INTERVAL_MS);
          return;
        }

        setFaceVisible(!!result);
        if (result) {
          const video = videoRef.current;
          const { box } = result;
          const widthRatio = box.width / video.videoWidth;
          const boxCenterX = box.x + box.width / 2;
          const boxCenterY = box.y + box.height / 2;
          const offCenterX = Math.abs(boxCenterX - video.videoWidth / 2) / video.videoWidth;
          const offCenterY = Math.abs(boxCenterY - video.videoHeight / 2) / video.videoHeight;
          if (widthRatio < 0.22) setGuidance('far');
          else if (widthRatio > 0.85) setGuidance('close');
          else if (offCenterX > 0.22 || offCenterY > 0.22) setGuidance('off-center');
          else setGuidance(null);

          setStage((prev) => (prev === CAPTURE_STAGE.POSITION ? CAPTURE_STAGE.BLINK : prev));
          const blinked = blinkTrackerRef.current.sample(result.eyesClosed);
          if (blinked) {
            // Blink confirmed — now, and only now, pay for the full
            // descriptor extraction (the expensive step) exactly once.
            // Re-check for a second face right at this instant too — the
            // lite check a moment ago only guarantees "one face then";
            // someone could step into frame in the ~100ms since.
            const recheck = await detectFaceLite(videoRef.current);
            if (!active) return;
            if (recheck?.multipleFaces) {
              setGuidance('multiple');
              setFaceVisible(false);
              blinkTrackerRef.current.reset();
              if (active) timeoutId = setTimeout(tick, TRACK_INTERVAL_MS);
              return;
            }
            const captured = await detectSingleFace(videoRef.current);
            if (!active) return;
            if (captured) {
              capturedDescriptorRef.current = captured.descriptor;
              setStage(CAPTURE_STAGE.CAPTURED);
              return; // stop the loop — we have our capture
            }
            // Face moved/quality dropped between the lite check and the
            // full descriptor pass (rare, sub-second window) — reset the
            // blink tracker and keep tracking instead of getting stuck.
            blinkTrackerRef.current.reset();
          }
        } else {
          setGuidance(null);
        }
      } finally {
        busy = false;
      }
      if (active) timeoutId = setTimeout(tick, TRACK_INTERVAL_MS);
    };
    tick();
    return () => { active = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [modelStatus, cameraError, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!capturedDescriptorRef.current) return;
    setStage(CAPTURE_STAGE.SUBMITTING);
    try {
      await registerFace(capturedDescriptorRef.current);
      showToast('Face registered successfully. Your face can now be used for attendance.', 'success');
      onDone();
    } catch (err) {
      showToast(err.message || 'Could not register your face.', 'error');
      setStage(CAPTURE_STAGE.POSITION);
      blinkTrackerRef.current.reset();
      capturedDescriptorRef.current = null;
    }
  };

  const retry = () => {
    blinkTrackerRef.current.reset();
    capturedDescriptorRef.current = null;
    setStage(CAPTURE_STAGE.POSITION);
  };

  if (cameraError) {
    return (
      <div className="text-sm text-crimson">
        {cameraError}
        <div className="mt-2"><button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-1.5 text-xs">Close</button></div>
      </div>
    );
  }
  if (modelStatus === 'error') {
    return (
      <div className="text-sm text-crimson">
        Recognition service unavailable. Please try again later.
        {import.meta.env.DEV && modelError && (
          <p className="mt-1 text-xs text-ink-light">
            Dev diagnostic: {modelError.name || 'Error'} — {modelError.message || 'no message'}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={retryModel} className="rounded-lg border border-line px-3 py-1.5 text-xs">Retry</button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-1.5 text-xs">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mx-auto mb-3 w-full max-w-xs overflow-hidden rounded-xl border border-line bg-black">
        {/* Only the front camera is mirrored — that matches what the
            student sees in a normal mirror. A rear camera showing a
            mirrored preview would be disorienting and doesn't match how
            the sensor is actually oriented. */}
        <video ref={videoRef} autoPlay muted playsInline className={`w-full ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
        {canSwitchCamera && stage !== CAPTURE_STAGE.CAPTURED && stage !== CAPTURE_STAGE.SUBMITTING && (
          <button
            type="button"
            onClick={switchCamera}
            disabled={switching}
            className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {switching ? 'Switching…' : `Switch to ${facingMode === 'user' ? 'Back' : 'Front'} Camera`}
          </button>
        )}
      </div>
      {modelStatus === 'loading' && <p className="text-center text-xs text-ink-light">Loading recognition model…</p>}
      {modelStatus === 'ready' && stage === CAPTURE_STAGE.POSITION && (
        <p className="text-center text-sm text-ink-light">
          {guidance === 'multiple' && 'Multiple faces detected — make sure only you are in frame.'}
          {guidance === 'far' && 'Face too far — move closer to the camera.'}
          {guidance === 'close' && 'Face too close — move back a little.'}
          {guidance === 'off-center' && 'Center your face in the frame.'}
          {!guidance && (faceVisible ? 'Face detected — hold still…' : 'Position your face inside the frame.')}
        </p>
      )}
      {stage === CAPTURE_STAGE.BLINK && (
        <p className="text-center text-sm font-semibold text-ink">Please blink to confirm you're a real person 👀</p>
      )}
      {stage === CAPTURE_STAGE.CAPTURED && (
        <div className="text-center">
          <p className="mb-2 text-sm font-semibold text-teal">Blink confirmed — capture ready.</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={submit} className="rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white">Confirm & Register</button>
            <button type="button" onClick={retry} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-light">Retry</button>
          </div>
        </div>
      )}
      {stage === CAPTURE_STAGE.SUBMITTING && <p className="text-center text-sm text-ink-light">Registering…</p>}
      {stage !== CAPTURE_STAGE.CAPTURED && stage !== CAPTURE_STAGE.SUBMITTING && (
        <div className="mt-3 text-center">
          <button type="button" onClick={onCancel} className="text-xs text-ink-light underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
