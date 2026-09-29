import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveTestProgress, requestTestRejoin, submitTest, runTestCode, runTestCodeCustomInput } from '../../services/testService';
import { uploadMonitoringChunk, sendMonitoringHeartbeat } from '../../services/testMonitoringService';
import { openMonitoringSocket, sendMonitoringSignal, RTC_ICE_SERVERS } from '../../services/monitoringSocket';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import CodeEditor from './CodeEditor';

// Test Monitoring — camera/mic STATUS heartbeat. This is intentionally a
// separate, much faster signal from the recording pipeline below: it
// reports what the browser can see about its own MediaStreamTracks right
// now (readyState === 'live' and enabled), starting the instant the
// stream is available — not waiting on a full ~8s recording chunk to
// finish encoding and upload before faculty's "Camera On/Off" can ever
// change. This is what fixes a student's status getting stuck on
// "Camera Off" after they've actually granted permission: previously
// that status depended entirely on the slower chunk pipeline succeeding.
// A missing/ended camera track (permission revoked mid-test, hardware
// unplugged, etc.) is reflected within one heartbeat tick too.
const HEARTBEAT_INTERVAL_MS = 4000;
// Test Monitoring — camera/mic STATUS heartbeat. This is intentionally a
// separate, much faster signal from the recording pipeline below: it
// reports what the browser can see about its own MediaStreamTracks right
// now (readyState === 'live' and enabled), starting the instant the
// stream is available — not waiting on a full ~8s recording chunk to
// finish encoding and upload before faculty's "Camera On/Off" can ever
// change. This is what fixes a student's status getting stuck on
// "Camera Off" after they've actually granted permission: previously
// that status depended entirely on the slower chunk pipeline succeeding.
// A missing/ended camera track (permission revoked mid-test, hardware
// unplugged, etc.) is reflected within one heartbeat tick too.
//
// item 11: camera and audio are independent monitoring channels — a
// student can be camera-off/audio-on or camera-on/audio-off, and both
// halves are reported as their own live flag + permission status rather
// than collapsing to a single camera-only signal. Fires once immediately
// (covers the "no stream at all" case — permission denied, no device —
// so the faculty/HOD view never gets stuck on "connecting") and then on
// an interval whenever an actual stream is present.
function useMonitoringStatusHeartbeat(testId, stream, cameraStatus, audioStatus) {
  useEffect(() => {
    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      const videoTracks = stream ? stream.getVideoTracks() : [];
      const audioTracks = stream ? stream.getAudioTracks() : [];
      const cameraLive = videoTracks.length > 0 && videoTracks.some((t) => t.readyState === 'live' && t.enabled);
      const micLive = audioTracks.length > 0 && audioTracks.some((t) => t.readyState === 'live' && t.enabled);
      sendMonitoringHeartbeat(testId, {
        cameraLive, micLive,
        cameraPermission: cameraStatus || 'unavailable',
        micPermission: audioStatus || 'unavailable',
      }).catch(() => { /* best-effort — the next tick a few seconds later will retry, or this was the one-shot no-stream report */ });
    };
    beat(); // fire immediately — don't wait a full interval for the first status update
    if (!stream) return undefined; // no live tracks to keep polling; the one-shot report above already went out
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [testId, stream, cameraStatus, audioStatus]);
}

