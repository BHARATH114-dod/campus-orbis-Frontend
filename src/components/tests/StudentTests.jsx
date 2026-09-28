import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { fetchAvailableTests, fetchTestToAttempt, fetchTestLeaderboard, requestTestRejoin } from '../../services/testService';
import { subscribeRealtime } from '../../services/realtime';
import { requestMonitoringStream, monitoringStatusMessage } from '../../utils/testMonitoringMedia';
import { formatExactDateTime, formatCountdown } from '../../utils/date';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';
import TestAttempt from './TestAttempt';
import TestLeaderboardModal from './TestLeaderboardModal';
import AllTestsLeaderboardModal from './AllTestsLeaderboardModal';
import Modal from '../common/Modal';

function formatDuration(ms) {
  if (ms == null) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const STATUS_STYLE = { open: 'bg-teal/10 text-teal', upcoming: 'bg-gold/10 text-gold', closed: 'bg-line/50 text-ink-light' };
const STATUS_LABEL = { open: 'Live', upcoming: 'Upcoming', closed: 'Completed' };

const WITHIN_HOUR_MS = 60 * 60 * 1000;

// Test Scheduling — exact start/end time (always shown, spec items 8/9)
// plus a live countdown once the test is within an hour of starting
// (spec items 6/7) or already open (a client-side "Time Remaining"
// estimate — the authoritative timer only starts once the student
// actually joins; see getOrCreateJoinAnchor in server.js). `nowTick`
// comes from the parent's once-a-second interval so every card on the
// page updates together without each running its own timer.
function ScheduleInfo({ test: t, nowTick }) {
  const startLabel = formatExactDateTime(t.start_time);
  const endLabel = formatExactDateTime(t.end_time);
  if (!startLabel && !endLabel) return null;

  const msToStart = t.start_time ? new Date(t.start_time).getTime() - nowTick : null;
  const msToEnd = t.end_time ? new Date(t.end_time).getTime() - nowTick : null;
  const startingSoon = t.status === 'upcoming' && msToStart != null && msToStart <= WITHIN_HOUR_MS && msToStart > 0;

  return (
    <div className="mt-3 space-y-1.5 rounded-xl bg-paper px-3 py-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-light">
        {startLabel && <span><span className="font-semibold text-ink">Starts:</span> {startLabel}</span>}
        {endLabel && <span><span className="font-semibold text-ink">Ends:</span> {endLabel}</span>}
      </div>
      {startingSoon && (
        <div className="flex items-center gap-1.5 font-bold text-gold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" /> Starting Soon · Starts In {formatCountdown(msToStart)}
        </div>
      )}
      {t.status === 'open' && msToEnd != null && msToEnd > 0 && (
        <div className="font-semibold text-teal">Time Remaining: {formatCountdown(msToEnd)}</div>
      )}
    </div>
  );
}

// Points at whichever test the student is currently mid-attempt on, if
// any — set the moment a join succeeds, cleared the moment it ends
// (submitted, or the resume attempt turns out to be no longer valid).
// This is what lets a page refresh return the student straight to their
// active test instead of showing "Start test" again and running the
// whole permission/join flow a second time — the actual join itself was
// already idempotent server-side (getOrCreateJoinAnchor reuses the
// existing anchor), but the frontend previously had no memory of it at
// all, so a refresh always looked like square one.
const ACTIVE_TEST_KEY = 'campus-orbis-active-test-id';

export default function StudentTests() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attemptTest, setAttemptTest] = useState(null); // full question set once loaded, without answers
  const [attemptSecondsLeft, setAttemptSecondsLeft] = useState(null);
  const [attemptSavedProgress, setAttemptSavedProgress] = useState(null); // server-side autosaved answers, if any
  const [resuming, setResuming] = useState(false); // true only while auto-resuming after a refresh
  const [reviewTestId, setReviewTestId] = useState(null);
  const [resultData, setResultData] = useState(null); // { testId, testTitle, submission, total_marks } or null
  const [leaderboardTest, setLeaderboardTest] = useState(null); // { id, title } or null
  const [showAllTestsLb, setShowAllTestsLb] = useState(false);
  const [starting, setStartingId] = useState(null);
  // Informational only — reflects what the browser reported so the
  // faculty/HOD monitoring view can show "Denied" vs "Unavailable"
  // (see computeCameraStatus in server.js), and so the student sees an
  // accurate Camera/Audio status during the test (item 11). Camera and
  // audio are tracked independently — one being unavailable never implies
  // the other is, and neither ever gates the test itself.
  const [cameraStatus, setCameraStatus] = useState('unavailable'); // 'granted' | 'denied' | 'unavailable'
  const [audioStatus, setAudioStatus] = useState('unavailable');
  const monitorStreamRef = useRef(null); // camera and/or mic MediaStream for the in-progress attempt, or null
  const resumeAttemptedRef = useRef(false); // guards the resume bootstrap against StrictMode's dev double-invoke
  const startInFlightRef = useRef(false); // guards handleStart against a second call landing before `starting` re-renders the disabled button
  // True whenever this component instance is mounted; the resume effect
  // below uses it (not a per-effect-run local) to know whether it's safe
  // to setState once its async work resolves. A per-run local variable
  // gets permanently poisoned by React 18 StrictMode's dev-only
  // mount→cleanup→mount double-invoke — the cleanup for run 1 fires
  // synchronously as part of that cycle, which would mark run 1
  // "cancelled" forever even though run 1 is the one whose promise
  // actually goes on to resolve (resumeAttemptedRef above ensures only
  // one resume routine is ever started in the first place). Setting this
  // ref to true again at the top of every effect run — not just once —
  // is what makes it settle back to "mounted" once the double-invoke
  // cycle finishes, while a real unmount still flips it to false.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = () => {
    setLoading(true);
    fetchAvailableTests().then(setTests).catch((err) => showToast(err.message || 'Could not load tests.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Test Scheduling — a silent (no spinner) refresh, used to pick up the
  // server's authoritative status the moment a scheduled start/end time
  // is reached, without flashing the whole list to a loading state every
  // time. The countdown display itself ticks locally every second (see
  // `nowTick` below) purely for the HH:MM:SS text — the actual open/
  // closed/upcoming gating always comes from `t.status`, which only this
  // silent refresh (or the initial `load()` above) can change.
  const refreshSilently = () => {
    fetchAvailableTests().then(setTests).catch(() => { /* best-effort — next tick or the boundary-triggered refresh below will retry */ });
  };

  // Real-time push (item: rejoin notifications) — when faculty
  // accepts/rejects this student's rejoin request, the server broadcasts
  // to `user:<username>` (see the rejoin decision endpoint in server.js)
  // and this silently refreshes the list so "Resume Test" appears without
  // the student needing to manually reload. The in-app notification bell
  // (existing notifyUsers system) still fires independently either way —
  // this is purely to keep the Tests list itself current.
  useEffect(() => {
    if (!user?.username) return undefined;
    return subscribeRealtime(`user:${user.username}`, (msg) => {
      if (msg.type === 'rejoin_decided') refreshSilently();
    });
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticks once a second so every card's countdown (Starting Soon / Time
  // Remaining) updates in real time, per spec item 6. This does NOT by
  // itself change any test's status — it only drives the displayed
  // digits between the silent refreshes below.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Re-poll the authoritative list the moment any test we currently show
  // as "upcoming" or "open" crosses its scheduled start/end time on the
  // client clock, so the Start button appears (or the window closes)
  // as soon as the server agrees — never relying on the client clock
  // alone to actually unlock or lock anything (that's still enforced
  // server-side; this is only about the UI catching up promptly). Also
  // refreshes on a gentle fixed cadence as a safety net against clock
  // drift between this device and the server.
  const lastBoundaryPollRef = useRef(0);
  useEffect(() => {
    if (tests.length === 0) return;
    const dueNow = tests.some((t) => {
      if (t.status === 'upcoming' && t.start_time) return new Date(t.start_time).getTime() <= nowTick;
      if (t.status === 'open' && t.end_time) return new Date(t.end_time).getTime() <= nowTick;
      return false;
    });
    const dueForSafetyNet = nowTick - lastBoundaryPollRef.current >= 15000;
    if (dueNow || dueForSafetyNet) {
      lastBoundaryPollRef.current = nowTick;
      refreshSilently();
    }
  }, [nowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stops and releases the camera/mic stream, if one is currently held.
  // This is the ONLY place a stream is ever stopped — the recorder in
  // TestAttempt.jsx only uses the stream, it never ends it (see the block
  // comment there for why that used to crash the page).
  const releaseMonitorStream = () => {
    monitorStreamRef.current?.getTracks().forEach((t) => t.stop());
    monitorStreamRef.current = null;
  };

  // Safety net: if the student navigates away from Tests entirely while
  // still mid-attempt (rather than submitting), make sure the camera
  // doesn't keep running in the background.
  useEffect(() => () => releaseMonitorStream(), []);

  // Test Monitoring: camera + microphone permission is OPTIONAL and never
  // blocks the test. We still attempt getUserMedia up front (so, if
  // granted, the recorder/heartbeat/live-view hooks in TestAttempt.jsx can
  // start immediately with the test already open) — but whatever happens
  // with that attempt, the test itself always opens right after. A denied
  // prompt, a missing device, a busy device, an unsupported browser, or
  // any other camera-related failure all fall through to the same place:
  // fetchTestToAttempt() runs and the test opens with monitorStream left
  // null. Camera failure is never a reason to stop here.
  const handleStart = async (id) => {
    // The Start button disables itself via `starting === t.id`, but that
    // only takes effect once React re-renders — a very fast double-click
    // (or a duplicate call from anywhere else) can still land before
    // then. This ref closes that window synchronously, so the permission
    // prompt is only ever requested once and only one message can ever be
    // shown for one click.
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setStartingId(id);
    try {
      // Camera/mic is attempted, but never awaited as a gate: whatever it
      // resolves to (a live stream, or null on any failure), the test
      // still opens right below. A non-fatal, informational toast is
      // shown on failure — never an error that implies the test is
      // blocked, because it isn't.
      const result = await requestMonitoringStream();
      const stream = result.ok ? result.stream : null;
      setCameraStatus(result.camera);
      setAudioStatus(result.audio);
      const infoMessage = monitoringStatusMessage(result.camera, result.audio);
      if (infoMessage) showToast(infoMessage, 'info');
      try {
        const { test, submission, seconds_left, saved_progress } = await fetchTestToAttempt(id);
        if (submission) { stream?.getTracks().forEach((t) => t.stop()); setReviewTestId(id); return; }
        monitorStreamRef.current = stream; // may be null — TestAttempt.jsx and its hooks all handle that as "no monitoring", never as an error
        try { localStorage.setItem(ACTIVE_TEST_KEY, id); } catch { /* storage unavailable — refresh-resume just won't work this session */ }
        setAttemptTest(test);
        setAttemptSecondsLeft(seconds_left);
        setAttemptSavedProgress(saved_progress || null);
      } catch (err) {
        stream?.getTracks().forEach((t) => t.stop());
        showToast(err.message || 'Could not start this test.', 'error');
      }
    } finally {
      startInFlightRef.current = false;
      setStartingId(null);
    }
  };

  // Refresh-resume: on mount, if a previous session left an active test
  // pointer behind, silently pick the attempt back up instead of showing
  // the tests list / "Start test" button. getUserMedia here does NOT
  // re-prompt the student — the browser already remembers this origin was
  // granted camera/mic access, so it resolves immediately if still
  // granted. The test join itself is safe to repeat: the server reuses
  // the same join anchor (getOrCreateJoinAnchor), so this never creates a
  // duplicate join or grants extra time.
  //
  // Camera is optional here too: if it's no longer available (revoked,
  // different device, browser genuinely unsupported, etc.) the resume
  // still proceeds and reopens the test with monitorStream left null —
  // it never falls back to the plain tests list just because the camera
  // isn't there anymore. The test session itself was never in doubt.
  useEffect(() => {
    if (resumeAttemptedRef.current) return; // StrictMode dev double-invoke guard — only ever try once
    let storedId;
    try { storedId = localStorage.getItem(ACTIVE_TEST_KEY); } catch { storedId = null; }
    if (!storedId) return;
    resumeAttemptedRef.current = true;
    setResuming(true);
    (async () => {
      const result = await requestMonitoringStream();
      const stream = result.ok ? result.stream : null;
      setCameraStatus(result.camera);
      setAudioStatus(result.audio);
      const infoMessage = monitoringStatusMessage(result.camera, result.audio);
      if (infoMessage && mountedRef.current) showToast(infoMessage, 'info');
      if (!mountedRef.current) { stream?.getTracks().forEach((t) => t.stop()); return; }
      try {
        const { test, submission, seconds_left, saved_progress } = await fetchTestToAttempt(storedId);
        if (!mountedRef.current) { stream?.getTracks().forEach((t) => t.stop()); return; }
        if (submission) {
          // Already finished (submitted from another tab, or a tab-switch
          // auto-submit landed after the refresh) — nothing to resume.
          stream?.getTracks().forEach((t) => t.stop());
          try { localStorage.removeItem(ACTIVE_TEST_KEY); } catch { /* ignore */ }
          setResuming(false);
          return;
        }
        monitorStreamRef.current = stream; // may be null — resume still proceeds
        setAttemptTest(test);
        setAttemptSecondsLeft(seconds_left);
        setAttemptSavedProgress(saved_progress || null);
        setResuming(false);
      } catch (err) {
        stream?.getTracks().forEach((t) => t.stop());
        try { localStorage.removeItem(ACTIVE_TEST_KEY); } catch { /* ignore */ }
        if (mountedRef.current) {
          showToast(err.message || 'Could not resume your test — the window may have closed.', 'error');
          setResuming(false);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // RESULT PAGE — shown right after a confirmed Submit Exam, not just a
  // toast: Score, Correct, Wrong, Attempted, Time Taken, Submitted At, and
  // rank if available (see ResultModal below).
  const handleDone = (result) => {
    const submittedTestId = attemptTest?.id;
    const submittedTestTitle = attemptTest?.title;
    setAttemptTest(null);
    releaseMonitorStream();
    try { localStorage.removeItem(ACTIVE_TEST_KEY); } catch { /* ignore */ }
    if (result?.submission) {
      setResultData({ testId: submittedTestId, testTitle: submittedTestTitle, submission: result.submission, total_marks: result.total_marks });
    }
    load();
  };

  // If TestAttempt somehow still throws despite the guards in its
  // recorder code, this stops the camera and drops back to the tests
  // list instead of leaving the student on a blank page.
  const handleAttemptCrash = () => {
    setAttemptTest(null);
    releaseMonitorStream();
    try { localStorage.removeItem(ACTIVE_TEST_KEY); } catch { /* ignore */ }
    load();
  };

  if (resuming) {
    return <LoadingSpinner label="Resuming your test…" />;
  }

  if (attemptTest) {
    return (
      <ErrorBoundary message="Something went wrong loading your test. Your answers up to this point were auto-saved." onReset={handleAttemptCrash}>
        <TestAttempt test={attemptTest} initialSecondsLeft={attemptSecondsLeft} savedProgress={attemptSavedProgress} onDone={handleDone} monitorStream={monitorStreamRef.current} cameraStatus={cameraStatus} audioStatus={audioStatus} />
      </ErrorBoundary>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Tests</h1>
        <button
          type="button"
          onClick={() => setShowAllTestsLb(true)}
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
        >
          🏆 All Tests
        </button>
      </div>
      <p className="mb-6 text-sm text-ink-light">Tests assigned to your section.</p>

      {loading ? (
        <LoadingSpinner label="Loading tests…" />
      ) : tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No tests assigned yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                  <p className="text-sm text-ink-light">{t.subject} · {t.created_by_name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[t.status]}`}>
                  {t.status === 'upcoming' && t.start_time && new Date(t.start_time).getTime() - nowTick <= WITHIN_HOUR_MS
                    ? 'Starting Soon'
                    : STATUS_LABEL[t.status] || t.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                <span>{t.question_count} question{t.question_count === 1 ? '' : 's'}</span>
                <span>{t.duration_minutes} min</span>
                <span>{t.total_marks} marks</span>
              </div>
              <ScheduleInfo test={t} nowTick={nowTick} />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {t.submitted ? (
                  <>
                    <button type="button" onClick={() => setReviewTestId(t.id)} className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-paper">
                      {t.fully_graded ? `Review — ${t.score}/${t.total_marks}` : 'View submission (pending grading)'}
                    </button>
                    {t.submission_reason === 'tab_switch' && (
                      <span className="rounded-full bg-crimson/10 px-3 py-1 text-[11px] font-bold text-crimson" title="This test was automatically submitted after you switched away from the test tab.">
                        Submitted — Tab Switch
                      </span>
                    )}
                  </>
                ) : t.status === 'open' ? (
                  <button
                    type="button"
                    onClick={() => handleStart(t.id)}
                    disabled={starting === t.id}
                    className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {starting === t.id ? 'Loading…' : 'Start test'}
                  </button>
                ) : (
                  <span className="rounded-full bg-line/50 px-3 py-1 text-xs font-semibold text-ink-light">
                    {t.status === 'upcoming' ? 'Start Test — locked until the scheduled time' : 'Window closed'}
                  </span>
                )}
                {t.status !== 'upcoming' && (
                  <button
                    type="button"
                    onClick={() => setLeaderboardTest({ id: t.id, title: t.title })}
                    className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-paper"
                  >
                    🏆 Leaderboard
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReviewModal testId={reviewTestId} onClose={() => setReviewTestId(null)} />
      <ResultModal data={resultData} onClose={() => setResultData(null)} onViewLeaderboard={() => { setLeaderboardTest({ id: resultData.testId, title: resultData.testTitle }); setResultData(null); }} />
      <TestLeaderboardModal testId={leaderboardTest?.id || null} testTitle={leaderboardTest?.title} onClose={() => setLeaderboardTest(null)} />
      <AllTestsLeaderboardModal open={showAllTestsLb} onClose={() => setShowAllTestsLb(false)} />
    </div>
  );
}

// RESULT PAGE — shown immediately after a confirmed Submit Exam. Score,
// correct/wrong/attempted counts and time taken come straight from the
// submit response (all server-computed); rank is fetched separately from
// the per-test leaderboard once it's had a moment to include this
// submission.
function ResultModal({ data, onClose, onViewLeaderboard }) {
  const { user } = useAuth();
  const [rank, setRank] = useState(null); // number | null | 'loading'

  useEffect(() => {
    if (!data) { setRank(null); return; }
    setRank('loading');
    fetchTestLeaderboard(data.testId)
      .then((lb) => {
        const mine = lb.leaderboard.find((e) => e.username === user?.username);
        setRank(mine ? mine.rank : null);
      })
      .catch(() => setRank(null));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const { submission, total_marks } = data;
  const totalQuestions = submission.answers.length;
  const attempted = submission.answers.filter((a) => {
    if (a.type === 'mcq') return a.selected_index !== -1 && a.selected_index != null;
    if (a.type === 'code') return !!(a.code && a.code.trim());
    return !!(a.answer_text && a.answer_text.trim());
  }).length;

  return (
    <Modal open onClose={onClose} title="Exam Submitted Successfully">
      <div className="space-y-4">
        {submission.submission_reason === 'tab_switch' && (
          <p className="rounded-lg bg-crimson/10 px-3 py-2 text-xs font-semibold text-crimson">
            ⚠️ Your test was automatically submitted because you switched away from the test tab.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Score" value={`${submission.score} / ${total_marks}`} />
          <Stat label="Points" value={submission.points} accent="text-teal" />
          <Stat label="Correct Answers" value={submission.correct_count} accent="text-teal" />
          <Stat label="Wrong Answers" value={submission.wrong_count} accent="text-crimson" />
          <Stat label="Attempted" value={`${attempted}/${totalQuestions}`} />
          <Stat label="Time Taken" value={formatDuration(submission.time_taken_ms)} />
        </div>
        <p className="text-xs text-ink-light">Submitted At: {new Date(submission.submitted_at).toLocaleString()}</p>
        {!submission.fully_graded && (
          <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">Theory answers are pending your faculty's review — your final score may change.</p>
        )}
        <p className="text-sm font-semibold text-ink">
          {rank === 'loading' ? 'Checking your rank…' : rank ? `🏆 Rank #${rank} on the leaderboard` : 'Rank not available yet.'}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper">Close</button>
          <button type="button" onClick={onViewLeaderboard} className="flex-1 rounded-lg bg-hero-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90">🏆 View Leaderboard</button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value, accent = 'text-ink' }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-light">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function ReviewModal({ testId, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rejoinReason, setRejoinReason] = useState('');
  const [rejoinBusy, setRejoinBusy] = useState(false);
  const [rejoinSent, setRejoinSent] = useState(false);

  useEffect(() => {
    if (!testId) { setData(null); setRejoinSent(false); setRejoinReason(''); return; }
    setLoading(true);
    fetchTestToAttempt(testId).then(setData).catch((err) => showToast(err.message || 'Could not load your submission.', 'error')).finally(() => setLoading(false));
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestRejoin = async () => {
    setRejoinBusy(true);
    try {
      await requestTestRejoin(testId, rejoinReason);
      setRejoinSent(true);
      showToast('Rejoin request sent to your faculty.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not send your rejoin request.', 'error');
    } finally {
      setRejoinBusy(false);
    }
  };

  if (!testId) return null;

  return (
    <Modal open onClose={onClose} title={data?.test?.title ? `Review — ${data.test.title}` : 'Review'}>
      {loading || !data ? (
        <LoadingSpinner label="Loading…" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">
            Score: {data.submission.score} / {data.test.total_marks}
            {!data.submission.fully_graded && <span className="ml-2 text-xs font-normal text-gold">(theory answers pending grading)</span>}
            {data.submission.submission_reason === 'tab_switch' && <span className="ml-2 text-xs font-normal text-crimson">(auto-submitted — tab switch)</span>}
          </p>

          {/* Rejoin Request (item 9) — only relevant once a submission
              exists, e.g. after an accidental/auto submission the student
              wants to contest. Capped at 3 requests server-side; the 429
              error from requestTestRejoin surfaces as a toast if they've
              already hit that limit. */}
          <div className="rounded-lg border border-line bg-paper p-3">
            {rejoinSent ? (
              <p className="text-xs font-semibold text-teal">✓ Rejoin request sent — your faculty will review it.</p>
            ) : (
              <>
                <p className="mb-2 text-xs font-semibold text-ink">Think this submission was a mistake (auto-submit, dropped connection)?</p>
                <textarea
                  value={rejoinReason}
                  onChange={(e) => setRejoinReason(e.target.value)}
                  placeholder="Briefly explain what happened…"
                  rows={2}
                  className="w-full resize-y rounded-lg border border-line bg-paper-card px-3 py-2 text-xs text-ink outline-none focus:border-hero-primary"
                />
                <button
                  type="button"
                  onClick={handleRequestRejoin}
                  disabled={rejoinBusy || !rejoinReason.trim()}
                  className="mt-2 rounded-lg bg-hero-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {rejoinBusy ? 'Sending…' : 'Request Rejoin'}
                </button>
              </>
            )}
          </div>
          {data.test.questions.map((q, i) => {
            const ans = data.submission.answers.find((a) => a.question_id === q.id);
            return (
              <div key={q.id} className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold text-ink">{i + 1}. {q.text}</p>
                {q.type === 'mcq' ? (
                  <div className="mt-2 space-y-1 text-sm">
                    {q.options.map((opt, oi) => (
                      <p key={oi} className={
                        oi === q.correct_index ? 'font-semibold text-teal' :
                        oi === ans?.selected_index ? 'font-semibold text-crimson' : 'text-ink-light'
                      }>
                        {oi === q.correct_index ? '✓ ' : oi === ans?.selected_index ? '✕ ' : '· '}{opt}
                      </p>
                    ))}
                  </div>
                ) : q.type === 'code' ? (
                  <>
                    <p className="mt-1 text-xs text-ink-light">Language: <span className="font-semibold capitalize">{q.language}</span></p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-paper p-2 font-mono text-xs text-ink">{ans?.code || '(no code submitted)'}</pre>
                    <p className="mt-1 text-xs text-ink-light">
                      {(ans?.results || []).filter((r) => r.passed).length}/{(ans?.results || []).length} test cases passed · {ans?.score ?? 0} / {q.marks} marks
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-paper p-2 text-sm text-ink">{ans?.answer_text || '(no answer)'}</p>
                    <p className="mt-1 text-xs text-ink-light">{ans?.score ?? '—'} / {q.marks} marks</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
