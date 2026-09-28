import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchDeptSections } from '../../services/hodService';
import { fetchDeptStudents } from '../../services/hodService';
import {
  fetchDepartmentTests, fetchDepartmentTestDetail, createHodTest, updateHodTest, deleteHodTest,
  fetchHodSavedTests, fetchHodSavedTest, saveHodTestTemplate, updateHodSavedTest, deleteHodSavedTest,
} from '../../services/testService';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import TestLeaderboardModal from './TestLeaderboardModal';
import AllTestsLeaderboardModal from './AllTestsLeaderboardModal';
import {
  questionFromStored, useQuestionHandlers, QuestionsEditor, SetsEditor, blankSet, Field, TestCreateModal,
} from './testFormShared';

export default function HodTests() {
  const { showToast } = useToast();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState('normal'); // 'normal' | 'set' — which entry point was used
  const [createPrefill, setCreatePrefill] = useState(null); // saved test to "Use This Test" from, or null
  const [editingTest, setEditingTest] = useState(null); // own test being edited, or null
  const [detailTestId, setDetailTestId] = useState(null); // any dept test being inspected, or null
  const [leaderboardTest, setLeaderboardTest] = useState(null); // { id, title } or null
  const [savedTestsOpen, setSavedTestsOpen] = useState(false);
  const [showAllTestsLb, setShowAllTestsLb] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState(null);
  const [deletingTest, setDeletingTest] = useState(null); // own test being confirmed for removal, or null

  const load = () => {
    setLoading(true);
    fetchDepartmentTests().then(setTests).catch((err) => showToast(err.message || 'Could not load department tests.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirmed = async (removePoints) => {
    const test = deletingTest;
    if (!test) return;
    await deleteHodTest(test.id, removePoints);
    setTests((prev) => prev.filter((t) => t.id !== test.id));
    showToast(removePoints ? 'Test and its points removed.' : 'Test removed — points kept on the leaderboard.', 'success');
    setDeletingTest(null);
  };

  // Save/Clone (item 5) — works on ANY test in the department, not only the
  // HOD's own. Never mutates the source test; never copies its attempts,
  // leaderboard entries, or point-ledger rows — see POST /api/hod/saved-tests.
  const handleSaveAsTemplate = async (test) => {
    if (savingTemplateId) return;
    setSavingTemplateId(test.id);
    try {
      await saveHodTestTemplate({ source_test_id: test.id, client_token: `hod_snapshot_${test.id}` });
      showToast('Saved to Saved Tests.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save this test as a template.', 'error');
    } finally {
      setSavingTemplateId(null);
    }
  };

  // "Use This Test" (item 6) — prefill Create New Test from a saved
  // template; publishing produces a completely independent new test id.
  const openUseThisTest = (savedTest) => {
    setCreatePrefill(savedTest);
    setCreateMode(savedTest.sets ? 'set' : 'normal');
    setSavedTestsOpen(false);
    setCreateOpen(true);
  };

  // Two distinct entry points (Normal Test vs Set Test) rather than a
  // single "+ New test" button with a mode toggle buried inside — the
  // choice is made here, before the form ever opens (see initialMode on
  // TestCreateModal).
  const openCreate = (mode) => {
    setCreateMode(mode);
    setCreatePrefill(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreatePrefill(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Tests</h1>
          <p className="text-sm text-ink-light">Every test run in your department, plus your own tests you create, save, and reuse.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setShowAllTestsLb(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">
            🏆 All Tests
          </button>
          <button type="button" onClick={() => setSavedTestsOpen(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">
            Saved Tests
          </button>
          <button type="button" onClick={() => openCreate('normal')} className="rounded-full border border-hero-primary px-4 py-2 text-sm font-bold text-hero-primary hover:bg-hero-primary/10">
            + Normal Test
          </button>
          <button type="button" onClick={() => openCreate('set')} className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            + Set Test
          </button>
        </div>
      </div>

      <AllTestsLeaderboardModal open={showAllTestsLb} onClose={() => setShowAllTestsLb(false)} />
      <TestDetailModal testId={detailTestId} onClose={() => setDetailTestId(null)} />
      <EditTestModal
        test={editingTest}
        onClose={() => setEditingTest(null)}
        onSaved={(updated) => setTests((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))}
      />
      <RemoveTestModal test={deletingTest} onClose={() => setDeletingTest(null)} onConfirm={handleDeleteConfirmed} />

      {loading ? (
        <LoadingSpinner label="Loading department tests…" />
      ) : tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No tests in your department yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                  <p className="text-sm text-ink-light">{t.subject} · by {t.created_by_name}{t.is_own ? ' (you)' : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${t.status === 'open' ? 'bg-teal/10 text-teal' : t.status === 'upcoming' ? 'bg-gold/10 text-gold' : 'bg-line/50 text-ink-light'}`}>
                  {t.status}
                </span>
              </div>
              {/* item 15: Set Test must be clearly identified in the list.
                  Falls back to `t.sets` presence for tests created before
                  the `type` field existed. */}
              {(t.type === 'set' || t.sets) ? (
                <span className="mt-2 inline-block rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal">Set Test · {t.sets?.length ?? '—'} sets</span>
              ) : (
                <span className="mt-2 inline-block rounded-full bg-line/40 px-2.5 py-0.5 text-[11px] font-bold text-ink-light">Normal Test</span>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                <span>{t.question_count} question{t.question_count === 1 ? '' : 's'}</span>
                <span>{t.total_marks} marks</span>
                <span>{t.submission_count} submitted</span>
                {t.pending_grading_count > 0 && <span className="font-semibold text-gold">{t.pending_grading_count} need grading</span>}
                <span>{t.assigned_student_usernames ? `${t.assigned_student_usernames.length} student${t.assigned_student_usernames.length === 1 ? '' : 's'} assigned` : 'All students'}</span>
                {!t.published && <span className="font-semibold text-crimson">Unpublished</span>}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setDetailTestId(t.id)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">🔍 View</button>
                <button type="button" onClick={() => setLeaderboardTest({ id: t.id, title: t.title })} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">🏆 Leaderboard</button>
                <button
                  type="button"
                  onClick={() => handleSaveAsTemplate(t)}
                  disabled={savingTemplateId === t.id}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper disabled:opacity-60"
                  title="Save this question paper as a reusable template in Saved Tests"
                >
                  {savingTemplateId === t.id ? 'Saving…' : '💾 Save Test'}
                </button>
                {t.is_own && t.editable && (
                  <button type="button" onClick={() => setEditingTest(t)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">✎ Edit</button>
                )}
                {t.is_own && (
                  <button type="button" onClick={() => setDeletingTest(t)} className="ml-auto text-xs font-semibold text-crimson hover:underline">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TestCreateModal
        open={createOpen}
        prefill={createPrefill}
        initialMode={createMode}
        onClose={closeCreate}
        onCreated={(t) => { load(); setCreatePrefill(null); }}
        fetchSections={fetchDeptSections}
        fetchStudents={fetchDeptStudents}
        createTestFn={createHodTest}
        saveTemplateFn={saveHodTestTemplate}
      />
      <TestLeaderboardModal testId={leaderboardTest?.id || null} testTitle={leaderboardTest?.title} onClose={() => setLeaderboardTest(null)} />
      <SavedTestsModal open={savedTestsOpen} onClose={() => setSavedTestsOpen(false)} onUseThisTest={openUseThisTest} />
    </div>
  );
}

// Full-detail read-only inspect (item 4) — title, description, creator,
// questions, options, correct answers, marks, duration, schedule, assigned
// section, published status, submissions. Works for ANY test in the HOD's
// department, not only tests they created themselves.
// Shared by TestDetailModal below for both a plain question list and a
// sets test's per-set question list — identical card either way.
function QuestionDetailCard({ q, index }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="mb-1 text-xs font-bold text-ink-light">Question {index + 1} · {q.marks} marks · {q.type}</p>
      <p className="text-sm text-ink">{q.text}</p>
      {q.type === 'mcq' && (
        <ul className="mt-2 space-y-1">
          {q.options.map((opt, oi) => (
            <li key={oi} className={`text-xs ${oi === q.correct_index ? 'font-bold text-teal' : 'text-ink-light'}`}>
              {oi === q.correct_index ? '✓ ' : '· '}{opt}
            </li>
          ))}
        </ul>
      )}
      {q.type === 'code' && (
        <p className="mt-1 text-xs text-ink-light">{q.language} · {q.test_cases.length} test case{q.test_cases.length === 1 ? '' : 's'}</p>
      )}
    </div>
  );
}

function TestDetailModal({ testId, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    setError('');
    setData(null);
    fetchDepartmentTestDetail(testId)
      .then(setData)
      .catch((err) => {
        const message = err.message || 'Could not load this test.';
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!testId) return null;
  const test = data?.test;

  return (
    <Modal open onClose={onClose} title={test ? test.title : 'Test details'}>
      {loading ? (
        <LoadingSpinner label="Loading test…" />
      ) : error ? (
        <p className="text-sm text-crimson">{error}</p>
      ) : !test ? (
        <p className="text-sm text-ink-light">Not found.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-3 text-xs text-ink-light">
            <span>By {test.created_by_name}</span>
            <span>{test.section_name} · {test.department}</span>
            <span>{test.duration_minutes} min</span>
            <span>{test.total_marks} marks</span>
            <span className="capitalize">{test.status}</span>
            <span>{test.published ? 'Published' : 'Unpublished'}</span>
          </div>
          <div className="space-y-3">
            {test.sets ? (
              // items 19-26: this HOD-inspecting-a-faculty-test view has no
              // single flat `test.questions` to show for a sets test — one
              // per set instead, same structure as the create-modal preview.
              test.sets.map((s) => (
                <div key={s.id} className="rounded-xl border border-line p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-ink-light">{s.name} · {s.total_marks} marks</p>
                  <div className="space-y-2">
                    {s.questions.map((q, i) => <QuestionDetailCard key={q.id} q={q} index={i} />)}
                  </div>
                </div>
              ))
            ) : (
              test.questions.map((q, i) => <QuestionDetailCard key={q.id} q={q} index={i} />)
            )}
          </div>
          {data.submissions.length > 0 && (
            <p className="text-xs text-ink-light">{data.submissions.length} submission{data.submissions.length === 1 ? '' : 's'} so far.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

// Test Removal + Points Decision (item 2), restricted to a test the HOD
// themselves created — identical semantics to the faculty version.
function RemoveTestModal({ test, onClose, onConfirm }) {
  const [choice, setChoice] = useState(null); // 'remove' | 'keep' | null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setChoice(null);
    setSubmitting(false);
    setError('');
  }, [test?.id]);

  if (!test) return null;

  const confirm = async () => {
    if (!choice) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(choice === 'remove');
    } catch (err) {
      setError(err.message || 'Could not remove this test.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={submitting ? () => {} : onClose} title={`Remove "${test.title}"?`}>
      <div className="space-y-4 text-sm">
        <p className="text-ink-light">This deletes the test and takes it off students' test list. It cannot be undone.</p>
        <p className="font-semibold text-ink">Do you also want to remove the points/marks earned from this test from the main leaderboard and point ledger?</p>

        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${choice === 'remove' ? 'border-crimson bg-crimson/5' : 'border-line hover:bg-paper'}`}>
          <input type="radio" name="hod_remove_points" className="mt-1" checked={choice === 'remove'} onChange={() => setChoice('remove')} />
          <span>
            <span className="block font-semibold text-ink">Remove Test + Remove Points</span>
            <span className="block text-xs text-ink-light">Deletes the test and every point it generated. Students' main leaderboard totals will drop accordingly.</span>
          </span>
        </label>

        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${choice === 'keep' ? 'border-hero-primary bg-hero-primary/5' : 'border-line hover:bg-paper'}`}>
          <input type="radio" name="hod_remove_points" className="mt-1" checked={choice === 'keep'} onChange={() => setChoice('keep')} />
          <span>
            <span className="block font-semibold text-ink">Remove Test Only + Keep Points</span>
            <span className="block text-xs text-ink-light">Deletes the test, but points already earned stay on the main leaderboard and point ledger.</span>
          </span>
        </label>

        {error && <p className="rounded-lg bg-crimson/10 px-3 py-2 text-xs font-semibold text-crimson">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-paper disabled:opacity-60">Cancel</button>
          <button
            type="button"
            onClick={confirm}
            disabled={!choice || submitting}
            className="rounded-full bg-crimson px-4 py-2 text-sm font-bold text-white hover:bg-crimson/90 disabled:opacity-50"
          >
            {submitting ? 'Removing…' : 'Remove Test'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Saved Tests (items 5/6) — HOD's own reusable question-paper templates,
// each either cloned from a department test or built from scratch. Fully
// independent of Conducted Tests: editing/deleting one here never touches
// the original test it may have been cloned from, or any test previously
// created via "Use This Test".
function SavedTestsModal({ open, onClose, onUseThisTest }) {
  const { showToast } = useToast();
  const [savedTests, setSavedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTest, setEditingTest] = useState(null); // saved test row, or null
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    fetchHodSavedTests().then(setSavedTests).catch((err) => showToast(err.message || 'Could not load saved tests.', 'error')).finally(() => setLoading(false));
  };
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this saved test? This only removes the reusable template — any test already created from it is unaffected.')) return;
    setDeletingId(id);
    try {
      await deleteHodSavedTest(id);
      setSavedTests((prev) => prev.filter((t) => t.id !== id));
      showToast('Saved test deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete this saved test.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Saved Tests">
      {loading ? (
        <LoadingSpinner label="Loading saved tests…" />
      ) : savedTests.length === 0 ? (
        <p className="text-sm text-ink-light">No saved tests yet. Use "💾 Save Test" on any department test, or save a new one while creating a test.</p>
      ) : (
        <div className="space-y-2">
          {savedTests.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-paper-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-xs text-ink-light">{t.subject} · {t.question_count} question{t.question_count === 1 ? '' : 's'} · {t.total_marks} marks</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onUseThisTest(t)} className="rounded-full bg-hero-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">Use This Test</button>
                <button type="button" onClick={() => setEditingTest(t)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">Edit</button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="ml-auto text-xs font-semibold text-crimson hover:underline disabled:opacity-60"
                >
                  {deletingId === t.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <SavedTestEditModal
        savedTest={editingTest}
        onClose={() => setEditingTest(null)}
        onSaved={(updated) => { setSavedTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t))); setEditingTest(null); }}
      />
    </Modal>
  );
}

function SavedTestEditModal({ savedTest, onClose, onSaved }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [questions, setQuestions] = useState([]);
  const [setsMode, setSetsMode] = useState(false);
  const [sets, setSets] = useState([blankSet('Set 1'), blankSet('Set 2')]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!savedTest) return;
    setTitle(savedTest.title);
    setSubject(savedTest.subject);
    setDescription(savedTest.description || '');
    setDurationMinutes(savedTest.duration_minutes);
    if (savedTest.sets) {
      setSetsMode(true);
      setSets(savedTest.sets.map((s) => ({ ...questionFromStored({}), name: s.name, questions: s.questions.map(questionFromStored) })));
      setQuestions([]);
    } else {
      setSetsMode(false);
      setQuestions((savedTest.questions || []).map(questionFromStored));
      setSets([blankSet('Set 1'), blankSet('Set 2')]);
    }
    setError('');
  }, [savedTest]);

  const handlers = useQuestionHandlers(setQuestions);

  if (!savedTest) return null;

  const handleSave = async () => {
    if (!title.trim()) { setError('Add a title.'); return; }
    if (setsMode) {
      if (sets.length < 2) { setError('Add at least 2 sets.'); return; }
      if (sets.some((s) => !s.name.trim() || s.questions.length === 0)) { setError('Every set needs a name and at least one question.'); return; }
    } else if (questions.length === 0) {
      setError('Add at least one question.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await updateHodSavedTest(savedTest.id, {
        title, subject: subject || 'General', description, duration_minutes: durationMinutes,
        ...(setsMode
          ? { sets: sets.map((s) => ({ name: s.name, questions: s.questions.map(({ _key, ...q }) => q) })) }
          : { questions: questions.map(({ _key, ...q }) => q) }),
      });
      showToast('Saved test updated.', 'success');
      onSaved(updated);
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit saved test">
      <div className="space-y-3">
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Subject" value={subject} onChange={setSubject} />
        <Field label="Description" value={description} onChange={setDescription} />
        <Field label="Duration (minutes)" type="number" value={durationMinutes} onChange={(v) => setDurationMinutes(Number(v))} />
        {setsMode ? (
          <SetsEditor sets={sets} setSets={setSets} />
        ) : (
          <QuestionsEditor questions={questions} setQuestions={setQuestions} {...handlers} />
        )}
        {error && <p className="text-xs font-semibold text-crimson">{error}</p>}
        <button type="button" onClick={handleSave} disabled={submitting} className="w-full rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}

// Create Test (item 3) reuses the exact same TestCreateModal component
// Faculty uses — see the call site above — rather than a separate,
// simplified HOD test-creation form.

// Edit Test (item 3, mirrored for HOD-owned tests) — only ever reachable
// pre-start-time; the backend enforces this independently regardless of
// what the frontend sends.
function EditTestModal({ test, onClose, onSaved }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState([]);
  const [setsMode, setSetsMode] = useState(false);
  const [sets, setSets] = useState([blankSet('Set 1'), blankSet('Set 2')]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!test) return;
    setTitle(test.title);
    setSubject(test.subject);
    if (test.sets) {
      setSetsMode(true);
      setSets(test.sets.map((s) => ({ ...questionFromStored({}), name: s.name, questions: s.questions.map(questionFromStored) })));
      setQuestions([]);
    } else {
      setSetsMode(false);
      setQuestions((test.questions || []).map(questionFromStored));
      setSets([blankSet('Set 1'), blankSet('Set 2')]);
    }
    setError('');
  }, [test]);

  const { updateQuestion, updateOption, addOption, removeOption, removeQuestion, updateTestCase, addTestCase, removeTestCase } = useQuestionHandlers(setQuestions);

  if (!test) return null;

  if (!test.editable) {
    return (
      <Modal open onClose={onClose} title={`Edit — ${test.title}`}>
        <p className="text-sm text-ink-light">
          Editing locked — this test has already started, or a student has already joined. Content and schedule can no longer be changed.
        </p>
      </Modal>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Add a title.'); return; }
    if (setsMode) {
      if (sets.length < 2) { setError('Add at least 2 sets.'); return; }
      if (sets.some((s) => !s.name.trim() || s.questions.length === 0)) { setError('Every set needs a name and at least one question.'); return; }
    } else if (questions.length === 0) {
      setError('Add at least one question.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const updated = await updateHodTest(test.id, {
        title, subject: subject || 'General',
        ...(setsMode
          ? { sets: sets.map((s) => ({ name: s.name, questions: s.questions.map(({ _key, ...q }) => q) })) }
          : { questions: questions.map(({ _key, ...q }) => q) }),
      });
      showToast('Test updated.', 'success');
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit — ${test.title}`}>
      <div className="space-y-3">
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Subject" value={subject} onChange={setSubject} />
        {setsMode ? (
          <SetsEditor sets={sets} setSets={setSets} />
        ) : (
          <QuestionsEditor
            questions={questions} setQuestions={setQuestions}
            updateQuestion={updateQuestion} updateOption={updateOption} addOption={addOption} removeOption={removeOption}
            removeQuestion={removeQuestion} updateTestCase={updateTestCase} addTestCase={addTestCase} removeTestCase={removeTestCase}
          />
        )}
        {error && <p className="text-xs font-semibold text-crimson">{error}</p>}
        <button type="button" onClick={handleSave} disabled={submitting} className="w-full rounded-lg bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