// Test Monitoring — WebRTC "View Live" responder.
//
// This is the student-side half of the real-time video fix: it listens
// on the signalling socket for a faculty "live-view-request" and, when
// one arrives, creates an RTCPeerConnection, adds the SAME already-live
// camera/mic tracks used by the heartbeat + recorder hooks above (no
// extra getUserMedia() call — see the module comment on
// useTestMonitoringRecorder for why that matters), and sends a WebRTC
// offer back through the socket. It never owns the stream and never
// stops its tracks — only StudentTests.jsx does that, once the attempt
// truly ends.
//
// A student can be watched by more than one faculty tab (or the same
// faculty tab reopening View Live after closing it), so peer connections
// are tracked per signalling "connId" rather than assuming there's only
// ever one.
function useLiveViewResponder(testId, stream) {
  const wsRef = useRef(null);
  const peersRef = useRef({}); // connId -> RTCPeerConnection

  useEffect(() => {
    if (!testId || !stream) return undefined;
    let cancelled = false;

    const closePeer = (connId) => {
      const pc = peersRef.current[connId];
      if (!pc) return;
      try { pc.close(); } catch { /* already closed */ }
      delete peersRef.current[connId];
    };

    const notifyCameraEnded = () => {
      Object.keys(peersRef.current).forEach((connId) => {
        sendMonitoringSignal(wsRef.current, { type: 'camera-ended', connId });
      });
    };
    // If the camera track dies mid-test (permission revoked, hardware
    // unplugged, student ends the test elsewhere) every faculty tab
    // currently watching should be told explicitly instead of just
    // silently going black.
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((t) => t.addEventListener('ended', notifyCameraEnded));

    const handleMessage = async (msg) => {
      if (cancelled) return;

      if (msg.type === 'live-view-request') {
        if (!stream.getTracks().some((t) => t.readyState === 'live')) {
          return;
        }
        closePeer(msg.connId); // drop any stale connection for this same viewer first
        const pc = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
        peersRef.current[msg.connId] = pc;
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
        pc.onicecandidate = (e) => {
          if (e.candidate) sendMonitoringSignal(wsRef.current, { type: 'ice-candidate', connId: msg.connId, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {};
        pc.oniceconnectionstatechange = () => {};
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendMonitoringSignal(wsRef.current, { type: 'offer', connId: msg.connId, sdp: pc.localDescription });
        } catch (err) {
          console.error('[monitoring-rtc:student] failed to create/send offer', err);
        }
        return;
      }

      if (msg.type === 'answer') {
        const pc = peersRef.current[msg.connId];
        if (!pc) return;
        try {
          await pc.setRemoteDescription(msg.sdp);
        } catch (err) {
          console.error('[monitoring-rtc:student] failed to set remote answer', err);
        }
        return;
      }

      if (msg.type === 'ice-candidate') {
        const pc = peersRef.current[msg.connId];
        if (!pc || !msg.candidate) return;
        try { await pc.addIceCandidate(msg.candidate); } catch (err) { console.error('[monitoring-rtc:student] failed to add ICE candidate', err); }
        return;
      }

      if (msg.type === 'view-live-close') {
        closePeer(msg.connId);
      }
    };

    const ws = openMonitoringSocket({
      testId,
      role: 'student',
      onMessage: handleMessage,
      onOpen: () => {},
      onClose: () => {},
    });
    wsRef.current = ws;

    return () => {
      cancelled = true;
      videoTracks.forEach((t) => t.removeEventListener('ended', notifyCameraEnded));
      Object.keys(peersRef.current).forEach(closePeer);
      try { ws.close(); } catch { /* already closed */ }
      // Deliberately NOT stopping `stream`'s tracks here — same rule as
      // useTestMonitoringRecorder above: this hook only ever uses the
      // stream, it never owns or ends it.
    };
  }, [testId, stream]);
}

// Test Monitoring — records the camera+mic MediaStream the student already
// granted (see StudentTests.jsx, which requests it BEFORE the test is
// opened) in short rolling chunks and uploads each one to replace the
// previous, so faculty's "View Live" always has a very recent recording
// waiting for them.
//
// IMPORTANT: this hook only ever USES the stream — it never owns it and
// never stops its tracks. The stream is created (and stopped, once the
// attempt is truly over) by StudentTests.jsx, which is the only thing
// that knows whether the student is switching tests, resuming after a
// refresh, or actually done. Stopping the tracks from inside this hook's
// effect cleanup used to kill the camera every time the effect re-ran —
// including React StrictMode's deliberate dev-mode double-invoke
// (mount → cleanup → mount again) — which then made the very next
// recorder.start() throw a synchronous InvalidStateError on the now-dead
// stream. That exception was never caught, so it crashed the whole
// component tree straight to a blank white screen the instant a student
// granted permission. Every recorder call that can throw is now wrapped,
// and nothing here ever ends the stream itself.
const MONITOR_CHUNK_MS = 8000;
const MONITOR_MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
function pickMonitorMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MONITOR_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}
function useTestMonitoringRecorder(testId, stream) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!stream) return undefined;
    const mimeType = pickMonitorMimeType();
    if (mimeType == null) return undefined; // MediaRecorder unsupported — monitoring silently skipped
    let stopped = false;
    let recorder;
    const startChunk = () => {
      if (stopped) return;
      // The stream may have ended for reasons outside this hook (e.g. the
      // student closed the camera at the OS level, or a previous attempt's
      // cleanup already ran) — bail quietly instead of letting
      // recorder.start() throw on a dead stream.
      if (!stream.getTracks().some((t) => t.readyState === 'live')) { setRecording(false); return; }
      try {
        const opts = mimeType ? { mimeType, videoBitsPerSecond: 100000 } : { videoBitsPerSecond: 100000 };
        recorder = new MediaRecorder(stream, opts);
      } catch {
        try {
          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch {
          setRecording(false);
          return;
        }
      }
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        if (chunks.length) {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          uploadMonitoringChunk(testId, blob).catch(() => { /* best-effort — a dropped chunk just means one stale frame for faculty */ });
        }
        if (!stopped) startChunk();
      };
      try {
        recorder.start();
        setRecording(true);
      } catch {
        // Stream went inactive between the readyState check above and
        // start() — never let this escape and crash the page; just skip
        // this chunk. The next StrictMode/normal re-run (or nothing, if
        // truly done) picks it back up.
        setRecording(false);
        return;
      }
      setTimeout(() => {
        try {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        } catch { /* already stopped/inactive — nothing to do */ }
      }, MONITOR_CHUNK_MS);
    };
    startChunk();
    return () => {
      stopped = true;
      setRecording(false);
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
      } catch { /* ignore — recorder may already be inactive */ }
      // Deliberately NOT stopping `stream`'s tracks here — see the block
      // comment above this hook. The camera/mic stream outlives any single
      // effect run; only StudentTests.jsx ends it, and only when the
      // attempt is actually finished.
    };
  }, [testId, stream]);
  return recording;
}

