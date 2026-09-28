import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchCourseLesson, fetchCourseDashboard, runCoursePractice, COURSE_LANGUAGES } from '../services/coursesService';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
// Reusing the EXACT SAME compiler component the Exam Module and Practice use.
import CodeEditor from '../components/tests/CodeEditor';
import CourseSidebar from '../components/course/CourseSidebar';

// Generalized version of pages/PythonLesson.jsx.
export default function CourseLesson() {
  const { language, lessonId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tiers, setTiers] = useState(null); // sidebar topic tree (spec item 1)
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [runError, setRunError] = useState(null);
  const [running, setRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer (spec item 11)

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCourseLesson(language, lessonId), fetchCourseDashboard(language).catch(() => null)])
      .then(([res, dash]) => {
        setData(res);
        setCode(res.lesson.practice?.starter_code || '');
        if (dash) setTiers(dash.tiers || null);
      })
      .catch((err) => {
        showToast(err.message || 'Could not open this lesson.', 'error');
        if (err.status === 403) navigate(`/courses/${language}`);
      })
      .finally(() => setLoading(false));
  }, [language, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await runCoursePractice(language, lessonId, code, input);
      setOutput(res.output);
      if (res.error) setRunError(res.error);
    } catch (err) {
      showToast(err.message || 'Could not run your code.', 'error');
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setCode(data.lesson.practice?.starter_code || '');
    setOutput(null);
    setRunError(null);
  }

  if (loading) return <LoadingSpinner fullPage label="Loading lesson…" />;
  if (!data) return null;

  const { lesson, module: mod, completed, nav } = data;
  const { learn } = lesson;
  const meta = COURSE_LANGUAGES.find((l) => l.value === language);

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      {/* Persistent topic sidebar on desktop, slide-over drawer on mobile — spec items 1 & 11 */}
      {tiers && (
        <>
          <div className="hidden lg:block lg:w-72 lg:shrink-0 lg:sticky lg:top-20">
            <CourseSidebar language={language} tiers={tiers} activeLessonId={lessonId} />
          </div>
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm overflow-y-auto bg-paper p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink">Course Topics</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-ink-light">✕</button>
                </div>
                <CourseSidebar language={language} tiers={tiers} activeLessonId={lessonId} onNavigate={() => setSidebarOpen(false)} />
              </div>
            </div>
          )}
        </>
      )}

      <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/courses/${language}`} className="text-xs font-semibold text-teal hover:underline">← {meta?.label} Full Course</Link>
        {tiers && (
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink lg:hidden">
            ☰ Topics
          </button>
        )}
      </div>

      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{mod.title}</p>
          <h1 className="text-xl font-bold text-ink">{lesson.title}</h1>
          <p className="text-xs text-ink-light">Est. {lesson.est_minutes} min {completed && '· ✅ Completed'}</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-paper-card p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">📖 Learn</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{learn.explanation}</p>

        {learn.syntax && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-light">Syntax</p>
            <pre className="overflow-x-auto rounded-lg bg-surface-dark p-3 font-mono text-xs text-white">{learn.syntax}</pre>
          </div>
        )}

        {learn.examples && learn.examples.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">Example</p>
            {learn.examples.map((ex, i) => (
              <div key={i}>
                <pre className="overflow-x-auto rounded-lg bg-surface-dark p-3 font-mono text-xs text-white">{ex.code}</pre>
                {ex.output && (
                  <>
                    <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-ink-light">Output</p>
                    <pre className="overflow-x-auto rounded-lg border border-line bg-paper p-3 font-mono text-xs text-ink">{ex.output}</pre>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {learn.important_points && learn.important_points.length > 0 && <BulletBlock title="Important Points" items={learn.important_points} />}
        {learn.common_mistakes && learn.common_mistakes.length > 0 && <BulletBlock title="Common Mistakes" items={learn.common_mistakes} />}
        {learn.real_world && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-light">Real-world Example</p>
            <p className="text-sm text-ink-light">{learn.real_world}</p>
          </div>
        )}
      </section>

      {lesson.practice && (
        <section className="mt-6 rounded-xl border border-line bg-paper-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">💻 Try in Compiler</h2>
            <span className="text-xs text-ink-light">{meta?.label}</span>
          </div>
          <div className="h-56 overflow-hidden rounded-lg border border-line">
            <CodeEditor value={code} onChange={setCode} language={language} />
          </div>
          <input
            value={input} onChange={(e) => setInput(e.target.value)} placeholder="Program input (optional)"
            className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleRun} disabled={running} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {running ? 'Running…' : 'Run'}
            </button>
            <button onClick={() => setCode('')} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">Clear</button>
            <button onClick={handleReset} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">Reset</button>
          </div>
          {(output !== null || runError) && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-light">Output</p>
              <pre className={`overflow-x-auto rounded-lg border p-3 font-mono text-xs ${runError ? 'border-crimson/40 bg-crimson/5 text-crimson' : 'border-line bg-paper text-ink'}`}>
                {runError || output || '(no output)'}
              </pre>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => navigate(`/courses/${language}/lessons/${lessonId}/test`)}
          className="rounded-lg bg-teal px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          Continue to Test →
        </button>
      </div>

      {nav && <LessonNavBar language={language} nav={nav} navigate={navigate} />}
      </div>
    </div>
  );
}

// Previous / Next lesson navigation, shown at the bottom of every lesson
// (spec Part 6). "Previous" always revisits a completed lesson and is
// hidden on the first lesson. "Next" opens the next lesson when it's
// unlocked; if the student hasn't completed this lesson's test yet it's
// shown disabled/locked rather than removed, since the real gate is
// enforced server-side regardless of what this button does. On the final
// lesson of the course, "Next" becomes "Complete Course".
function LessonNavBar({ language, nav, navigate }) {
  const { prev_lesson_id, next_lesson_id, next_lesson_locked, is_first, is_last } = nav;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
      {!is_first && prev_lesson_id ? (
        <button
          onClick={() => navigate(`/courses/${language}/lessons/${prev_lesson_id}`)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
        >
          ← Previous
        </button>
      ) : <span />}

      {is_last ? (
        <button
          onClick={() => navigate(`/courses/${language}`)}
          className="rounded-lg bg-gradient-to-r from-purple to-hero-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          🎉 Complete Course
        </button>
      ) : next_lesson_locked ? (
        <button
          disabled
          title="Complete this lesson's test to unlock the next lesson."
          className="cursor-not-allowed rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-light opacity-60"
        >
          🔒 Next
        </button>
      ) : (
        <button
          onClick={() => navigate(`/courses/${language}/lessons/${next_lesson_id}`)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
        >
          Next →
        </button>
      )}
    </div>
  );
}

function BulletBlock({ title, items }) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-light">{title}</p>
      <ul className="list-inside list-disc space-y-1 text-sm text-ink-light">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
