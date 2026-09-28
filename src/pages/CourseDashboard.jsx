import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchCourseDashboard, downloadUpdatedCourseAnswers, COURSE_LANGUAGES } from '../services/coursesService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CircularProgress from '../components/pythonCourse/CircularProgress';

// Generalized version of pages/PythonCourse.jsx — same layout/behavior,
// parameterized by :language instead of being Python-only. /python-course
// itself is untouched and keeps working exactly as before.
export default function CourseDashboard() {
  const { language } = useParams();
  const { showToast } = useToast();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCourseDashboard(language)
      .then(setData)
      .catch((err) => showToast(err.message || 'Could not load the course.', 'error'))
      .finally(() => setLoading(false));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFaculty = role === 'faculty';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadUpdatedCourseAnswers(language);
    } catch (err) {
      showToast(err.message || 'Could not download the course answers.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage label="Loading course…" />;
  if (!data) return null;

  const meta = COURSE_LANGUAGES.find((l) => l.value === language);
  const continueLesson = findLessonMeta(data.modules, data.continue_lesson_id);

  return (
    <div>
      <Link to="/courses" className="text-xs font-semibold text-teal hover:underline">← Courses</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta?.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-ink">{data.course.title}</h1>
            <p className="text-sm text-ink-light">Beginner → Advanced · {data.course.total_modules} modules · {data.course.total_lessons} lessons</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* "Updated Course Answers" — Faculty-only. Generated live from
              whatever test content actually exists for this course right
              now (never a stale file). Students never see this option —
              not a disabled button, not shown at all. */}
          {isFaculty && (
            <button type="button" onClick={handleDownload} disabled={downloading} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-60">
              {downloading ? 'Preparing…' : '⬇ Updated Course Answers'}
            </button>
          )}
          {isFaculty && (
            <Link to={`/courses/${language}/students`} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-paper">Assigned Students →</Link>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 rounded-xl border border-line bg-paper-card p-6 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-2">
          <CircularProgress percentage={data.overall_percentage} label="Completed" />
          <p className="text-sm font-semibold text-ink">{data.completed_lessons} / {data.total_lessons} Lessons</p>
        </div>

        <div className="lg:col-span-2">
          {data.completed_at ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-teal/10 p-6 text-center">
              <span className="text-3xl">🎉</span>
              <p className="text-lg font-bold text-ink">Course Passed</p>
            </div>
          ) : continueLesson ? (
            <div className="flex h-full flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">Continue Learning</p>
              <p className="mt-1 text-lg font-bold text-ink">{continueLesson.title}</p>
              <p className="text-xs text-ink-light">{continueLesson.moduleTitle}</p>
              <Link
                to={`/courses/${language}/lessons/${continueLesson.id}`}
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Continue Learning →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-light">No lessons available yet.</p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Tests Completed" value={data.stats.tests_completed} />
            <StatBox label="Avg Score" value={`${data.stats.average_score}%`} />
            <StatBox label="Best Score" value={`${data.stats.best_score}%`} />
            <StatBox label="Coding Solved" value={data.stats.coding_problems_solved} />
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Course Path</h2>
      <div className="space-y-4">
        {(data.tiers || fallbackTier(data.modules)).map((tier) => (
          <TierSection key={tier.tier} tier={tier} language={language} />
        ))}
      </div>
    </div>
  );
}

// Beginner -> Intermediate -> Advanced staging (spec item 9/10). Falls back
// to a single unlabeled tier for languages that haven't been re-tiered yet
// (`data.tiers` is only populated once a language's OUTLINE modules carry a
// `tier`, so this keeps older/un-migrated courses working unchanged).
function fallbackTier(modules) {
  const total = modules.reduce((s, m) => s + m.total_lessons, 0);
  const completed = modules.reduce((s, m) => s + m.completed_lessons, 0);
  return [{ tier: 'all', label: 'Modules', total_lessons: total, completed_lessons: completed, locked: false, modules }];
}

const TIER_ICON = { beginner: '🌱', intermediate: '🚀', advanced: '🔥', all: '📘' };

function TierSection({ tier, language }) {
  return (
    <div className={`rounded-xl border border-line bg-paper-card p-4 ${tier.locked ? 'opacity-70' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <span>{TIER_ICON[tier.tier] || '📘'}</span> {tier.label} {tier.locked && '🔒'}
        </p>
        <span className="text-xs text-ink-light">{tier.completed_lessons} / {tier.total_lessons} completed</span>
      </div>
      {tier.locked ? (
        <p className="text-xs text-ink-light">Complete the previous stage to unlock {tier.label}.</p>
      ) : (
        <div className="space-y-3">
          {tier.modules.map((mod) => <ModuleCard key={mod.id} mod={mod} language={language} />)}
        </div>
      )}
    </div>
  );
}

function findLessonMeta(modules, lessonId) {
  if (!lessonId) return null;
  for (const mod of modules) {
    const l = mod.lessons.find((x) => x.id === lessonId);
    if (l) return { ...l, moduleTitle: mod.title };
  }
  return null;
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-3 text-center">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-[11px] text-ink-light">{label}</p>
    </div>
  );
}

function ModuleCard({ mod, language }) {
  return (
    <details className="group rounded-xl border border-line bg-paper-card p-4" open={mod.completed_lessons > 0 && mod.completed_lessons < mod.total_lessons}>
      <summary className="flex cursor-pointer items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">Module {mod.order} — {mod.title}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-40 max-w-[50vw] overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-teal" style={{ width: `${mod.percentage}%` }} />
            </div>
            <span className="text-xs text-ink-light">{mod.completed_lessons} / {mod.total_lessons} · {mod.percentage}%</span>
          </div>
        </div>
        <span className="text-ink-light transition group-open:rotate-180">⌄</span>
      </summary>

      <div className="mt-3 space-y-1 border-t border-line pt-3">
        {mod.lessons.map((l) => <LessonRow key={l.id} lesson={l} language={language} />)}
      </div>
    </details>
  );
}

function LessonRow({ lesson, language }) {
  const status = lesson.completed ? '✅' : lesson.locked ? '🔒' : lesson.opened ? '🔓' : '⚪';
  const content = (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-paper">
      <div className="flex items-center gap-2 min-w-0">
        <span>{status}</span>
        <span className={`truncate text-sm ${lesson.locked ? 'text-ink-light' : 'text-ink'}`}>{lesson.order}. {lesson.title}</span>
        {!lesson.content_ready && <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">Coming soon</span>}
      </div>
      <span className="shrink-0 text-xs text-ink-light">{lesson.est_minutes} min</span>
    </div>
  );
  if (lesson.locked) return <div className="cursor-not-allowed opacity-60">{content}</div>;
  return <Link to={`/courses/${language}/lessons/${lesson.id}`}>{content}</Link>;
}