// AUTOMATIC SUBMISSION HAS EXACTLY ONE TRIGGER: an actual browser tab
// switch, detected via the Page Visibility API (document.hidden /
// "visibilitychange"). The instant the test tab is no longer the visible
// tab, doSubmit('tab_switch') fires immediately and silently — no dialog,
// no warning, nothing shown to the student beforehand. There is no
// timer-based submission and no fullscreen-exit submission: the timer
// reaching 00:00 only shows a "Time Expired" banner, and entering/exiting
// full screen (by the toggle button, Esc, Alt+Tab, or anything else)
// never affects the test.
//
// Nothing else EVER submits the exam: not mouse movement, clicks inside
// the test, scrolling, pressing Enter, pressing Tab inside the code
// editor (CodeEditor handles that as plain indentation and never touches
// this component's submit path), running/checking code, compiler errors,
// browser resizing, a network blip, or any other transient focus change
// that isn't an actual tab switch. The only two callers of doSubmit are
// (1) the student's own confirmed "Submit Exam" click below, and (2) the
// visibilitychange listener a few lines down — nothing else in this file
// calls it.

const TYPE_LABEL = { mcq: 'Multiple choice', code: 'Coding', theory: 'Written answer' };
const TYPE_BADGE = {
  mcq: 'bg-hero-primary/10 text-hero-primary',
  code: 'bg-purple/10 text-purple',
  theory: 'bg-gold/10 text-gold',
};

/**
 * Full-page test attempt — a fixed full-viewport overlay (not a small
 * modal). Fullscreen is entirely optional: a toggle button lets the
 * student enter/exit the browser's real Fullscreen API purely as a
 * convenience, and doing so — in either direction, at any time — has no
 * effect whatsoever on the test's state or on submission; there is no
 * grace window and no forced re-entry. The one and only auto-submission
 * trigger in this component is an actual browser tab switch (see the
 * block comment at the top of this file).
 *
 * Code questions are checked on demand against faculty-fixed test cases via
 * Check Code (never submits the exam). On Submit Exam, a code question that
 * still fails some test cases is simply graded wrong (0 marks), exactly
 * like an incorrect MCQ — it never blocks or rejects the submission.
 *
 * @param {{ test, onDone: (result: { score, total_marks } | null) => void, monitorStream?: MediaStream | null, cameraStatus?: 'granted'|'denied'|'unavailable', audioStatus?: 'granted'|'denied'|'unavailable' }} props
 */
// Auto-save: the student's answers, current-question position, and code all
// live in localStorage under this key while the attempt is in progress, so
// an accidental refresh or a brief connection drop never loses their work.
// This is a UX convenience only — the timer and the score it can never
// extend are both computed server-side (see secondsLeftFor / the submit
// route), so nothing here can be used to cheat the clock.
const autosaveKey = (testId) => `campus-orbis-test-autosave-${testId}`;
function loadAutosave(testId, questionCount) {
  try {
    const raw = localStorage.getItem(autosaveKey(testId));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.answers) || saved.answers.length !== questionCount) return null;
    return saved;
  } catch {
    return null;
  }
}

// item 11: "Camera: Available / Unavailable / Permission Denied" and
// "Audio: Available / Unavailable / Permission Denied" — a small, always-
// visible, purely informational badge. Never implies the test is blocked;
// it just tells the student what monitoring is actually active for them.
function MonitoringStatusBadge({ label, status }) {
  const display = status === 'granted' ? 'Available' : status === 'denied' ? 'Permission Denied' : 'Unavailable';
  const dotClass = status === 'granted' ? 'bg-teal' : status === 'denied' ? 'bg-gold' : 'bg-ink-light/60';
  return (
    <span
      className="flex items-center gap-1.5 rounded-full bg-line/50 px-3 py-2 text-[11px] font-bold text-ink-light"
      title={`${label}: ${display}. This never affects your test — you can answer and submit normally either way.`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} /> {label}: {display}
    </span>
  );
}

