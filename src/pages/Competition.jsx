import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchCompetitionQuizzes,
  createCompetitionQuiz,
  deleteCompetitionQuiz,
  joinCompetitionQuiz,
  updateQuizParticipantProfile,
  kickQuizParticipant,
  startCompetitionQuiz,
  fetchCompetitionQuizSession,
  submitCompetitionQuizAnswer,
  fetchCompetitionQuizParticipants,
  saveCompetitionQuizAsTest,
  fetchSavedClubQuizzes,
  fetchSavedClubQuiz,
  updateSavedClubQuiz,
  deleteSavedClubQuiz,
  conductSavedClubQuiz,
} from '../services/competitionService';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import QuestionText from '../components/common/QuestionText';
import QuestionEditor from '../components/common/QuestionEditor';

const CAN_CREATE_QUIZ_ROLES = ['college_admin', 'hod', 'faculty'];

export const PRESET_TEAM_LOGOS = [
  { id: 'lion', emoji: '🦁', name: 'Roaring Lions', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-400' },
  { id: 'rocket', emoji: '🚀', name: 'Cosmic Rockets', gradient: 'from-cyan-500 to-blue-600', ring: 'ring-cyan-400' },
  { id: 'thunder', emoji: '⚡', name: 'Thunderbolts', gradient: 'from-yellow-400 to-amber-500', ring: 'ring-yellow-300' },
  { id: 'eagle', emoji: '🦅', name: 'Sky Eagles', gradient: 'from-blue-600 to-indigo-700', ring: 'ring-blue-400' },
  { id: 'tiger', emoji: '🐯', name: 'Bengal Tigers', gradient: 'from-orange-500 to-red-600', ring: 'ring-orange-400' },
  { id: 'knight', emoji: '🛡️', name: 'Iron Knights', gradient: 'from-slate-600 to-zinc-800', ring: 'ring-slate-400' },
  { id: 'dragon', emoji: '🐉', name: 'Mythic Dragons', gradient: 'from-emerald-500 to-teal-700', ring: 'ring-emerald-400' },
  { id: 'genius', emoji: '🧠', name: 'Brainiacs', gradient: 'from-purple-500 to-fuchsia-600', ring: 'ring-purple-400' },
  { id: 'trophy', emoji: '🏆', name: 'Champions', gradient: 'from-yellow-500 to-amber-600', ring: 'ring-yellow-400' },
  { id: 'sniper', emoji: '🎯', name: 'Bullseye', gradient: 'from-rose-500 to-red-700', ring: 'ring-rose-400' },
  { id: 'cyber', emoji: '💻', name: 'Cyber Hackers', gradient: 'from-emerald-400 to-cyan-600', ring: 'ring-emerald-300' },
  { id: 'wolf', emoji: '🐺', name: 'Night Wolves', gradient: 'from-indigo-600 to-violet-800', ring: 'ring-indigo-400' },
];

export function TeamLogoBadge({ logo, size = 'md', className = '' }) {
  if (!logo) return null;
  const preset = PRESET_TEAM_LOGOS.find((p) => p.id === logo);
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs rounded-lg',
    sm: 'w-7 h-7 text-sm rounded-xl',
    md: 'w-10 h-10 text-xl rounded-2xl',
    lg: 'w-14 h-14 text-3xl rounded-2xl',
    xl: 'w-20 h-20 text-4xl rounded-3xl',
  }[size] || 'w-10 h-10 text-xl rounded-2xl';

  if (preset) {
    return (
      <span
        title={preset.name}
        className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br ${preset.gradient} shadow-md ring-2 ${preset.ring} ${sizeClasses} ${className}`}
      >
        <span className="select-none leading-none">{preset.emoji}</span>
      </span>
    );
  }

  if (typeof logo === 'string' && (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:image/'))) {
    return (
      <img
        src={logo}
        alt="Team logo"
        className={`shrink-0 object-cover ring-2 ring-hero-primary/30 shadow-md ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-purple to-hero-primary text-white shadow-md ring-2 ring-hero-primary/30 ${sizeClasses} ${className}`}
    >
      <span className="select-none leading-none">{logo}</span>
    </span>
  );
}

function TeamLogoPickerModal({ open, onClose, selectedLogo, onSelect }) {
  const [customInput, setCustomInput] = useState('');
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Select Team Logo">
      <div className="space-y-4">
        <p className="text-xs text-ink-light">
          Choose a vibrant team logo badge below, or enter a custom image URL / emoji for your quiz.
        </p>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-light">Preset Badges</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {PRESET_TEAM_LOGOS.map((p) => {
              const isSelected = selectedLogo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onSelect(p.id); onClose(); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all text-center ${
                    isSelected
                      ? 'border-hero-primary bg-hero-primary/10 ring-2 ring-hero-primary shadow-sm scale-105'
                      : 'border-line hover:border-hero-primary/40 hover:bg-paper-card hover:scale-[1.02]'
                  }`}
                >
                  <TeamLogoBadge logo={p.id} size="md" />
                  <span className="text-[11px] font-bold text-ink truncate w-full">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-line">
          <label className="mb-1 block text-xs font-bold text-ink">Custom Image URL or Emoji</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. https://... or 🦅"
              className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-xs"
            />
            <button
              type="button"
              disabled={!customInput.trim()}
              onClick={() => {
                if (customInput.trim()) {
                  onSelect(customInput.trim());
                  onClose();
                }
              }}
              className="rounded-xl bg-hero-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Set Logo
            </button>
          </div>
        </div>

        {selectedLogo && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-ink-light">Current: <span className="font-bold text-ink">{selectedLogo}</span></span>
            <button
              type="button"
              onClick={() => { onSelect(null); onClose(); }}
              className="text-xs font-semibold text-crimson hover:underline"
            >
              Clear Logo
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function fireConfetti() {
  if (typeof window === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '9999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#9c27b0', '#ff5722', '#00e676', '#e91e63'];
  const particles = Array.from({ length: 90 }, () => ({
    x: window.innerWidth * (0.2 + Math.random() * 0.6),
    y: window.innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 22,
    vy: -Math.random() * 18 - 8,
    size: Math.random() * 10 + 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 14,
    alpha: 1,
  }));

  let animationId;
  const startTime = Date.now();

  function frame() {
    const elapsed = Date.now() - startTime;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45;
      p.rotation += p.rotSpeed;
      if (elapsed > 1600) {
        p.alpha -= 0.025;
      }
      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }
    }

    if (alive && elapsed < 3500) {
      animationId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(animationId);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  frame();
}

// Spec item 3: Competition is now its own main section, entirely separate
// from Clubs — everything quiz-related (create, join, live play, live
// leaderboard, final results) lives here.
export default function Competition() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingSavedTest, setEditingSavedTest] = useState(null);
  const [joinCode, setJoinCode] = useState('');
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

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await joinCompetitionQuiz(joinCode.trim());
      showToast(`Joined "${res.title}" successfully!`, 'success');
      setJoinCode('');
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
              onClick={() => { setEditingSavedTest(null); setStudioOpen(true); }}
              className="rounded-full bg-gradient-to-r from-purple to-hero-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-all"
            >
              + New quiz
            </button>
          )}
        </div>
      </div>

      {/* Single-step Quiz Code Join */}
      <form onSubmit={handleJoinByCode} className="mb-6 flex gap-2 rounded-2xl border border-dashed border-teal bg-teal/5 p-4">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ENTER QUIZ CODE (e.g. QZ789)…"
          maxLength={20}
          className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-ink focus:border-teal focus:outline-none"
        />
        <button
          type="submit"
          disabled={joining || !joinCode.trim()}
          className="rounded-xl bg-hero-primary px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          {joining ? 'Joining…' : 'Join Quiz'}
        </button>
      </form>

      {loading ? (
        <LoadingSpinner label="Loading quizzes…" />
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No competition quizzes yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <div key={q.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-2">
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
                {q.logo && <TeamLogoBadge logo={q.logo} size="sm" />}
              </div>
              <div className="mt-3 flex items-start gap-2.5">
                {q.logo && <TeamLogoBadge logo={q.logo} size="md" className="hidden sm:inline-flex" />}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-ink truncate">{q.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-light">
                    {q.question_count} question{q.question_count === 1 ? '' : 's'} · by {q.created_by_name}
                  </p>
                </div>
              </div>
              {q.description && <p className="mt-2 text-xs text-ink-light/80 line-clamp-2">{q.description}</p>}
              {q.can_manage && q.quiz_code && (
                <p className="mt-2 font-mono text-xs font-bold tracking-widest text-hero-primary bg-hero-primary/5 rounded-lg px-2.5 py-1 inline-block">
                  Code: {q.quiz_code}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 pt-2 border-t border-line/60">
                {q.can_manage && (
                  <button
                    type="button"
                    onClick={() => setLiveQuizId(q.id)}
                    className="rounded-full bg-hero-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90"
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

      <FullscreenQuizStudio
        open={studioOpen}
        initialTest={editingSavedTest}
        onClose={() => { setStudioOpen(false); setEditingSavedTest(null); }}
        onCreated={(quiz) => setQuizzes((prev) => [{ ...quiz, can_manage: true }, ...prev])}
        onSaved={(updatedTest) => {
          showToast(`Saved test "${updatedTest.title}" updated.`, 'success');
        }}
      />

      <SavedTestsModal
        open={savedTestsOpen}
        onClose={() => setSavedTestsOpen(false)}
        onConducted={(quiz) => { setQuizzes((prev) => [{ ...quiz, can_manage: true }, ...prev]); setSavedTestsOpen(false); setLiveQuizId(quiz.id); }}
        onEdit={(test) => {
          setEditingSavedTest(test);
          setSavedTestsOpen(false);
          setStudioOpen(true);
        }}
      />

      {liveQuizId && <LiveQuizView quizId={liveQuizId} onClose={() => setLiveQuizId(null)} />}
    </div>
  );
}

// NEW (spec item 2): Saved Tests / Saved Quizzes — reusable templates saved
// via "Save as Test", viewable by faculty/HOD/admin, selectable to conduct
// again as a brand-new live quiz without recreating any questions and
// without ever modifying the saved template itself.
// NEW (spec item 2): Saved Tests / Saved Quizzes — reusable templates saved
// via "Save as Test", viewable by faculty/HOD/admin, selectable to conduct
// again as a brand-new live quiz without recreating any questions and
// without ever modifying the saved template itself.
function SavedTestsModal({ open, onClose, onConducted, onEdit }) {
  const { showToast } = useToast();
  const [savedTests, setSavedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conductingId, setConductingId] = useState(null);
  const [loadingEditId, setLoadingEditId] = useState(null);

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

  const handleEditClick = async (test) => {
    setLoadingEditId(test.id);
    try {
      const fullTest = await fetchSavedClubQuiz(test.id);
      onEdit(fullTest);
    } catch (err) {
      showToast(err.message || 'Could not load test details for editing.', 'error');
    } finally {
      setLoadingEditId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Saved Tests">
      {loading ? (
        <LoadingSpinner label="Loading saved tests…" />
      ) : savedTests.length === 0 ? (
        <p className="text-sm text-ink-light">No saved tests yet. Use "Save as Test" on any quiz to add one here.</p>
      ) : (
        <ul className="space-y-3">
          {savedTests.map((t) => (
            <li key={t.id} className="rounded-2xl border border-line bg-paper-card p-4 shadow-sm hover:border-line-dark transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {t.logo && <TeamLogoBadge logo={t.logo} size="md" />}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{t.title}</p>
                    <p className="text-xs text-ink-light">
                      {t.question_count} question{t.question_count === 1 ? '' : 's'} · by {t.created_by_name}
                      {t.times_conducted > 0 && ` · conducted ${t.times_conducted}x`}
                    </p>
                    {t.description && <p className="mt-1 text-xs text-ink-light/80 line-clamp-1">{t.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={conductingId === t.id}
                    onClick={() => handleConduct(t.id)}
                    className="rounded-full bg-hero-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                  >
                    {conductingId === t.id ? 'Starting…' : 'Conduct'}
                  </button>
                  {t.can_manage !== false && (
                    <button
                      type="button"
                      disabled={loadingEditId === t.id}
                      onClick={() => handleEditClick(t)}
                      className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-card disabled:opacity-60"
                    >
                      {loadingEditId === t.id ? 'Loading…' : '✏️ Edit'}
                    </button>
                  )}
                  {t.can_manage !== false && (
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="text-xs font-semibold text-crimson hover:underline px-1"
                    >
                      Remove
                    </button>
                  )}
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

function FullscreenQuizStudio({ open, initialTest, onClose, onCreated, onSaved }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState(null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saveAsTest, setSaveAsTest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!initialTest;

  useEffect(() => {
    if (!open) return;
    if (initialTest) {
      setTitle(initialTest.title || '');
      setDescription(initialTest.description || '');
      setLogo(initialTest.logo || null);
      if (initialTest.questions && initialTest.questions.length > 0) {
        setQuestions(
          initialTest.questions.map((q) => ({
            text: q.text || '',
            options: Array.isArray(q.options) && q.options.length >= 2 ? [...q.options] : ['', '', '', ''],
            correct_index: q.correct_index ?? 0,
            time_limit_seconds: q.time_limit_seconds || 30,
            max_points: q.max_points || 10,
          }))
        );
      } else {
        setQuestions([EMPTY_QUESTION()]);
      }
    } else {
      setTitle('');
      setDescription('');
      setLogo(null);
      setQuestions([EMPTY_QUESTION()]);
      setSaveAsTest(false);
    }
    setActiveIdx(0);
    setError('');
  }, [open, initialTest]);

  if (!open) return null;

  const currentQ = questions[activeIdx] || questions[0] || EMPTY_QUESTION();

  const updateActiveQ = (patch) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === activeIdx ? { ...q, ...patch } : q)));
  };

  const updateOption = (optIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === activeIdx
          ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? value : o)) }
          : q
      )
    );
  };

  const addQuestion = () => {
    const nextList = [...questions, EMPTY_QUESTION()];
    setQuestions(nextList);
    setActiveIdx(nextList.length - 1);
  };

  const duplicateQuestion = (i) => {
    const target = questions[i];
    const clone = {
      ...target,
      text: `${target.text} (Copy)`,
      options: [...target.options],
    };
    const nextList = [...questions.slice(0, i + 1), clone, ...questions.slice(i + 1)];
    setQuestions(nextList);
    setActiveIdx(i + 1);
    showToast('Question duplicated.', 'success');
  };

  const removeQuestion = (i) => {
    if (questions.length <= 1) return;
    const nextList = questions.filter((_, idx) => idx !== i);
    setQuestions(nextList);
    setActiveIdx((prev) => Math.min(prev, nextList.length - 1));
  };

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.max_points) || 0), 0);
  const totalSeconds = questions.reduce((sum, q) => sum + (Number(q.time_limit_seconds) || 0), 0);

  const handleClose = () => {
    if (title.trim() || questions.some((q) => q.text.trim())) {
      if (!window.confirm('Discard unsaved changes and close Studio?')) return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Quiz paper name is required.');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1}: Please enter the question text.`);
        setActiveIdx(i);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`Question ${i + 1}: Please fill in all 4 options.`);
        setActiveIdx(i);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEditing) {
        const updated = await updateSavedClubQuiz(initialTest.id, {
          title: title.trim(),
          description: description.trim(),
          questions,
          logo,
        });
        showToast(`Saved test "${title}" updated successfully!`, 'success');
        onSaved?.(updated);
        onClose();
      } else {
        const { quiz, saved_test } = await createCompetitionQuiz({
          title: title.trim(),
          description: description.trim(),
          questions,
          saveAsTest,
          logo,
        });
        onCreated(quiz);
        showToast(
          saved_test
            ? 'Quiz created and saved as a reusable test!'
            : 'Quiz created! Share its code to start.',
          'success'
        );
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Could not save this quiz paper.');
    } finally {
      setSubmitting(false);
    }
  };

  const OPTION_CARD_THEMES = [
    { bg: 'bg-[#e21b3c]/10 border-[#e21b3c]/40 text-[#e21b3c]', badge: 'bg-[#e21b3c] text-white', icon: '▲', label: 'Option A' },
    { bg: 'bg-[#1368ce]/10 border-[#1368ce]/40 text-[#1368ce]', badge: 'bg-[#1368ce] text-white', icon: '◆', label: 'Option B' },
    { bg: 'bg-[#d89e00]/10 border-[#d89e00]/40 text-[#d89e00]', badge: 'bg-[#d89e00] text-white', icon: '●', label: 'Option C' },
    { bg: 'bg-[#26890c]/10 border-[#26890c]/40 text-[#26890c]', badge: 'bg-[#26890c] text-white', icon: '■', label: 'Option D' },
  ];

  return (
    <div className="fixed inset-0 z-[250] flex flex-col bg-paper text-ink overflow-hidden animate-fadeIn select-none">
      {/* Studio Header */}
      <header className="h-16 px-4 sm:px-6 border-b border-line bg-paper-card flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper-card transition-all"
          >
            ← Exit Studio
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base text-ink">Quiz Paper Studio</span>
            <span className="rounded-full bg-hero-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-hero-primary">
              {isEditing ? '✏️ Editing Saved Quiz' : '✨ New Competition Quiz'}
            </span>
          </div>
        </div>

        {/* Center: Title & Logo */}
        <div className="flex items-center gap-2 flex-1 max-w-xl mx-2">
          <button
            type="button"
            onClick={() => setLogoPickerOpen(true)}
            title="Choose team logo"
            className="flex items-center gap-1.5 rounded-2xl border border-line bg-paper p-1 hover:border-hero-primary/50 transition-all group shrink-0"
          >
            {logo ? (
              <TeamLogoBadge logo={logo} size="sm" />
            ) : (
              <span className="w-7 h-7 rounded-xl bg-hero-primary/10 flex items-center justify-center text-xs text-hero-primary font-bold">
                🛡️
              </span>
            )}
            <span className="text-[11px] font-semibold text-ink-light px-1 hidden md:inline">
              {logo ? 'Change' : 'Add Logo'}
            </span>
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter Quiz Paper Title…"
            className="w-full rounded-xl border border-line bg-paper px-3 py-1.5 text-sm font-bold text-ink placeholder:text-ink-light/50 focus:border-hero-primary focus:outline-none focus:ring-1 focus:ring-hero-primary/30"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-xs font-semibold text-ink-light">
            <span>{questions.length} Qs</span>
            <span>·</span>
            <span>{totalPoints} Pts</span>
            <span>·</span>
            <span>~{totalSeconds}s</span>
          </div>

          {!isEditing && (
            <label className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsTest}
                onChange={(e) => setSaveAsTest(e.target.checked)}
                className="rounded text-hero-primary"
              />
              <span>Save as Test</span>
            </label>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-full bg-gradient-to-r from-purple to-hero-primary px-5 py-2 text-xs sm:text-sm font-extrabold text-white shadow-md hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {submitting ? 'Saving…' : isEditing ? '💾 Save Changes' : '🚀 Launch Quiz'}
          </button>
        </div>
      </header>

      {/* Studio Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Navigator Rail */}
        <aside className="w-full md:w-72 lg:w-80 border-r border-line bg-paper-card/70 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-line flex items-center justify-between bg-paper-card">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-light">
              Questions ({questions.length})
            </span>
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-full bg-hero-primary/10 px-2.5 py-1 text-xs font-bold text-hero-primary hover:bg-hero-primary/20 transition-all"
            >
              + Add
            </button>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questions.map((q, idx) => {
              const isActive = idx === activeIdx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={`group relative rounded-2xl border p-3 cursor-pointer transition-all ${
                    isActive
                      ? 'border-hero-primary bg-hero-primary/10 ring-2 ring-hero-primary shadow-sm'
                      : 'border-line bg-paper hover:border-hero-primary/30 hover:bg-paper-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-ink">Q{idx + 1}</span>
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-light font-semibold">
                      <span>⏱ {q.time_limit_seconds}s</span>
                      <span>·</span>
                      <span>⭐ {q.max_points}pt</span>
                    </div>
                  </div>
                  <p className="text-xs text-ink/80 truncate">
                    {q.text.trim() || <span className="italic text-ink-light">Empty question text…</span>}
                  </p>

                  {/* Actions on hover */}
                  <div className="mt-2 flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); duplicateQuestion(idx); }}
                      title="Duplicate Question"
                      className="text-[11px] font-semibold text-hero-primary hover:underline"
                    >
                      Copy
                    </button>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
                        title="Delete Question"
                        className="text-[11px] font-semibold text-crimson hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Question Footer */}
          <div className="p-3 border-t border-line bg-paper-card">
            <button
              type="button"
              onClick={addQuestion}
              className="w-full rounded-2xl border-2 border-dashed border-hero-primary/40 bg-hero-primary/5 py-2.5 text-xs font-bold text-hero-primary hover:bg-hero-primary/10 transition-all flex items-center justify-center gap-1.5"
            >
              <span>+ Add New Question</span>
            </button>
          </div>
        </aside>

        {/* Center Stage: Active Question Editor */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-8 bg-paper">
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {error && (
              <div className="rounded-2xl border border-crimson/30 bg-crimson/10 p-3 text-xs font-bold text-crimson">
                ⚠️ {error}
              </div>
            )}

            {/* Question Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-hero-primary text-sm font-black text-white shadow-sm">
                  {activeIdx + 1}
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-ink">
                    Question {activeIdx + 1} of {questions.length}
                  </h2>
                  <p className="text-xs text-ink-light">Type your question prompt or code snippet below.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Time Limit Pills */}
                <div className="flex items-center gap-1 bg-paper-card p-1 rounded-2xl border border-line">
                  <span className="text-[11px] font-bold text-ink-light px-2">⏱ Time:</span>
                  {TIME_LIMIT_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateActiveQ({ time_limit_seconds: sec })}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                        currentQ.time_limit_seconds === sec
                          ? 'bg-hero-primary text-white shadow-sm'
                          : 'text-ink-light hover:text-ink'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                {/* Max Points */}
                <div className="flex items-center gap-1 bg-paper-card p-1 rounded-2xl border border-line">
                  <span className="text-[11px] font-bold text-ink-light px-2">⭐ Points:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={currentQ.max_points}
                    onChange={(e) => updateActiveQ({ max_points: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-14 rounded-xl border border-line bg-paper px-2 py-1 text-xs font-extrabold text-ink text-center"
                  />
                </div>
              </div>
            </div>

            {/* Question Text Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-ink-light">
                Question Prompt / Code / Equation
              </label>
              <QuestionEditor
                value={currentQ.text}
                onChange={(text) => updateActiveQ({ text })}
                className="min-h-[140px] text-base"
              />
            </div>

            {/* Kahoot-style Colorful Options */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-ink-light">
                Answer Options (Select the radio button for the correct answer)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, optIdx) => {
                  const theme = OPTION_CARD_THEMES[optIdx % OPTION_CARD_THEMES.length];
                  const isCorrect = currentQ.correct_index === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`rounded-2xl border-2 p-3 transition-all ${
                        isCorrect
                          ? 'border-teal bg-teal/10 shadow-md ring-2 ring-teal/30'
                          : `${theme.border} bg-paper hover:bg-paper-card`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black shadow-xs ${theme.badge}`}>
                            {theme.icon}
                          </span>
                          <span className="text-xs font-extrabold text-ink">{theme.label}</span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-teal cursor-pointer">
                          <input
                            type="radio"
                            name={`correct-answer-${activeIdx}`}
                            checked={isCorrect}
                            onChange={() => updateActiveQ({ correct_index: optIdx })}
                            className="h-4 w-4 text-teal focus:ring-teal"
                          />
                          <span>{isCorrect ? '✓ Correct Answer' : 'Mark Correct'}</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(optIdx, e.target.value)}
                        placeholder={`Enter ${theme.label} content…`}
                        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-bold text-ink placeholder:text-ink-light/50 focus:border-hero-primary focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description toggle */}
            <div className="pt-2">
              <details className="rounded-2xl border border-line bg-paper-card p-3">
                <summary className="text-xs font-bold text-ink-light cursor-pointer hover:text-ink">
                  ⚙️ Quiz Description & Notes (Optional)
                </summary>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description or instructions for participants…"
                  className="mt-2 w-full rounded-xl border border-line bg-paper p-2.5 text-xs text-ink placeholder:text-ink-light/50 focus:border-hero-primary focus:outline-none"
                />
              </details>
            </div>

            {/* Bottom Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
                className="rounded-full border border-line bg-paper px-4 py-2 text-xs font-bold text-ink hover:bg-paper-card disabled:opacity-40"
              >
                ← Previous Question
              </button>

              {activeIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveIdx((prev) => prev + 1)}
                  className="rounded-full bg-hero-primary px-5 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  Next Question →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="rounded-full bg-gradient-to-r from-purple to-hero-primary px-5 py-2 text-xs font-bold text-white hover:opacity-90"
                >
                  + Add Next Question
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      <TeamLogoPickerModal
        open={logoPickerOpen}
        onClose={() => setLogoPickerOpen(false)}
        selectedLogo={logo}
        onSelect={(newLogo) => setLogo(newLogo)}
      />
    </div>
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
  const [optimisticSelection, setOptimisticSelection] = useState(null);
  const [myLogoPickerOpen, setMyLogoPickerOpen] = useState(false);
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

  useEffect(() => {
    leaderboardRanksRef.current = {};
    lastQuestionIdRef.current = null;
    if (!quizId) {
      setSession(null);
      setLastAnswer(null);
      setOptimisticSelection(null);
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
            if (s.question.id !== lastQuestionIdRef.current) {
              lastQuestionIdRef.current = s.question.id;
              setLastAnswer(null);
              setOptimisticSelection(null);
            }
          } else if (s.status !== 'between') {
            lastQuestionIdRef.current = null;
            setLastAnswer(null);
            setOptimisticSelection(null);
          }
          if (s.status === 'lobby' && participantTick % 3 === 0) {
            fetchCompetitionQuizParticipants(quizId).then((p) => !cancelled && setParticipants(p)).catch(() => {});
          }
          participantTick += 1;
          scheduleNext(BASE_DELAY_MS);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.status === 403) {
            showToast(err.message || 'You have been removed from this quiz by the host.', 'error');
            onClose();
            return;
          }
          consecutiveFailures += 1;
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

  const confettiFiredRef = useRef({ between: null, finished: false });

  useEffect(() => {
    if (session?.status === 'between' && lastAnswer?.correct && confettiFiredRef.current.between !== session?.current_index) {
      confettiFiredRef.current.between = session?.current_index;
      fireConfetti();
    }
    if (session?.status === 'finished' && !confettiFiredRef.current.finished) {
      confettiFiredRef.current.finished = true;
      fireConfetti();
    }
  }, [session?.status, session?.current_index, lastAnswer?.correct]);

  if (!quizId) return null;

  const handleAnswer = async (optionIndex) => {
    if (answering || session?.answered || optimisticSelection !== null || !session?.question) return;
    setOptimisticSelection(optionIndex); // 0ms Instant visual selection!
    setAnswering(true);
    try {
      const res = await submitCompetitionQuizAnswer(quizId, optionIndex);
      setLastAnswer({ optionIndex, ...res });
      setSession((s) => (s ? { ...s, answered: true, my_score: res.total_score } : s));
    } catch (err) {
      setOptimisticSelection(null);
      showToast(err.message || 'Could not submit your answer.', 'error');
    } finally {
      setAnswering(false);
    }
  };

  const handleUpdateProfile = async (updates) => {
    try {
      await updateQuizParticipantProfile(quizId, updates);
      setSession((s) => (s ? {
        ...s,
        my_club_name: updates.club_name !== undefined ? updates.club_name : s.my_club_name,
        my_display_name: updates.display_name !== undefined ? updates.display_name : s.my_display_name,
        my_logo: updates.logo !== undefined ? updates.logo : s.my_logo
      } : s));
      showToast('Team profile updated!', 'success');
      // Refresh participants
      fetchCompetitionQuizParticipants(quizId).then(setParticipants).catch(() => {});
    } catch (err) {
      showToast(err.message || 'Could not update profile.', 'error');
    }
  };

  const handleKick = async (username, name) => {
    if (!window.confirm(`Kick ${name} from this quiz lobby?`)) return;
    try {
      await kickQuizParticipant(quizId, username);
      showToast(`Removed ${name} from the quiz.`, 'info');
      setParticipants((prev) => prev.filter((p) => p.username !== username));
    } catch (err) {
      showToast(err.message || 'Could not kick participant.', 'error');
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
  const OPTION_THEMES = [
    { bg: 'bg-[#e21b3c]', hover: 'hover:bg-[#ff2a4b]', border: 'border-[#ff4d6d]', shadow: 'shadow-[#e21b3c]/40', icon: '▲' },
    { bg: 'bg-[#1368ce]', hover: 'hover:bg-[#207bf0]', border: 'border-[#4596fa]', shadow: 'shadow-[#1368ce]/40', icon: '◆' },
    { bg: 'bg-[#d89e00]', hover: 'hover:bg-[#f5b300]', border: 'border-[#ffc72c]', shadow: 'shadow-[#d89e00]/40', icon: '●' },
    { bg: 'bg-[#26890c]', hover: 'hover:bg-[#32ad10]', border: 'border-[#42d120]', shadow: 'shadow-[#26890c]/40', icon: '■' },
    { bg: 'bg-[#8e24aa]', hover: 'hover:bg-[#ab47bc]', border: 'border-[#ce93d8]', shadow: 'shadow-[#8e24aa]/40', icon: '★' },
    { bg: 'bg-[#e65100]', hover: 'hover:bg-[#f57c00]', border: 'border-[#ffb74d]', shadow: 'shadow-[#e65100]/40', icon: '⬟' },
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-[#090d16] text-white flex flex-col overflow-hidden select-none animate-fadeIn">
      {/* Top Animated Countdown Bar (depletes smoothly across full screen width) */}
      {session?.status === 'live' && session?.question && (
        <div className="h-2 w-full bg-white/10 relative overflow-hidden shrink-0">
          <div
            className={`h-full transition-all duration-200 ${
              seconds <= 5
                ? 'bg-crimson shadow-[0_0_12px_#ff4d6d]'
                : seconds <= 10
                ? 'bg-gold shadow-[0_0_12px_#ffc72c]'
                : 'bg-gradient-to-r from-teal via-hero-primary to-purple shadow-[0_0_12px_#1368ce]'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (countdownMs / ((session.question.time_limit_seconds || 30) * 1000)) * 100))}%`,
            }}
          />
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-8 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          {session?.logo && <TeamLogoBadge logo={session.logo} size="md" />}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[200px] sm:max-w-md">
              {session?.title || 'Competition Quiz'}
            </h2>
            {session?.my_club_name && (
              <p className="text-[11px] font-bold text-teal truncate">
                {session.my_display_name ? `${session.my_display_name} (${session.my_club_name})` : session.my_club_name}
              </p>
            )}
          </div>
        </div>

        {/* Center Progress & Pulsing Timer */}
        {session?.status === 'live' && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold tracking-wide text-white/80">
              Q {session.current_index + 1} / {session.total_questions}
            </span>
            <div
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono text-base font-extrabold tracking-wider transition-all duration-300 ${
                seconds <= 5
                  ? 'animate-bounce bg-crimson text-white shadow-lg shadow-crimson/50'
                  : 'bg-white/10 text-white shadow-inner'
              }`}
            >
              <span>⏱</span>
              <span>{Math.max(0, seconds)}s</span>
            </div>
          </div>
        )}

        {/* Right Stats & Exit */}
        <div className="flex items-center gap-3 shrink-0">
          {!session?.is_host && session?.my_score !== null && session?.my_score !== undefined && (
            <div className="rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-gold/40 px-3.5 py-1 text-xs font-black text-gold">
              ⭐ {session.my_score} pts
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (session?.status === 'live' && !session.answered && !session.is_host) {
                if (!window.confirm('Leave active quiz? Your current question score will be lost.')) return;
              }
              onClose();
            }}
            className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20 hover:text-white transition-all"
          >
            Exit ✕
          </button>
        </div>
      </header>

      {/* Main Full-Screen Arena Content */}
      <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-8">
        {!session ? (
          <div className="my-auto text-center">
            <LoadingSpinner label="Connecting to quiz arena…" />
          </div>
        ) : session.status === 'lobby' ? (
          /* Lobby Stage */
          <div className="my-auto max-w-xl mx-auto w-full text-center space-y-6 animate-fadeIn">
            {session.logo && (
              <div className="flex justify-center">
                <TeamLogoBadge logo={session.logo} size="xl" className="shadow-2xl ring-4" />
              </div>
            )}
            <div>
              <span className="rounded-full bg-gold/20 text-gold border border-gold/40 px-4 py-1 text-xs font-extrabold tracking-wider uppercase">
                Quiz Lobby · Waiting to Start
              </span>
              <h1 className="mt-3 text-2xl sm:text-4xl font-black text-white">{session.title}</h1>
              <p className="mt-1 text-sm text-white/70">
                {session.total_questions} Questions · Fast-paced club vs club competition
              </p>
            </div>

            {session.is_host && session.quiz_code && (
              <div className="rounded-3xl border-2 border-dashed border-hero-primary/50 bg-hero-primary/10 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-hero-primary/90">Share Quiz Code</p>
                <p className="mt-1 font-mono text-4xl sm:text-5xl font-black tracking-widest text-white">{session.quiz_code}</p>
                <p className="mt-1 text-xs text-white/60">Participants enter this code to join</p>
              </div>
            )}

            {!session.is_host && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-3">
                  {session.my_logo && <TeamLogoBadge logo={session.my_logo} size="md" />}
                  <span className="text-base font-black text-white">{session.my_club_name || 'My Team'}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newName = window.prompt('Enter new Team / Display Name:', session.my_club_name || '');
                      if (newName && newName.trim()) {
                        handleUpdateProfile({ club_name: newName.trim() });
                      }
                    }}
                    className="rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white transition border border-white/10"
                  >
                    ✏️ Edit Team Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyLogoPickerOpen(true)}
                    className="rounded-full bg-teal/20 hover:bg-teal/30 text-teal border border-teal/40 px-3.5 py-1.5 text-xs font-bold transition"
                  >
                    🎨 Choose Team Logo
                  </button>
                </div>
              </div>
            )}

            {participants.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-xs font-extrabold uppercase tracking-wider text-white/60 mb-2">
                  Participants & Teams Joined ({participants.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {participants.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs border border-white/5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.logo && <TeamLogoBadge logo={p.logo} size="sm" />}
                        <span className="font-bold text-white truncate">{p.club_name} — {p.display_name || p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {session.is_host && <span className="text-[10px] text-white/50">{p.roll_number || ''}</span>}
                        {session.is_host && (
                          <button
                            type="button"
                            onClick={() => handleKick(p.username, p.display_name || p.name)}
                            className="rounded px-2 py-0.5 text-[10px] font-bold text-crimson bg-crimson/10 hover:bg-crimson/20 border border-crimson/30 transition"
                            title="Kick participant"
                          >
                            🚫 Kick
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {session.is_host ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={starting}
                className="w-full rounded-2xl bg-gradient-to-r from-purple via-hero-primary to-teal py-4 text-base font-black text-white shadow-xl hover:opacity-95 disabled:opacity-60 transition-all transform hover:scale-[1.02] active:scale-95"
              >
                {starting ? 'Starting Arena…' : '▶ START COMPETITION NOW'}
              </button>
            ) : (
              <div className="rounded-2xl border border-teal/30 bg-teal/10 p-4 text-center">
                <p className="text-sm font-bold text-teal">You're in! Stay on this screen.</p>
                <p className="text-xs text-white/60 mt-1">The host will launch the quiz shortly and everyone starts together.</p>
              </div>
            )}
          </div>
        ) : session.status === 'live' && session.question ? (
          /* Live Question & Options Arena (Full Screen 2x2 Grid) */
          <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full gap-4 sm:gap-6 my-auto animate-fadeIn">
            {/* Question Box */}
            <div className="w-full rounded-3xl bg-white/[0.07] border border-white/15 backdrop-blur-xl p-6 sm:p-10 shadow-2xl text-center my-auto transition-all">
              <QuestionText
                text={session.question.text}
                className="text-xl sm:text-3xl lg:text-4xl font-black text-white leading-relaxed tracking-wide"
              />
            </div>

            {/* Options Arena: 2x2 Massive Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 w-full my-auto">
              {session.question.options.map((opt, i) => {
                const isSelected = lastAnswer?.optionIndex === i || optimisticSelection === i;
                const isLocked = session.answered || !!lastAnswer || optimisticSelection !== null;
                const theme = OPTION_THEMES[i % OPTION_THEMES.length];

                if (session.is_host) {
                  return (
                    <div
                      key={i}
                      className={`relative rounded-3xl ${theme.bg} min-h-[80px] sm:min-h-[120px] p-5 sm:p-6 flex items-center gap-4 sm:gap-6 text-left shadow-xl border-2 ${theme.border}`}
                    >
                      <span className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-xl sm:text-3xl font-black text-white shadow-inner">
                        {theme.icon}
                      </span>
                      <span className="flex-1 font-extrabold text-base sm:text-2xl text-white leading-tight">
                        {opt}
                      </span>
                    </div>
                  );
                }

                const stateClasses = isSelected
                  ? 'ring-4 ring-white shadow-2xl scale-[1.03] brightness-110 z-10'
                  : isLocked
                  ? 'opacity-25 grayscale-[0.35]'
                  : `${theme.hover} hover:scale-[1.02] active:scale-95 cursor-pointer`;

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={session.answered || answering || seconds <= 0 || isLocked}
                    onClick={() => {
                      if (window.navigator?.vibrate) window.navigator.vibrate(40);
                      handleAnswer(i);
                    }}
                    className={`relative rounded-3xl ${theme.bg} min-h-[90px] sm:min-h-[135px] p-5 sm:p-7 flex items-center gap-4 sm:gap-6 text-left shadow-xl border-2 ${theme.border} transition-all duration-300 ${stateClasses}`}
                  >
                    <span className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-black/25 text-xl sm:text-3xl font-black text-white shadow-inner">
                      {theme.icon}
                    </span>
                    <span className="flex-1 font-extrabold text-base sm:text-2xl text-white leading-tight">
                      {opt}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-ink shadow-md animate-pulse shrink-0">
                        ✓ LOCKED IN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {session.answered && !session.is_host && (
              <p className="text-center text-sm font-extrabold text-teal animate-pulse">
                {lastAnswer
                  ? lastAnswer.correct
                    ? `🎉 Correct! +${lastAnswer.points} points scored!`
                    : 'Answer submitted! Waiting for question timer…'
                  : 'Answer submitted! Waiting for question timer…'}
              </p>
            )}
          </div>
        ) : session.status === 'between' && session.question_result ? (
          /* Between Questions Stage: Answer Reveal & Live Leaderboard */
          <div className="my-auto max-w-2xl mx-auto w-full space-y-5 animate-fadeIn">
            {/* Feedback Banner */}
            {!session.is_host && lastAnswer && (
              <div
                className={`rounded-3xl p-5 text-center shadow-xl border-2 ${
                  lastAnswer.correct
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-teal text-teal'
                    : 'bg-gradient-to-r from-rose-500/20 to-red-500/20 border-crimson text-crimson'
                }`}
              >
                <p className="text-xl sm:text-2xl font-black">
                  {lastAnswer.correct ? `🎉 AWESOME! +${lastAnswer.points} POINTS` : '❌ NOT QUITE!'}
                </p>
                <p className="text-xs text-white/80 mt-1">
                  {lastAnswer.correct ? 'Fast and accurate — great job!' : 'Better luck on the next question!'}
                </p>
              </div>
            )}

            {/* Correct Answer Box */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-teal">Correct Answer Revealed</p>
              <p className="mt-1 text-base sm:text-lg font-black text-white">
                {String.fromCharCode(65 + session.question_result.correct_index)}.{' '}
                {session.question_result.options[session.question_result.correct_index]}
              </p>
            </div>

            {/* Live Standings */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-black uppercase tracking-wider text-white">🏆 Live Standings</span>
                <span className="text-xs font-extrabold text-gold animate-pulse">
                  Next question in {Math.max(0, Math.ceil(countdownMs / 1000))}s…
                </span>
              </div>
              <AnimatedLeaderboard
                rows={session.leaderboard.top}
                myClubName={session.my_club_name}
                prevRanksRef={leaderboardRanksRef}
                listClassName="space-y-2"
                renderRow={(r, isMine) => (
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-all ${
                      isMine
                        ? 'border-hero-primary bg-hero-primary/20 ring-2 ring-hero-primary shadow-md'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <span className="font-bold flex items-center gap-2">
                      <span className="font-black text-white/70 w-6">#{r.rank}</span>
                      <span className={isMine ? 'text-hero-primary' : 'text-white'}>
                        {r.participant_name ? `${r.participant_name} — ${r.club_name}` : r.club_name}
                      </span>
                      {isMine && (
                        <span className="rounded-full bg-hero-primary px-2 py-0.5 text-[10px] font-black text-white uppercase">
                          You
                        </span>
                      )}
                    </span>
                    <span className="font-black text-hero-primary">{r.points} pts</span>
                  </div>
                )}
              />
            </div>
          </div>
        ) : session.status === 'finished' ? (
          /* Finished Stage: Podium & Final Results */
          <div className="my-auto max-w-3xl mx-auto w-full space-y-6 text-center animate-fadeIn py-6">
            <div>
              <span className="text-3xl sm:text-5xl">🏆</span>
              <h1 className="mt-2 text-2xl sm:text-4xl font-black text-white">Competition Finished!</h1>
              <p className="mt-1 text-sm text-white/70">Top performing clubs in {session.title}</p>
            </div>

            {/* 3-Tier Podium */}
            {session.final_leaderboard?.top && session.final_leaderboard.top.length >= 2 && (
              <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
                {/* 2nd Place */}
                {session.final_leaderboard.top[1] && (
                  <div className="flex flex-col items-center w-28 sm:w-36 animate-slideUp">
                    <span className="text-2xl sm:text-3xl">🥈</span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-white truncate w-full">
                      {session.final_leaderboard.top[1].club_name}
                    </p>
                    <p className="text-[11px] font-extrabold text-silver text-white/70">
                      {session.final_leaderboard.top[1].points} pts
                    </p>
                    <div className="mt-2 h-20 sm:h-28 w-full rounded-t-2xl bg-gradient-to-t from-slate-700 to-slate-500 flex items-center justify-center font-black text-2xl text-white shadow-xl">
                      2
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {session.final_leaderboard.top[0] && (
                  <div className="flex flex-col items-center w-32 sm:w-44 animate-slideUp">
                    <span className="text-4xl sm:text-5xl">👑</span>
                    <p className="mt-1 text-sm sm:text-base font-black text-gold truncate w-full">
                      {session.final_leaderboard.top[0].club_name}
                    </p>
                    <p className="text-xs font-black text-gold">
                      {session.final_leaderboard.top[0].points} pts
                    </p>
                    <div className="mt-2 h-28 sm:h-40 w-full rounded-t-2xl bg-gradient-to-t from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center font-black text-3xl text-ink shadow-2xl ring-2 ring-yellow-300">
                      1
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {session.final_leaderboard.top[2] && (
                  <div className="flex flex-col items-center w-28 sm:w-36 animate-slideUp">
                    <span className="text-2xl sm:text-3xl">🥉</span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-white truncate w-full">
                      {session.final_leaderboard.top[2].club_name}
                    </p>
                    <p className="text-[11px] font-extrabold text-white/70">
                      {session.final_leaderboard.top[2].points} pts
                    </p>
                    <div className="mt-2 h-16 sm:h-20 w-full rounded-t-2xl bg-gradient-to-t from-amber-900 to-amber-700 flex items-center justify-center font-black text-xl text-white shadow-xl">
                      3
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full Final Rankings Table */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left max-h-60 overflow-y-auto space-y-1.5">
              {session.final_leaderboard?.top?.map((r, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs sm:text-sm ${
                    idx < 3 ? 'bg-white/10 font-black' : 'bg-white/5 font-semibold text-white/80'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-white/60">#{idx + 1}</span>
                    <span>{r.participant_name ? `${r.participant_name} — ${r.club_name}` : r.club_name}</span>
                  </span>
                  <span className="font-extrabold text-gold">{r.points} pts</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-hero-primary px-8 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all"
            >
              Done & Exit Arena
            </button>
          </div>
        ) : (
          <div className="my-auto text-center">
            <LoadingSpinner label="Loading quiz arena…" />
          </div>
        )}
      </div>

      <TeamLogoPickerModal
        open={myLogoPickerOpen}
        onClose={() => setMyLogoPickerOpen(false)}
        selectedLogo={session?.my_logo}
        onSelect={(logo) => handleUpdateProfile({ logo })}
      />
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
