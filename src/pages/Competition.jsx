import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchCompetitionQuizzes,
  createCompetitionQuiz,
  deleteCompetitionQuiz,
  joinCompetitionQuiz,
  startCompetitionQuiz,
  fetchCompetitionQuizSession,
  submitCompetitionQuizAnswer,
  fetchCompetitionQuizParticipants,
  saveCompetitionQuizAsTest,
  fetchSavedClubQuizzes,
  deleteSavedClubQuiz,
  conductSavedClubQuiz,
} from '../services/competitionService';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import QuestionText from '../components/common/QuestionText';
import QuestionEditor from '../components/common/QuestionEditor';

const CAN_CREATE_QUIZ_ROLES = ['college_admin', 'hod', 'faculty'];

// Spec item 3: Competition is now its own main section, entirely separate
// from Clubs — everything quiz-related (create, join, live play, live
// leaderboard, final results) lives here.
export default function Competition() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  // NEW (spec item 3): joining is now two steps — the code, then (once it's
  // been entered) the display name the participant wants shown for this
  // quiz. Both are sent together to the one join endpoint, but the UI asks
  // for the name only after the code step, per spec.
  const [joinStep, setJoinStep] = useState('code');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [liveQuizId, setLiveQuizId] = useState(null);
  const [savedTestsOpen, setSavedTestsOpen] = useState(false);

  const canCreate = CAN_CREATE_QUIZ_ROLES.includes(role);

  const load = () => {
    setLoading(true);
    fetchCompetitionQuizzes()
      .then(setQuizzes)
      .catch((err) => showToast(err.message || 'Could not load quizzes.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving here from Clubs → "Have a code?" → Join a Quiz, already joined.
  useEffect(() => {
    if (location.state?.autoJoinQuizId) setLiveQuizId(location.state.autoJoinQuizId);
  }, [location.state]);

  const handleContinueToName = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinStep('name');
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinDisplayName.trim()) {
      showToast('Enter the name you want displayed for this quiz.', 'error');
      return;
    }
    setJoining(true);
    try {
      const res = await joinCompetitionQuiz(joinCode.trim(), joinDisplayName.trim());
      showToast(`Joined "${res.title}" as ${res.display_name} on behalf of ${res.club_name}.`, 'success');
      setJoinCode('');
      setJoinDisplayName('');
      setJoinStep('code');
      setLiveQuizId(res.quiz_id);
    } catch (err) {
      showToast(err.message || 'That quiz code did not work.', 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('Remove this quiz? This cannot be undone.')) return;
    try {
      await deleteCompetitionQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      showToast('Quiz removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this quiz.', 'error');
    }
  };

  const handleSaveAsTest = async (quizId) => {
    try {
      await saveCompetitionQuizAsTest(quizId);
      showToast('Saved as a reusable test.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save this quiz as a test.', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Competition</h1>
          <p className="text-sm text-ink-light">Live, club-vs-club quizzes — fast-paced and real-time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={() => setSavedTestsOpen(true)}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
            >
              Saved Tests
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-full bg-gradient-to-r from-purple to-hero-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90"
            >
              + New quiz
            </button>
          )}
        </div>
      </div>

      {/* Spec item 3: Step 1 — enter the quiz code. Step 2 (shown only once a
          code has been given) — enter the display name for this quiz. */}
      {joinStep === 'code' ? (
        <form onSubmit={handleContinueToName} className="mb-6 flex gap-2 rounded-2xl border border-dashed border-gold bg-gold/5 p-4">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Have a quiz code? Enter it here…"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm uppercase tracking-wider"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoinByCode} className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-dashed border-gold bg-gold/5 p-4">
          <input
            value={joinDisplayName}
            onChange={(e) => setJoinDisplayName(e.target.value)}
            placeholder="Enter the name you want displayed for this quiz…"
            maxLength={60}
            autoFocus
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => { setJoinStep('code'); setJoinDisplayName(''); }}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={joining || !joinDisplayName.trim()}
            className="rounded-lg bg-gold px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {joining ? 'Joining…' : 'Join quiz'}
          </button>
        </form>
      )}

      {loading ? (
        <LoadingSpinner label="Loading quizzes…" />
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No competition quizzes yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <div key={q.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  q.status === 'lobby'
                    ? 'bg-gold/10 text-gold'
                    : q.status === 'finished'
                    ? 'bg-ink-light/10 text-ink-light'
                    : 'bg-teal/10 text-teal'
                }`}
              >
                {q.status === 'lobby' ? 'Waiting to start' : q.status === 'finished' ? 'Finished' : 'Live'}
              </span>
              <h3 className="mt-2 text-base font-semibold text-ink">{q.title}</h3>
              <p className="mt-1 text-xs text-ink-light">
                {q.question_count} question{q.question_count === 1 ? '' : 's'} · by {q.created_by_name}
              </p>
              {q.can_manage && q.quiz_code && (
                <p className="mt-1 font-mono text-xs font-bold tracking-widest text-hero-primary">Code: {q.quiz_code}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {q.can_manage && (
                  <button
                    type="button"
                    onClick={() => setLiveQuizId(q.id)}
                    className="rounded-full bg-hero-primary px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    Host
                  </button>
                )}
                {q.can_manage && (
                  <button type="button" onClick={() => handleSaveAsTest(q.id)} className="text-xs font-semibold text-hero-primary hover:underline">
                    Save as Test
                  </button>
                )}
                {q.can_manage && (
                  <button type="button" onClick={() => handleDeleteQuiz(q.id)} className="ml-auto text-xs font-semibold text-crimson hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateCompetitionQuizModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(quiz) => setQuizzes((prev) => [{ ...quiz, can_manage: true }, ...prev])}
      />

      <SavedTestsModal
        open={savedTestsOpen}
        onClose={() => setSavedTestsOpen(false)}
        onConducted={(quiz) => { setQuizzes((prev) => [{ ...quiz, can_manage: true }, ...prev]); setSavedTestsOpen(false); setLiveQuizId(quiz.id); }}
      />

      <LiveQuizView quizId={liveQuizId} onClose={() => setLiveQuizId(null)} />
    </div>
  );
}

// NEW (spec item 2): Saved Tests / Saved Quizzes — reusable templates saved
// via "Save as Test", viewable by faculty/HOD/admin, selectable to conduct
// again as a brand-new live quiz without recreating any questions and
// without ever modifying the saved template itself.
function SavedTestsModal({ open, onClose, onConducted }) {
  const { showToast } = useToast();
  const [savedTests, setSavedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conductingId, setConductingId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSavedClubQuizzes()
      .then(setSavedTests)
      .catch((err) => showToast(err.message || 'Could not load saved tests.', 'error'))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this saved test? This cannot be undone.')) return;
    try {
      await deleteSavedClubQuiz(id);
      setSavedTests((prev) => prev.filter((t) => t.id !== id));
      showToast('Saved test removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this saved test.', 'error');
    }
  };

  const handleConduct = async (id) => {
    setConductingId(id);
    try {
      const quiz = await conductSavedClubQuiz(id);
      showToast(`"${quiz.title}" is ready — share its new code to start.`, 'success');
      onConducted(quiz);
    } catch (err) {
      showToast(err.message || 'Could not start this saved test.', 'error');
    } finally {
      setConductingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Saved Tests">
      {loading ? (
        <LoadingSpinner label="Loading saved tests…" />
      ) : savedTests.length === 0 ? (
        <p className="text-sm text-ink-light">No saved tests yet. Use "Save as Test" on any quiz to add one here.</p>
      ) : (
        <ul className="space-y-2">
          {savedTests.map((t) => (
            <li key={t.id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-xs text-ink-light">
                    {t.question_count} question{t.question_count === 1 ? '' : 's'} · by {t.created_by_name}
                    {t.times_conducted > 0 && ` · conducted ${t.times_conducted}x`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={conductingId === t.id}
                    onClick={() => handleConduct(t.id)}
                    className="rounded-full bg-hero-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {conductingId === t.id ? 'Starting…' : 'Conduct'}
                  </button>
                  <button type="button" onClick={() => handleDelete(t.id)} className="text-xs font-semibold text-crimson hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const TIME_LIMIT_OPTIONS = [10, 20, 30, 45, 60];
const EMPTY_QUESTION = () => ({ text: '', options: ['', '', '', ''], correct_index: 0, time_limit_seconds: 30, max_points: 10 });

function CreateCompetitionQuizModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [saveAsTest, setSaveAsTest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateQuestion = (i, patch) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };
  const updateOption = (i, optIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? value : o)) } : q))
    );
  };
  const addQuestion = () => setQuestions((prev) => [...prev, EMPTY_QUESTION()]);
  const removeQuestion = (i) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Quiz name is required.');
      return;
    }
    for (const q of questions) {
      if (!q.text.trim() || q.options.some((o) => !o.trim())) {
        setError('Every question needs text and all options filled in.');
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const { quiz, saved_test } = await createCompetitionQuiz({ title, description, questions, saveAsTest });
      onCreated(quiz);
      showToast(
        saved_test ? 'Quiz created and saved as a reusable test.' : 'Quiz created. Its code is on the quiz card — share it once you start.',
        'success'
      );
      setTitle('');
      setDescription('');
      setQuestions([EMPTY_QUESTION()]);
      setSaveAsTest(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create this quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New competition quiz">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-xs text-ink-light">
          Any eligible student who's already a member of a club can join with the quiz code — only one
          representative per club will be allowed into any single quiz.
        </p>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Quiz name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-ink">Question {i + 1}</p>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(i)} className="text-[11px] font-semibold text-crimson hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <QuestionEditor value={q.text} onChange={(text) => updateQuestion(i, { text })} />
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correct_index === oi}
                      onChange={() => updateQuestion(i, { correct_index: oi })}
                      title="Correct answer"
                    />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, oi, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink">Time limit</label>
                  <select
                    value={q.time_limit_seconds}
                    onChange={(e) => updateQuestion(i, { time_limit_seconds: Number(e.target.value) })}
                    className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
                  >
                    {TIME_LIMIT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink">Max points</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={q.max_points}
                    onChange={(e) => updateQuestion(i, { max_points: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addQuestion} className="text-xs font-semibold text-hero-primary hover:underline">
          + Add another question
        </button>

        {/* NEW (spec item 2): Save as Test, offered right at creation time. */}
        <label className="flex items-center gap-2 text-xs font-semibold text-ink">
          <input type="checkbox" checked={saveAsTest} onChange={(e) => setSaveAsTest(e.target.checked)} />
          Save as Test (add to Saved Tests for reuse later)
        </label>

        {error && <p className="text-xs text-crimson">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create quiz'}
        </button>
      </form>
    </Modal>
  );
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// Fast-paced live quiz — polls the session endpoint roughly every second
// so timers, question transitions, the live leaderboard, and final results
// all stay in sync with the server clock without needing a socket
// connection. Host and every joined club's representative share this one
// component and branch on session.is_host / session.status. Ranked by
// Club Name throughout (spec items 13, 15–17), colourful/energetic styling
// per spec item 14.
function LiveQuizView({ quizId, onClose }) {
  const { showToast } = useToast();
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [answering, setAnswering] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [starting, setStarting] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);
  // Single self-scheduling timeout handle (not setInterval — see the
  // polling effect below for why) for the session poll loop.
  const pollTimeoutRef = useRef(null);
  const tickRef = useRef(null);
  // Tracks the id of the question currently shown live, so a brand-new
  // question can clear the previous question's selected-answer highlight
  // (see handling below) instead of it bleeding into the next question.
  const lastQuestionIdRef = useRef(null);
  // Ranks from the last leaderboard screen shown (by club_id), used so the
  // next leaderboard screen knows where each row "moved from" and can
  // animate the transition. Persists across the whole quiz session.
  const leaderboardRanksRef = useRef({});

  // Root-cause fix for the repeated "Request failed with status code 504"
  // toasts on this screen. This used to be a plain `setInterval(poll,
  // 1200)` that fired on a fixed clock no matter what: if one poll was
  // still in flight (e.g. the server was momentarily slow) the *next*
  // tick fired anyway, piling up overlapping requests for the same quiz
  // from the same client; with every joined participant's browser doing
  // that at once during the "Waiting to start" lobby, plus a SECOND,
  // equally uncontrolled request (fetchCompetitionQuizParticipants) fired
  // on every single tick, it was a request storm that made the backend
  // slower, which made the overlap worse, which is exactly the kind of
  // feedback loop that ends in a wall of 504s and a matching wall of red
  // toasts (one per failed tick, with no de-dup).
  //
  // Fixed by replacing the fixed interval with a single self-scheduling
  // timeout chain:
  //  - Only ONE request for this quiz is ever in flight at a time — the
  //    next poll is scheduled only after the current one finishes (success
  //    OR failure), never on a fixed clock regardless of completion.
  //  - Only ONE timer ever exists for this quiz — pollTimeoutRef always
  //    holds the single pending handle, cleared before every reschedule
  //    and on unmount/quizId change, so effect re-runs (including React
  //    StrictMode's dev double-invoke) can never leave a second chain
  //    running in the background.
  //  - The extra participants call (only relevant in the lobby) now rides
  //    the same cadence instead of firing every tick independently, and
  //    is itself guarded so it can't stack either.
  //  - On failure, the next attempt backs off (1.2s -> up to 6s) instead
  //    of hammering an already-struggling backend, and resets to normal
  //    speed the moment a poll succeeds again.
  //  - Exactly one error toast is shown per failure streak (not one per
  //    failed tick) — ToastContext also de-dupes identical messages as a
  //    second line of defense.
  useEffect(() => {
    leaderboardRanksRef.current = {};
    lastQuestionIdRef.current = null;
    if (!quizId) {
      setSession(null);
      setLastAnswer(null);
      setParticipants([]);
      return;
    }
    let cancelled = false;
    let consecutiveFailures = 0;
    let participantTick = 0;
    const BASE_DELAY_MS = 1200;
    const MAX_DELAY_MS = 6000;

    const scheduleNext = (delay) => {
      if (cancelled) return;
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(poll, delay);
    };

    const poll = () => {
      if (cancelled) return;
      fetchCompetitionQuizSession(quizId)
        .then((s) => {
          if (cancelled) return;
          consecutiveFailures = 0;
          setSession(s);
          setCountdownMs(s.status === 'live' ? s.time_remaining_ms : s.status === 'between' ? s.between_remaining_ms : 0);
          if (s.status === 'live' && s.question) {
            // Only clear the highlight when the question actually changes —
            // it must stay put for the entire duration of the same question,
            // right up until the timer ends and it turns 'between'.
            if (s.question.id !== lastQuestionIdRef.current) {
              lastQuestionIdRef.current = s.question.id;
              setLastAnswer(null);
            }
          } else if (s.status !== 'between') {
            // Lobby or finished — no question is showing, so no stale
            // selection should carry forward.
            lastQuestionIdRef.current = null;
            setLastAnswer(null);
          }
          // Throttled to every 3rd tick (~3.6s) instead of every poll —
          // the participant list doesn't need to be as fresh as the
          // timer/status, and this halves lobby request volume.
          if (s.status === 'lobby' && participantTick % 3 === 0) {
            fetchCompetitionQuizParticipants(quizId).then((p) => !cancelled && setParticipants(p)).catch(() => {});
          }
          participantTick += 1;
          scheduleNext(BASE_DELAY_MS);
        })
        .catch((err) => {
          if (cancelled) return;
          consecutiveFailures += 1;
          // Only the FIRST failure of a streak gets a toast — repeated
          // failures on the following ticks stay silent (still retrying
          // in the background) instead of flooding the screen.
          if (consecutiveFailures === 1) {
            showToast(err.message || 'Lost connection to the quiz. Reconnecting…', 'error');
          }
          const backoff = Math.min(BASE_DELAY_MS * 2 ** (consecutiveFailures - 1), MAX_DELAY_MS);
          scheduleNext(backoff);
        });
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollTimeoutRef.current);
    };
  }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearInterval(tickRef.current);
    if (!session || (session.status !== 'live' && session.status !== 'between')) return;
    tickRef.current = setInterval(() => setCountdownMs((ms) => Math.max(0, ms - 250)), 250);
    return () => clearInterval(tickRef.current);
  }, [session?.status, session?.current_index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quizId) return null;

  const handleAnswer = async (optionIndex) => {
    if (answering || !session?.question) return;
    setAnswering(true);
    try {
      const res = await submitCompetitionQuizAnswer(quizId, optionIndex);
      setLastAnswer({ optionIndex, ...res });
      setSession((s) => (s ? { ...s, answered: true, my_score: res.total_score } : s));
    } catch (err) {
      showToast(err.message || 'Could not submit your answer.', 'error');
    } finally {
      setAnswering(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await startCompetitionQuiz(quizId);
    } catch (err) {
      showToast(err.message || 'Could not start the quiz.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const seconds = Math.ceil(countdownMs / 1000);
  const OPTION_COLORS = ['bg-hero-primary', 'bg-teal', 'bg-gold', 'bg-crimson', 'bg-purple', 'bg-hero-accent'];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-purple/90 via-hero-primary/90 to-teal/90 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">🏆 {session?.title || 'Competition Quiz'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-2 py-1 text-xs text-ink-light hover:bg-paper">
            Close
          </button>
        </div>

        {!session ? (
          <LoadingSpinner label="Connecting…" />
        ) : session.status === 'lobby' ? (
          <div className="text-center">
            <p className="text-sm text-ink-light">
              Waiting to start · {session.total_questions} question{session.total_questions === 1 ? '' : 's'}
            </p>
            {session.joined && session.my_club_name && (
              // spec items 4/5: show the entered display name alongside the club.
              <p className="mt-1 text-xs font-semibold text-teal">
                {session.my_display_name ? `${session.my_club_name} — ${session.my_display_name}` : `Playing on behalf of ${session.my_club_name}`}
              </p>
            )}
            {participants.length > 0 && (
              <div className="mx-auto mt-4 max-w-sm text-left">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-light">Clubs joined</p>
                <ul className="space-y-1">
                  {participants.map((p) => (
                    <li key={p.club_name} className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-1.5 text-sm">
                      {/* spec item 4: Club Name + Participant Entered Name */}
                      <span className="font-semibold text-ink">{p.club_name} — {p.display_name || p.name}</span>
                      {session.is_host && <span className="text-xs text-ink-light">{p.roll_number || ''}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {session.is_host ? (
              <>
                {session.participant_count !== undefined && (
                  <p className="mt-2 text-xs text-ink-light">{session.participant_count} club{session.participant_count === 1 ? '' : 's'} joined so far</p>
                )}
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={starting}
                  className="mt-4 rounded-full bg-gradient-to-r from-purple to-hero-primary px-8 py-3 text-sm font-bold text-white shadow-md disabled:opacity-60"
                >
                  {starting ? 'Starting…' : '▶ Start quiz'}
                </button>
              </>
            ) : (
              <p className="mt-4 text-sm text-ink-light">The host will start the quiz shortly — everyone starts together. Stay on this screen.</p>
            )}
          </div>
        ) : session.status === 'live' && session.question ? (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-ink-light">
              <span>Question {session.current_index + 1} of {session.total_questions}</span>
              <span
                className={`rounded-full px-3 py-1 font-mono text-sm font-bold transition-colors ${
                  seconds <= 5 ? 'animate-pulse bg-crimson text-white' : 'bg-hero-primary/10 text-hero-primary'
                }`}
              >
                {Math.max(0, seconds)}s
              </span>
            </div>
            <QuestionText text={session.question.text} className="mb-4 text-lg font-bold text-ink" />
            {session.is_host ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {session.question.options.map((opt, i) => (
                  <div key={i} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white ${OPTION_COLORS[i % OPTION_COLORS.length]}`}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {session.question.options.map((opt, i) => {
                  const isSelected = lastAnswer?.optionIndex === i;
                  const isLocked = session.answered || !!lastAnswer;
                  const baseColor = OPTION_COLORS[i % OPTION_COLORS.length];
                  // Selected option stays fully lit and clearly ringed for
                  // the whole question — it must never fade or reset before
                  // the timer ends. Every other option dims once a choice
                  // is locked in, so the pick is obvious at a glance on any
                  // screen size.
                  const stateClasses = isSelected
                    ? `${lastAnswer.correct ? 'bg-teal ring-4 ring-teal/50' : 'bg-crimson ring-4 ring-crimson/50'} opacity-100 scale-[1.02]`
                    : isLocked
                    ? `${baseColor} opacity-35 grayscale-[0.25] hover:scale-100`
                    : baseColor;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={session.answered || answering || seconds <= 0}
                      onClick={() => handleAnswer(i)}
                      aria-pressed={isSelected}
                      className={`relative rounded-xl px-4 py-4 text-left text-sm font-bold text-white shadow-sm transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 ${stateClasses}`}
                    >
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs font-black text-ink">
                          ✓
                        </span>
                      )}
                      {String.fromCharCode(65 + i)}. {opt}
                    </button>
                  );
                })}
              </div>
            )}
            {session.answered && !session.is_host && (
              <p className="mt-3 text-sm font-semibold text-ink-light">
                {lastAnswer ? (lastAnswer.correct ? `Correct! +${lastAnswer.points} points for ${session.my_club_name}.` : 'Answer submitted.') : 'Answer locked in — waiting for the timer…'}
              </p>
            )}
          </div>
        ) : session.status === 'between' && session.question_result ? (
          <div>
            <QuestionText text={session.question_result.text} className="mb-1 text-sm font-semibold text-ink" />
            <p className="mb-4 text-xs text-teal">
              Correct answer: {String.fromCharCode(65 + session.question_result.correct_index)}. {session.question_result.options[session.question_result.correct_index]}
            </p>
            <p className="mb-2 text-sm font-bold text-ink">🏆 Live Leaderboard</p>
            <AnimatedLeaderboard
              rows={session.leaderboard.top}
              myClubName={session.my_club_name}
              prevRanksRef={leaderboardRanksRef}
              listClassName="space-y-1.5"
              renderRow={(r, isMine) => (
                <div
                  className={`flex justify-between rounded-xl border px-3 py-2 text-sm ${
                    isMine ? 'border-hero-primary bg-hero-primary/10 ring-2 ring-hero-primary/30' : 'border-line bg-paper'
                  }`}
                >
                  <span className={`font-semibold ${isMine ? 'text-hero-primary' : ''}`}>
                    {/* spec item 5: Participant Display Name + Club Name */}
                    {r.rank}. {r.participant_name ? `${r.participant_name} — ${r.club_name}` : r.club_name}
                    {isMine && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-hero-primary/70">You</span>}
                  </span>
                  <span className="font-bold text-hero-primary">{r.points} pts</span>
                </div>
              )}
            />
            {session.leaderboard.mine && (
              <p className="mt-2 text-xs font-semibold text-ink-light">
                #{session.leaderboard.mine.rank} {session.leaderboard.mine.participant_name ? `${session.leaderboard.mine.participant_name} — ${session.leaderboard.mine.club_name}` : session.leaderboard.mine.club_name} — {session.leaderboard.mine.points} points
              </p>
            )}
            <p className="mt-3 text-center text-xs text-ink-light">Next question in {Math.max(0, Math.ceil(countdownMs / 1000))}s…</p>
          </div>
        ) : session.status === 'finished' ? (
          <div>
            <p className="mb-3 text-center text-base font-bold text-ink">🏆 Final Top 10 Clubs</p>
            <AnimatedLeaderboard
              rows={session.final_leaderboard.top}
              myClubName={session.my_club_name}
              prevRanksRef={leaderboardRanksRef}
              listClassName="space-y-2"
              renderRow={(r, isMine) => {
                const idx = r.rank - 1;
                return (
                  <div
                    className={`flex items-center justify-between rounded-xl border px-4 ${
                      idx < 3
                        ? 'border-gold bg-gradient-to-r from-gold/10 to-transparent py-3 text-base shadow-sm'
                        : 'border-line py-2 text-sm'
                    } ${isMine ? 'ring-2 ring-hero-primary/40' : ''}`}
                  >
                    <span className="font-bold">
                      {idx < 3 ? RANK_MEDALS[idx] : `${r.rank}.`} {r.participant_name ? `${r.participant_name} — ${r.club_name}` : r.club_name}
                      {isMine && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-hero-primary/70">You</span>}
                    </span>
                    <span className="font-bold text-hero-primary">{r.points} points</span>
                  </div>
                );
              }}
            />
            {session.final_leaderboard.mine && (
              <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-2 text-center text-sm font-semibold text-ink-light">
                #{session.final_leaderboard.mine.rank} {session.final_leaderboard.mine.participant_name ? `${session.final_leaderboard.mine.participant_name} — ${session.final_leaderboard.mine.club_name}` : session.final_leaderboard.mine.club_name} — {session.final_leaderboard.mine.points} points
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <LoadingSpinner label="Loading…" />
        )}
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);
  return reduced;
}

// FLIP-style leaderboard animation for the "who moved where" effect between
// questions. Rows are keyed by club_id, so React reuses the same DOM node
// across re-polls of the same screen (no flicker, identity preserved).
//
// On mount, each row is measured at its natural (final, new-rank) position,
// then nudged with a CSS transform back to the vertical spot implied by its
// PREVIOUS rank (read from prevRanksRef, which persists across the whole
// quiz so this works across every question-to-question transition). A
// requestAnimationFrame later, the transform is released back to zero with
// a transition, so the row visibly glides from its old rank to its new one.
// Rows with no previous rank (first time appearing on this leaderboard)
// simply fade in rather than sliding from an unknown position.
//
// The mount-only effect intentionally runs once: later polls of the same
// leaderboard screen carry the same standings and must not re-trigger the
// slide, only the DOM manipulation. `prefers-reduced-motion` skips the
// slide/fade entirely and snaps straight to the resting position.
function AnimatedLeaderboard({ rows, myClubName, prevRanksRef, renderRow, listClassName = '' }) {
  const reduceMotion = usePrefersReducedMotion();
  const rowRefs = useRef(new Map());

  useLayoutEffect(() => {
    const prevRanks = prevRanksRef.current || {};
    const entries = rows.map((r) => ({ row: r, el: rowRefs.current.get(r.club_id) })).filter((e) => e.el);

    if (!reduceMotion && entries.length) {
      const rects = entries.map(({ el }) => el.getBoundingClientRect());
      const rowUnit = rects.length > 1 ? rects[1].top - rects[0].top : (rects[0]?.height || 44) + 6;

      entries.forEach(({ row, el }) => {
        const prevRank = prevRanks[row.club_id];
        const delta = prevRank ? (prevRank - row.rank) * rowUnit : 0;
        el.style.transition = 'none';
        el.style.transform = delta ? `translateY(${delta}px)` : 'translateY(0)';
        el.style.opacity = prevRank ? '1' : '0';
      });

      // Force a layout flush so the browser commits the start position
      // above before the transition is switched on below.
      entries[0].el.getBoundingClientRect();

      requestAnimationFrame(() => {
        entries.forEach(({ el }) => {
          el.style.transition = 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease-out';
          el.style.transform = 'translateY(0)';
          el.style.opacity = '1';
        });
      });
    } else {
      entries.forEach(({ el }) => {
        el.style.transition = 'none';
        el.style.transform = 'none';
        el.style.opacity = '1';
      });
    }

    const nextRanks = {};
    rows.forEach((r) => { nextRanks[r.club_id] = r.rank; });
    prevRanksRef.current = nextRanks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ol className={`relative ${listClassName}`}>
      {rows.map((r) => (
        <li
          key={r.club_id}
          ref={(el) => {
            if (el) rowRefs.current.set(r.club_id, el);
            else rowRefs.current.delete(r.club_id);
          }}
          className="will-change-transform"
        >
          {renderRow(r, !!myClubName && r.club_name === myClubName)}
        </li>
      ))}
    </ol>
  );
}