export default function TestAttempt({ test, initialSecondsLeft, onDone, monitorStream, cameraStatus, audioStatus, savedProgress, rejoinInfo }) {
  const { showToast } = useToast();
  const isMonitored = useTestMonitoringRecorder(test.id, monitorStream);
  useMonitoringStatusHeartbeat(test.id, monitorStream, cameraStatus, audioStatus);
  useLiveViewResponder(test.id, monitorStream);
  const savedAttempt = useMemo(() => loadAutosave(test.id, test.questions.length), [test.id, test.questions.length]);
  // Session Persistence (item 5/10): prefer this browser's own localStorage
  // autosave (fastest, and preserves in-progress code editor state exactly
  // as typed), and fall back to the server-side saved_progress — which
  // exists across a full logout/login or a different device — only when
  // there's nothing local yet.
  const [answers, setAnswers] = useState(() => savedAttempt?.answers
    ?? (savedProgress?.answers?.length === test.questions.length ? savedProgress.answers : null)
    ?? test.questions.map((q) => ({ selected_index: null, text: '', code: q.type === 'code' ? (q.starter_code || '') : '' })));
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = savedAttempt?.currentIndex ?? savedProgress?.current_question_index;
    return typeof saved === 'number' && saved >= 0 && saved < test.questions.length ? saved : 0;
  });
  // UPDATED: the timer starts from whatever the server says is left, based
  // on actual join time (or the test's scheduled start, whichever is
  // later) — not a fresh full duration on every load.
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsLeft ?? test.duration_minutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [codeResults, setCodeResults] = useState({}); // question_id -> { results, all_passed }
  const [runningCode, setRunningCode] = useState(null); // question_id currently running
  const [isFullscreen, setIsFullscreen] = useState(false); // purely cosmetic — toggles the button label
  const [confirmOpen, setConfirmOpen] = useState(false);
  const submittedRef = useRef(false);
  const containerRef = useRef(null);
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Persist answers + current question on every change so a refresh or a
  // dropped connection can pick right back up where the student left off.
  useEffect(() => {
    try {
      localStorage.setItem(autosaveKey(test.id), JSON.stringify({ answers, currentIndex, saved_at: Date.now() }));
    } catch { /* storage full/unavailable — attempt still works without local persistence */ }
  }, [answers, currentIndex, test.id]);

  // Session Persistence (item 5/10), server side: mirrors the localStorage
  // autosave above to PUT /api/student/tests/:id/progress, debounced so
  // fast typing doesn't spam the network. This is what makes a full
  // logout/login (or a different device) restore the student's progress —
  // localStorage alone can't survive that. Best-effort: a failed autosave
  // never interrupts the attempt, since the localStorage copy is already
  // the primary safety net for the common refresh/reconnect case.
  useEffect(() => {
    const t = setTimeout(() => {
      saveTestProgress(test.id, { answers, current_question_index: currentIndex }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [answers, currentIndex, test.id]);

  // Question-level Time Tracking (item 11) — accumulates seconds spent on
  // each question by diffing timestamps whenever the visible question
  // changes (and on unmount/submit for whichever question was open last).
  // Purely additive analytics for faculty; never read for scoring or
  // navigation logic.
  const questionTimeRef = useRef(new Array(test.questions.length).fill(0));
  const questionEnteredAtRef = useRef(Date.now());
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => {
    const enteredIndex = currentIndex;
    questionEnteredAtRef.current = Date.now();
    return () => {
      const spent = (Date.now() - questionEnteredAtRef.current) / 1000;
      questionTimeRef.current[enteredIndex] = (questionTimeRef.current[enteredIndex] || 0) + spent;
    };
  }, [currentIndex]);

  const clearAutosave = useCallback(() => {
    try { localStorage.removeItem(autosaveKey(test.id)); } catch { /* ignore */ }
  }, [test.id]);

  // IMPORTANT: this must NOT depend on `answers`. Reading from answersRef
  // instead keeps doSubmit's identity stable across the whole attempt so it
  // isn't torn down and rebuilt on every keystroke.
  //
  // doSubmit has exactly two callers: the student's own confirmed "Submit
  // Exam" click (reason: 'manual', see the confirmation Modal below) and
  // the tab-switch visibilitychange listener a few lines down (reason:
  // 'tab_switch'). No timer, fullscreen, blur, resize, or network listener
  // ever calls this — see the block comment at the top of this file.
  //
  // A tab-switch call is silent by design: no toast, no confirmation, no
  // UI change before the switch. Since it only fires once the tab is
  // already hidden, the student sees nothing until they come back — at
  // which point onDone(result) has already closed the attempt and the
  // result screen is what's waiting for them.
  const doSubmit = useCallback(async (reason = 'manual') => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      // Shape each answer to match what the backend expects per question type.
      const currentAnswers = answersRef.current;
      // Flush the currently-open question's elapsed time before reading it.
      const liveSpent = (Date.now() - questionEnteredAtRef.current) / 1000;
      const activeIndex = currentIndexRef.current;
      const timesSnapshot = questionTimeRef.current.map((t, i) => (i === activeIndex ? t + liveSpent : t));
      const shaped = test.questions.map((q, i) => {
        const timeFields = { time_spent_seconds: Math.round(timesSnapshot[i] || 0) };
        if (q.type === 'theory') return { text: currentAnswers[i].text, ...timeFields };
        if (q.type === 'code') return { code: currentAnswers[i].code, ...timeFields };
        return { selected_index: currentAnswers[i].selected_index, ...timeFields };
      });
      const result = await submitTest(test.id, { answers: shaped, reason });
      clearAutosave();
      onDone(result);
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      // A tab-switch attempt can silently fail (e.g. the student's network
      // was already dropping when they switched) — retry once in the
      // background rather than surfacing a toast the student, who has
      // already navigated away, won't see. A manual submit still gets the
      // normal toast so the student (who's still looking at the screen)
      // knows to try again.
      if (reason === 'tab_switch') {
        setTimeout(() => { if (!submittedRef.current) doSubmit('tab_switch'); }, 3000);
      } else {
        showToast(err.message || 'Could not submit your test.', 'error');
      }
    }
  }, [test, onDone, showToast, clearAutosave]);

  // Full-screen is entirely OPTIONAL — this effect only mirrors the
  // browser's actual full-screen state into `isFullscreen` so the toggle
  // button below can show "Enter full screen" / "Exit full screen". It
  // never requests full screen automatically, never reacts to the student
  // leaving full screen beyond updating this label, and is never wired to
  // submission in any way.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      // Tidy up if the student happens to still be in full screen when
      // this attempt unmounts (e.g. after a manual submit) — cosmetic
      // only, not part of the submit flow.
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Tab-switch auto-submission — the ONLY automatic submission trigger in
  // this component (see the block comment at the top of this file). The
  // Page Visibility API's "visibilitychange" event + document.hidden is
  // the one reliable, spec-defined signal for "the user actually
  // navigated away from this tab" — it does NOT fire for mouse movement,
  // clicks, scrolling, typing (including Tab inside the code editor,
  // which CodeEditor intercepts for indentation and never lets bubble up
  // to the browser as a real tab change), fullscreen toggling, or window
  // resizing, and it's a materially stronger signal than "blur" (which
  // also fires for transient focus changes like opening dev tools or
  // clicking the address bar — exactly the false positives we must NOT
  // auto-submit on). The moment the test tab is hidden, this submits
  // immediately with the student's current answers/code exactly as they
  // stand — silently, with nothing shown to the student before the
  // switch — and the resulting submission is stamped 'tab_switch' so
  // faculty are notified and it shows as "Submitted — Tab Switch".
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) doSubmit('tab_switch');
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [doSubmit]);

  // Countdown timer — IMPORTANT: NO AUTOMATIC EXAM SUBMISSION. Reaching
  // 00:00 does not submit, exit, redirect, calculate a score, update the
  // leaderboard, or lock the exam in any way. It just stops counting and
  // the "Time Expired" banner below tells the student to submit manually.
  // This is display/UX only regardless: the server independently tracks
  // each student's own join time, so nothing here can be used to cheat a
  // deadline either way.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);
  const timeExpired = secondsLeft <= 0;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const setAnswer = (i, patch) => setAnswers((prev) => prev.map((a, ai) => (ai === i ? { ...a, ...patch } : a)));

  const handleRunCode = async (q, i) => {
    const codeAtRunTime = answers[i].code;
    setRunningCode(q.id);
    try {
      const { results, all_passed } = await runTestCode(test.id, q.id, codeAtRunTime);
      setCodeResults((prev) => ({ ...prev, [q.id]: { results, all_passed, forCode: codeAtRunTime } }));
      showToast(all_passed ? 'All test cases passed.' : 'Some test cases did not pass. You can fix your code and check again, or move on — Check Code never submits your exam.', all_passed ? 'success' : 'warning');
    } catch (err) {
      showToast(err.message || 'Could not run your code.', 'error');
    } finally {
      setRunningCode(null);
    }
  };

  // Compiler custom-input run (item 12) — separate from Check Code above:
  // this runs against whatever the student typed into the "Your input"
  // box, purely to see what their program prints, never against the
  // faculty's test cases and never logged as an attempt.
  const [customInputs, setCustomInputs] = useState({}); // question_id -> input string
  const [customRunResults, setCustomRunResults] = useState({}); // question_id -> { output, error }
  const [runningCustom, setRunningCustom] = useState(null);
  const handleRunCustomInput = async (q, i) => {
    setRunningCustom(q.id);
    try {
      const result = await runTestCodeCustomInput(test.id, q.id, answers[i].code, customInputs[q.id] || '');
      setCustomRunResults((prev) => ({ ...prev, [q.id]: result }));
    } catch (err) {
      showToast(err.message || 'Could not run your code.', 'error');
    } finally {
      setRunningCustom(null);
    }
  };

  const isAnswered = (q, i) => {
    if (q.type === 'mcq') return answers[i].selected_index !== null;
    if (q.type === 'code') return answers[i].code.trim().length > 0;
    return answers[i].text.trim().length > 0;
  };
  // A code question is "checked" once it's been run against every test
  // case and passed — and only for that exact code. Editing the code after
  // a passing check un-checks it again, since what's on screen is no
  // longer what was proven to pass. This is informational only — Check
  // Code and Submit Exam are completely separate actions, so an
  // un-checked (or failing) code question never blocks submission.
  const isCodeVerified = (q, i) => codeResults[q.id]?.all_passed === true && codeResults[q.id]?.forCode === answers[i].code;
  const answeredCount = useMemo(() => test.questions.filter((q, i) => isAnswered(q, i)).length, [answers, test.questions]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalCount = test.questions.length;
  const unansweredCount = totalCount - answeredCount;

  const goTo = (i) => setCurrentIndex(Math.max(0, Math.min(totalCount - 1, i)));

  // Test Navigation Shortcuts (item 12/17): ← / → move between questions,
  // digit keys 1-9 jump straight to that question number. Disabled while
  // focus is inside a text field, textarea, or the code editor so typing
  // an answer (e.g. a theory answer containing digits, or Left/Right while
  // editing code) is never hijacked as navigation.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable
        || document.activeElement?.closest?.('.cm-editor, .monaco-editor, [data-code-editor]');
      if (isEditable) return;
      if (e.key === 'ArrowRight') { goTo(currentIndex + 1); }
      else if (e.key === 'ArrowLeft') { goTo(currentIndex - 1); }
      else if (/^[1-9]$/.test(e.key)) { const i = Number(e.key) - 1; if (i < totalCount) goTo(i); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, totalCount]); // eslint-disable-line react-hooks/exhaustive-deps


  // Full-screen is entirely optional and purely a convenience for the
  // student — this just toggles it on/off. Nothing about the test's state
  // (answers, current question, timer) is affected either way, and leaving
  // full screen (by this button, Esc, Alt+Tab, or anything else) never
  // triggers a warning, a forced re-entry, or a submission.
  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {
        showToast('Your browser blocked entering fullscreen — click anywhere on the page first, then try again.', 'error');
      });
    }
  };

  // Submit Exam only ever opens the confirmation dialog — it never submits
  // by itself, and it is never gated on Check Code having been run.
  const handleSubmitClick = () => setConfirmOpen(true);

  const q = test.questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalCount - 1;
  const LANG_EXT = { python: 'py', java: 'java', c: 'c', cpp: 'cpp', javascript: 'js' };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[500] flex flex-col overflow-hidden bg-paper">
      {/* Sticky header: identity, progress, timer, question navigation panel */}
      <div className="shrink-0 border-b border-line bg-paper-card/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal">Test in progress</p>
              <h1 className="truncate text-lg font-bold text-ink">{test.title}</h1>
              <p className="text-xs text-ink-light">
                {test.subject} · {test.total_marks} marks · Question {currentIndex + 1} of {totalCount} · {answeredCount}/{totalCount} answered
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isMonitored && (
                <span
                  className="flex items-center gap-1.5 rounded-full bg-crimson/10 px-3 py-2 text-[11px] font-bold text-crimson"
                  title="Your camera and/or microphone are being monitored by your faculty for this test."
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-crimson" /> Monitored
                </span>
              )}
              {/* item 11: camera and audio status are shown independently —
                  either one being unavailable/denied never blocks the test,
                  which is already open by the time this renders. */}
              <MonitoringStatusBadge label="Camera" status={cameraStatus} />
              <MonitoringStatusBadge label="Audio" status={audioStatus} />
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink-light hover:bg-paper"
                title="Fullscreen is optional — this is just a convenience toggle."
              >
                {isFullscreen ? '⤢ Exit fullscreen' : '⛶ Fullscreen'}
              </button>
              <div
                className={`rounded-full px-4 py-2 text-center text-sm font-bold tabular-nums ${
                  secondsLeft < 60 ? 'animate-pulse bg-crimson/10 text-crimson' : secondsLeft < 300 ? 'bg-gold/10 text-gold' : 'bg-teal/10 text-teal'
                }`}
              >
                {mm}:{ss}
                <div className="text-[9px] font-semibold uppercase tracking-wide opacity-70">{timeExpired ? 'time expired' : 'time remaining'}</div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line/50">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${totalCount ? (answeredCount / totalCount) * 100 : 0}%` }} />
          </div>

          {/* Question navigation panel — clicking only ever navigates, it
              never submits or exits the exam. Shows current / answered /
              unanswered, plus a distinct marker for coding questions and
              for a coding question that's been checked and passed. */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {test.questions.map((qq, i) => {
              const answered = isAnswered(qq, i);
              const current = i === currentIndex;
              const checked = qq.type === 'code' && isCodeVerified(qq, i);
              const label = `Question ${i + 1}${qq.type === 'code' ? ' — coding' : ''}${checked ? ' — code checked' : answered ? ' — answered' : ' — not answered'}`;
              return (
                <button
                  key={qq.id}
                  type="button"
                  onClick={() => goTo(i)}
                  title={label}
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    current ? 'scale-110 ring-2 ring-hero-primary ring-offset-2 ring-offset-paper-card' : ''
                  } ${checked ? 'bg-purple text-white' : answered ? 'bg-teal text-white' : 'border border-line bg-paper text-ink-light hover:bg-line/40'}`}
                >
                  {i + 1}
                  {qq.type === 'code' && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-gold" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable content — one question at a time */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Floating notices: absolutely positioned so they never shift the
            layout underneath when they appear/disappear. */}
        {timeExpired && (
          <div className="absolute inset-x-0 top-3 z-20 flex justify-center px-5">
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-crimson/30 bg-paper-card px-4 py-2.5 shadow-lg">
              <p className="text-xs font-bold text-crimson">⏰ Time Expired — Please Submit Your Exam</p>
              <button
                type="button"
                onClick={handleSubmitClick}
                className="shrink-0 rounded-full bg-crimson px-4 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                Submit Exam
              </button>
            </div>
          </div>
        )}

        {currentIndex === 0 && (
          <div className="mx-auto max-w-5xl px-5 pt-6">
            <p className="mb-2 rounded-lg border border-line bg-paper-card p-3 text-xs leading-relaxed text-ink-light">
              ℹ Fullscreen is optional here — you can take this test in fullscreen or in your normal browser window, and switching between
              them at any point never affects your test, your answers, or your timer. Nothing you do submits the test except clicking
              "Submit Exam" below and confirming.
            </p>
          </div>
        )}

        {q.type === 'code' ? (
          /* Two-panel coding layout: question/description/test-cases on the
             left (scrollable independently), editor + run/results on the
             right — the editor stays visible while scrolling the question. */
          <div className="mx-auto flex h-full max-w-[100rem] flex-col gap-4 px-5 py-6 lg:h-[calc(100%-1rem)] lg:flex-row">
            {/* Question / test-case panel — narrower now so the compiler on
                the right gets a larger, more comfortable working area, while
                staying independently scrollable and fully readable. */}
            <div className="flex min-h-0 flex-col gap-3 rounded-2xl border border-line bg-paper-card p-5 shadow-sm lg:w-[34%] lg:shrink-0 lg:overflow-y-auto">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper-card">{currentIndex + 1}</span>
                  <h2 className="text-sm font-bold leading-snug text-ink">Question {currentIndex + 1}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_BADGE.code}`}>{TYPE_LABEL.code}</span>
                  <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-[11px] font-bold text-ink-light">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.text}</p>

              <div className="rounded-xl border border-line bg-paper p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-light">Language</p>
                <p className="mt-1 text-sm font-semibold capitalize text-ink">{q.language} <span className="font-normal text-ink-light">(fixed by your faculty)</span></p>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">Sample input / output &amp; test cases</p>
                <p className="mb-2 text-[11px] text-ink-light">Your solution must produce the exact expected output (after trimming whitespace) for every case below to be accepted.</p>
                <div className="space-y-2">
                  {q.test_cases.map((tc, ti) => {
                    const r = codeResults[q.id]?.results?.[ti];
                    return (
                      <div key={ti} className={`rounded-lg border p-2.5 text-xs ${r ? (r.passed ? 'border-teal/30 bg-teal/5' : 'border-crimson/30 bg-crimson/5') : 'border-line'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink-light">Test case {ti + 1}</span>
                          {r && <span className={r.passed ? 'font-bold text-teal' : 'font-bold text-crimson'}>{r.passed ? '✓ Passed' : '✕ Not passed'}</span>}
                        </div>
                        {tc.input && <p className="mt-1 whitespace-pre-wrap font-mono text-ink-light">Sample input: {tc.input}</p>}
                        <p className="mt-1 whitespace-pre-wrap font-mono text-ink-light">Expected output: {tc.expected_output}</p>
                        {r && !r.passed && (
                          <p className="mt-1 whitespace-pre-wrap font-mono text-crimson">{r.error ? r.error : `Got: ${r.actual_output || '(empty)'}`}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Compiler panel — wider (66% on large screens instead of the
                previous 50/50 split), with a tall, comfortable editing
                area (min-height ~28rem, and it grows to fill the rest of
                the viewport below the header/footer) and proper internal
                scrolling for long programs. Responsive: on smaller screens
                this panel stacks under the question panel at full width. */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:w-[66%]">
              <div className="flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-2xl border border-line shadow-sm">
                <div className="flex items-center justify-between border-b border-line bg-ink px-3 py-1.5">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-paper-card/80">{q.language}</span>
                  <span className="font-mono text-[10px] text-paper-card/50">solution.{LANG_EXT[q.language] || 'txt'}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto bg-surface-dark">
                  <CodeEditor
                    value={answers[currentIndex].code}
                    onChange={(code) => setAnswer(currentIndex, { code })}
                    language={q.language}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleRunCode(q, currentIndex)}
                  disabled={runningCode === q.id || !answers[currentIndex].code.trim()}
                  className="rounded-lg bg-hero-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {runningCode === q.id ? 'Checking…' : '▶ Check Code'}
                </button>
                {codeResults[q.id] && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${codeResults[q.id].all_passed ? 'bg-teal/10 text-teal' : 'bg-crimson/10 text-crimson'}`}>
                    {codeResults[q.id].results.filter((r) => r.passed).length}/{codeResults[q.id].results.length} test cases passed
                  </span>
                )}
                {isCodeVerified(q, currentIndex) ? (
                  <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">✓ All test cases passed</span>
                ) : codeResults[q.id] && codeResults[q.id].forCode !== answers[currentIndex].code ? (
                  <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">Code changed — check it again</span>
                ) : null}
              </div>

              {/* Custom-input run panel (item 12) — like a coding-practice
                  platform: the student can type their own input and see
                  exactly what their program prints, independent of the
                  faculty's test cases. */}
              <div className="rounded-xl border border-line bg-paper-card p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-light">Try your own input</p>
                <textarea
                  value={customInputs[q.id] || ''}
                  onChange={(e) => setCustomInputs((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type input for your program here…"
                  rows={2}
                  className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-ink outline-none focus:border-hero-primary"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleRunCustomInput(q, currentIndex)}
                    disabled={runningCustom === q.id || !answers[currentIndex].code.trim()}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper disabled:opacity-50"
                  >
                    {runningCustom === q.id ? 'Running…' : '▶ Run'}
                  </button>
                </div>
                {customRunResults[q.id] && (
                  <div className="mt-2 rounded-lg bg-surface-dark p-2 font-mono text-xs">
                    {customRunResults[q.id].error ? (
                      <p className="whitespace-pre-wrap text-crimson">{customRunResults[q.id].error}</p>
                    ) : (
                      <p className="whitespace-pre-wrap text-paper-card">{customRunResults[q.id].output || '(no output)'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Output / result section */}
              <div className="min-h-[3rem] flex-1 overflow-y-auto rounded-xl border border-line bg-paper p-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-light">Output / Result</p>
                {!codeResults[q.id] ? (
                  <p className="text-xs text-ink-light">Run your code to see results here.</p>
                ) : (
                  <div className="space-y-1.5">
                    {codeResults[q.id].results.map((r, ri) => (
                      <p key={ri} className={`font-mono text-xs ${r.passed ? 'text-teal' : 'text-crimson'}`}>
                        Test {ri + 1}: {r.passed ? 'Passed' : r.error ? r.error : `Got "${r.actual_output || ''}"`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-5 py-6">
            <div id={`test-question-${currentIndex}`} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper-card">
                    {currentIndex + 1}
                  </span>
                  <p className="text-sm font-semibold leading-snug text-ink">{q.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-10 sm:pl-0">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_BADGE[q.type]}`}>{TYPE_LABEL[q.type]}</span>
                  <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-[11px] font-bold text-ink-light">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
              </div>

              {q.type === 'mcq' ? (
                <div className="space-y-2 pl-10">
                  {q.options.map((opt, oi) => {
                    const selected = answers[currentIndex].selected_index === oi;
                    return (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                          selected ? 'border-teal bg-teal/5 font-semibold text-ink' : 'border-line text-ink hover:bg-paper'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={selected}
                          onChange={() => setAnswer(currentIndex, { selected_index: oi })}
                          className="h-4 w-4 accent-teal"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="pl-10">
                  <textarea
                    rows={8}
                    value={answers[currentIndex].text}
                    onChange={(e) => setAnswer(currentIndex, { text: e.target.value })}
                    placeholder="Write your answer…"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-teal"
                  />
                  <p className="mt-1 text-right text-[11px] text-ink-light">{answers[currentIndex].text.trim().split(/\s+/).filter(Boolean).length} words</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* spacer so content isn't hidden behind the sticky footer */}
        <div className="h-4" />
      </div>

      {/* Sticky footer — Previous / Next / Submit Exam are always all three
          present and independent: Next only ever saves + advances, Previous
          only ever saves + goes back, and neither one, nor question-number
          navigation, nor Check Code, nor the timer, ever submits the exam.
          Only Submit Exam → Confirmation → Confirm finishes it. */}
      <div className="shrink-0 border-t border-line bg-paper-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-3">
          <button
            type="button"
            onClick={() => goTo(currentIndex - 1)}
            disabled={isFirst}
            className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
          >
            ← Previous
          </button>
          <p className="hidden flex-1 text-center text-xs text-ink-light sm:block">
            {unansweredCount === 0 ? 'All questions answered.' : `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} left unanswered.`}
          </p>
          <button
            type="button"
            onClick={() => goTo(currentIndex + 1)}
            disabled={isLast}
            className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={submitting}
            className="rounded-full bg-hero-primary px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 sm:px-6"
          >
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit Exam?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="flex-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
            >
              Keep working
            </button>
            <button
              type="button"
              onClick={() => { setConfirmOpen(false); doSubmit(); }}
              disabled={submitting}
              className="flex-1 rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Confirm'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-light">
            Are you sure you want to submit the exam? Once submitted, you cannot modify your answers.
          </p>
          <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-paper px-3 py-2.5 text-xs">
            <span><span className="font-bold text-ink">{totalCount}</span> <span className="text-ink-light">total</span></span>
            <span><span className="font-bold text-teal">{answeredCount}</span> <span className="text-ink-light">attempted</span></span>
            <span><span className="font-bold text-crimson">{unansweredCount}</span> <span className="text-ink-light">unanswered</span></span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
