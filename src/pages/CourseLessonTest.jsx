import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchCourseLessonTest, runCourseTestQuestionCode, submitCourseLessonTest } from '../services/coursesService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CodeEditor from '../components/tests/CodeEditor';

// Generalized version of pages/PythonLessonTest.jsx.
export default function CourseLessonTest() {
  const { language, lessonId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { role } = useAuth();
  const isFaculty = role === 'faculty';

  const [loading, setLoading] = useState(true);
  const [testData, setTestData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [codeRuns, setCodeRuns] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchCourseLessonTest(language, lessonId)
      .then((res) => {
        setTestData(res);
        const initial = {};
        res.questions.forEach((q) => { initial[q.id] = q.type === 'code' ? { code: q.starter_code || '' } : { selected_index: null }; });
        setAnswers(initial);
      })
      .catch((err) => {
        showToast(err.message || 'Could not load the test.', 'error');
        if (err.status === 403) navigate(`/courses/${language}`);
      })
      .finally(() => setLoading(false));
  }, [language, lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRunCode(q) {
    setCodeRuns((prev) => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), running: true } }));
    try {
      const res = await runCourseTestQuestionCode(language, lessonId, q.id, answers[q.id]?.code || '');
      setCodeRuns((prev) => ({ ...prev, [q.id]: { running: false, results: res.results, all_passed: res.all_passed } }));
    } catch (err) {
      showToast(err.message || 'Could not run your code.', 'error');
      setCodeRuns((prev) => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), running: false } }));
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const orderedAnswers = testData.questions.map((q) => answers[q.id] || {});
      const res = await submitCourseLessonTest(language, lessonId, orderedAnswers);
      setResult(res);
    } catch (err) {
      showToast(err.message || 'Could not submit the test.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading test…" />;
  if (!testData) return null;
  if (result) return <ResultScreen language={language} lessonId={lessonId} result={result} onRetry={() => setResult(null)} />;

  const allAnswered = testData.questions.every((q) => {
    const a = answers[q.id];
    return q.type === 'code' ? a && a.code && a.code.trim() : a && typeof a.selected_index === 'number';
  });

  return (
    <div>
      <Link to={`/courses/${language}/lessons/${lessonId}`} className="text-xs font-semibold text-teal hover:underline">← Back to lesson</Link>
      <h1 className="mt-2 mb-6 text-xl font-bold text-ink">{testData.lesson_title} – Test</h1>

      <div className="space-y-5">
        {testData.questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-line bg-paper-card p-5">
            <p className="mb-3 text-sm font-semibold text-ink">Q{i + 1}. {q.text}</p>

            {q.type !== 'code' ? (
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.id]?.selected_index === oi ? 'border-teal bg-teal/10 text-ink' : 'border-line text-ink hover:bg-paper'}`}>
                    <input type="radio" name={q.id} checked={answers[q.id]?.selected_index === oi} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: { selected_index: oi } }))} />
                    {String.fromCharCode(65 + oi)}. {opt}
                  </label>
                ))}
              </div>
            ) : (
              <div>
                <div className="h-48 overflow-hidden rounded-lg border border-line">
                  <CodeEditor value={answers[q.id]?.code || ''} onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: { code: val } }))} language={q.language || language} />
                </div>
                <button onClick={() => handleRunCode(q)} disabled={codeRuns[q.id]?.running} className="mt-3 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {codeRuns[q.id]?.running ? 'Running…' : 'Run'}
                </button>
                {codeRuns[q.id]?.results && (
                  <div className="mt-3 space-y-1">
                    {codeRuns[q.id].results.map((r, ri) => (
                      <p key={ri} className={`text-xs ${r.passed ? 'text-teal' : 'text-crimson'}`}>{r.passed ? '✓' : '✗'} Test Case {ri + 1}</p>
                    ))}
                    <p className="text-xs font-semibold text-ink">{codeRuns[q.id].results.filter((r) => r.passed).length} / {codeRuns[q.id].results.length} Passed</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        {isFaculty ? (
          <p className="text-xs font-semibold text-ink-light">
            👁 Faculty preview — test submission and grading are for students only.
          </p>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !allAnswered} className="rounded-lg bg-teal px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Code'}
          </button>
        )}
      </div>
    </div>
  );
}

function ResultScreen({ language, lessonId, result, onRetry }) {
  const { score, next_lesson_id } = result;
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-paper-card p-8 text-center">
      <p className="text-2xl">🎉</p>
      <h1 className="mt-1 text-lg font-bold text-ink">Test Completed</h1>
      <p className="mt-4 text-3xl font-bold text-ink">{score.correct} / {score.total}</p>
      <p className="text-2xl font-bold text-teal">{score.percentage}%</p>
      <p className={`mt-1 text-sm font-semibold ${score.passed ? 'text-teal' : 'text-crimson'}`}>{score.passed ? '✓ Passed' : '✗ Not Passed'}</p>
      {score.coding_total > 0 && <p className="mt-2 text-xs text-ink-light">Coding test cases passed: {score.coding_passed}/{score.coding_total}</p>}
      <p className="mt-3 text-sm font-semibold text-teal">✅ Lesson Completed</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button onClick={onRetry} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">Retry Test</button>
        <Link to={`/courses/${language}/lessons/${lessonId}`} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">Review Lesson</Link>
        {next_lesson_id ? (
          <Link to={`/courses/${language}/lessons/${next_lesson_id}`} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Next Lesson →</Link>
        ) : (
          <Link to={`/courses/${language}`} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Back to Course</Link>
        )}
      </div>
    </div>
  );
}
