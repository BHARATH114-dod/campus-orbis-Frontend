import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchMySections } from '../../services/facultyService';
import { fetchMyStudents } from '../../services/facultyService';
import {
  createTest, fetchMyTests, fetchTestResults, deleteTest, gradeSubmission, testResultsCsvUrl,
  fetchSavedTests, saveTestTemplate, updateSavedTest, deleteSavedTest,
  updateTest, fetchTestLiveStatus, fetchRejoinRequests, decideRejoinRequest,
} from '../../services/testService';
import { subscribeRealtime } from '../../services/realtime';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import TestLeaderboardModal from './TestLeaderboardModal';
import AllTestsLeaderboardModal from './AllTestsLeaderboardModal';
import {
  blankMcq, blankTheory, blankCode, blankSet, questionFromStored, useQuestionHandlers, QuestionsEditor, SetsEditor,
  computeDurationMinutes, formatDurationLabel, DURATION_PRESETS, addMinutesToLocal,
  formatCountdown, Field, TestCreateModal,
} from './testFormShared';


export default function FacultyTests() {
  const { showToast } = useToast();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState('normal'); // 'normal' | 'set' — which entry point was used
  const [createPrefill, setCreatePrefill] = useState(null); // saved test to "Use Again" from, or null for a blank test
  const [resultsTestId, setResultsTestId] = useState(null);
  const [editingTest, setEditingTest] = useState(null); // full test object being edited, or null
  const [leaderboardTest, setLeaderboardTest] = useState(null); // { id, title } or null
  const [savedTestsOpen, setSavedTestsOpen] = useState(false);
  const [showAllTestsLb, setShowAllTestsLb] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState(null); // conducted-test id currently being "Saved as template" (guards duplicate clicks)
  const [deletingTest, setDeletingTest] = useState(null); // test being confirmed for removal, or null

  const load = () => {
    setLoading(true);
    fetchMyTests().then(setTests).catch((err) => showToast(err.message || 'Could not load your tests.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirmed = async (removePoints) => {
    const test = deletingTest;
    if (!test) return;
    await deleteTest(test.id, removePoints);
    setTests((prev) => prev.filter((t) => t.id !== test.id));
    showToast(removePoints ? 'Test and its points removed.' : 'Test removed — points kept on the leaderboard.', 'success');
    setDeletingTest(null);
  };

  // "Save Test" on an already-conducted test — snapshots its current
  // question paper into a brand new, independent Saved Test template.
  // Deleting/editing this conducted test afterwards never touches the
  // template, and vice versa.
  const handleSaveAsTemplate = async (test) => {
    if (savingTemplateId) return; // guards a duplicate/double click
    setSavingTemplateId(test.id);
    try {
      await saveTestTemplate({ source_test_id: test.id, client_token: `snapshot_${test.id}` });
      showToast('Saved to Saved Tests.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save this test as a template.', 'error');
    } finally {
      setSavingTemplateId(null);
    }
  };

  const openUseAgain = (savedTest) => {
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
          <p className="text-sm text-ink-light">Write, assign, and grade online tests for your sections.</p>
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
      <EditTestModal
        test={editingTest}
        onClose={() => setEditingTest(null)}
        onSaved={(updated) => setTests((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))}
      />

      {loading ? (
        <LoadingSpinner label="Loading your tests…" />
      ) : tests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No tests created yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                  <p className="text-sm text-ink-light">{t.subject}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${t.status === 'open' ? 'bg-teal/10 text-teal' : t.status === 'upcoming' ? 'bg-gold/10 text-gold' : 'bg-line/50 text-ink-light'}`}>
                  {t.status}
                </span>
              </div>
              {/* item 15: Set Test must be clearly identified in the list, not
                  left for faculty to guess from question_count alone. Falls
                  back to `t.sets` presence for tests created before the
                  `type` field existed. */}
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
                {t.status === 'upcoming' && t.seconds_to_start != null && (
                  <span className="font-semibold text-hero-primary">starts in {formatCountdown(t.seconds_to_start)}</span>
                )}
                {t.pending_rejoin_count > 0 && <span className="font-semibold text-crimson">{t.pending_rejoin_count} rejoin request{t.pending_rejoin_count === 1 ? '' : 's'}</span>}
                <span>{t.assigned_count != null ? `${t.assigned_count} student${t.assigned_count === 1 ? '' : 's'} assigned` : 'All students'}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setResultsTestId(t.id)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">Results</button>
                <button type="button" onClick={() => setLeaderboardTest({ id: t.id, title: t.title })} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">🏆 Leaderboard</button>
                <a href={testResultsCsvUrl(t.id)} download className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">⬇ CSV</a>
                {t.editable && (
                  <button type="button" onClick={() => setEditingTest(t)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">✎ Edit</button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveAsTemplate(t)}
                  disabled={savingTemplateId === t.id}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper disabled:opacity-60"
                  title="Save this question paper as a reusable template in Saved Tests"
                >
                  {savingTemplateId === t.id ? 'Saving…' : '💾 Save Test'}
                </button>
                <button type="button" onClick={() => setDeletingTest(t)} className="ml-auto text-xs font-semibold text-crimson hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RemoveTestModal test={deletingTest} onClose={() => setDeletingTest(null)} onConfirm={handleDeleteConfirmed} />

      <TestCreateModal
        open={createOpen}
        prefill={createPrefill}
        initialMode={createMode}
        onClose={closeCreate}
        onCreated={(t) => { setTests((prev) => [{ ...t, submission_count: 0, pending_grading_count: 0 }, ...prev]); setCreatePrefill(null); }}
        fetchSections={fetchMySections}
        fetchStudents={fetchMyStudents}
        createTestFn={createTest}
        saveTemplateFn={saveTestTemplate}
      />
      <ResultsModal testId={resultsTestId} onClose={() => setResultsTestId(null)} onGraded={load} />
      <TestLeaderboardModal testId={leaderboardTest?.id || null} testTitle={leaderboardTest?.title} onClose={() => setLeaderboardTest(null)} />
      <SavedTestsModal open={savedTestsOpen} onClose={() => setSavedTestsOpen(false)} onUseAgain={openUseAgain} />
    </div>
  );
}

// Test Removal + Points Decision (item 2). Never deletes on a single click —
// the faculty member must explicitly pick one of the two options below
// before anything is removed, and a failed request leaves the test exactly
// as it was (the modal just re-enables and shows the error).
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
          <input type="radio" name="remove_points" className="mt-1" checked={choice === 'remove'} onChange={() => setChoice('remove')} />
          <span>
            <span className="block font-semibold text-ink">Remove Test + Remove Points</span>
            <span className="block text-xs text-ink-light">Deletes the test and every point it generated. Students' main leaderboard totals will drop accordingly.</span>
          </span>
        </label>

        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${choice === 'keep' ? 'border-hero-primary bg-hero-primary/5' : 'border-line hover:bg-paper'}`}>
          <input type="radio" name="remove_points" className="mt-1" checked={choice === 'keep'} onChange={() => setChoice('keep')} />
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

// "Saved Tests" — reusable question-paper templates. Fully independent of
// Conducted Tests: deleting/editing a template here never touches a
// Conducted Test (or its submissions/results), and vice versa (see
// server.js SavedTests routes).
function SavedTestsModal({ open, onClose, onUseAgain }) {
  const { showToast } = useToast();
  const [savedTests, setSavedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingTest, setEditingTest] = useState(null); // saved test row, or null

  const load = () => {
    setLoading(true);
    fetchSavedTests().then(setSavedTests).catch((err) => showToast(err.message || 'Could not load saved tests.', 'error')).finally(() => setLoading(false));
  };
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (!window.confirm('Are you sure you want to delete this saved test? This will remove the reusable question paper from Saved Tests. Existing conducted tests and their results will not be affected.')) return;
    setDeletingId(id);
    try {
      await deleteSavedTest(id);
      setSavedTests((prev) => prev.filter((t) => t.id !== id));
      showToast('Saved test deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not delete this saved test.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Saved Tests">
        {loading ? (
          <LoadingSpinner label="Loading saved tests…" />
        ) : savedTests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-paper p-8 text-center text-sm text-ink-light">
            <p className="font-semibold text-ink">No saved tests yet.</p>
            <p className="mt-1">Save a test to quickly reuse the same question paper later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {savedTests.map((t) => (
              <div key={t.id} className="rounded-2xl border border-line bg-paper-card p-4 shadow-sm">
                <h3 className="text-base font-semibold text-ink">{t.title}</h3>
                <p className="text-sm text-ink-light">{t.subject}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                  <span>{t.question_count} question{t.question_count === 1 ? '' : 's'}</span>
                  <span>{t.total_marks} marks</span>
                  <span>{t.duration_minutes} min</span>
                </div>
                <div className="mt-2 text-[11px] text-ink-light">
                  <div>Created {new Date(t.created_at).toLocaleDateString()}</div>
                  <div>Last modified {new Date(t.updated_at).toLocaleDateString()}</div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => onUseAgain(t)} className="rounded-full bg-hero-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
                    Use Again
                  </button>
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
      </Modal>
      <SavedTestEditModal
        savedTest={editingTest}
        onClose={() => setEditingTest(null)}
        onSaved={(updated) => { setSavedTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t))); setEditingTest(null); }}
      />
    </>
  );
}

// Editing a Saved Test only ever rewrites the template row itself — any
// Conducted Test previously created from it (via Use Again) already has its
// own independent copy of the question paper and is completely unaffected.
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
  const handlers = useQuestionHandlers(setQuestions);

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

  if (!savedTest) return null;

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
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
      const updated = await updateSavedTest(savedTest.id, {
        title, subject: subject || 'General', description, duration_minutes: durationMinutes,
        ...(setsMode
          ? { sets: sets.map((s) => ({ name: s.name, questions: s.questions.map(({ _key, ...q }) => q) })) }
          : { questions: questions.map(({ _key, ...q }) => q) }),
      });
      showToast('Saved test updated.', 'success');
      onSaved(updated);
    } catch (err) {
      setError(err.message || 'Could not update this saved test.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit saved test">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" value={title} onChange={setTitle} />
          <Field label="Subject" value={subject} onChange={setSubject} placeholder="General" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Description (optional)</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this test covers…" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <Field label="Duration (minutes)" type="number" value={durationMinutes} onChange={(v) => setDurationMinutes(Number(v))} />
        {setsMode ? (
          <SetsEditor sets={sets} setSets={setSets} />
        ) : (
          <QuestionsEditor questions={questions} setQuestions={setQuestions} {...handlers} />
        )}
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button type="button" onClick={handleSave} disabled={submitting} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}

// Edit Test (item 7) — a dedicated, leaner modal rather than retrofitting
// CreateTestModal's three scheduling modes: editing only ever applies to a
// test that's still 'upcoming' with zero joins (enforced server-side too,
// see PUT /api/faculty/tests/:id), so there's no need to re-derive
// duration-from-range or any of the create-time scheduling complexity here
// — just load what's stored, let the faculty change it, and save. Reuses
// QuestionsEditor/useQuestionHandlers so question editing behaves exactly
// like it does on creation.
function EditTestModal({ test, onClose, onSaved }) {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [questions, setQuestions] = useState([]);
  // items 19-26: editing a sets test — initialized from test.sets when
  // present, mirroring TestCreateModal's Sets Mode so pre-publish editing
  // (see items 19/21, and the backend's editable/joined_count === 0 guard)
  // behaves the same whichever form it's done from.
  const [setsMode, setSetsMode] = useState(false);
  const [sets, setSets] = useState([blankSet('Set 1'), blankSet('Set 2')]);
  const [assignMode, setAssignMode] = useState('all');
  const [sectionStudents, setSectionStudents] = useState([]);
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!test) return;
    setError('');
    fetchMySections().then(setSections).catch(() => {});
    fetchMyStudents().then(setSectionStudents).catch(() => {});
    setTitle(test.title);
    setSubject(test.subject || '');
    setSectionId(test.section_id);
    if (test.sets) {
      setSetsMode(true);
      setSets(test.sets.map((s) => ({ ...questionFromStored({}), name: s.name, questions: s.questions.map(questionFromStored) })));
      setQuestions([]);
    } else {
      setSetsMode(false);
      setQuestions((test.questions || []).map(questionFromStored));
      setSets([blankSet('Set 1'), blankSet('Set 2')]);
    }
    if (test.start_time) { const d = new Date(test.start_time); setStartDate(d.toISOString().slice(0, 10)); setStartClock(d.toTimeString().slice(0, 5)); }
    if (test.end_time) { const d = new Date(test.end_time); setEndDate(d.toISOString().slice(0, 10)); setEndClock(d.toTimeString().slice(0, 5)); }
    if (test.assigned_student_usernames) { setAssignMode('selected'); setSelectedUsernames(test.assigned_student_usernames); }
    else { setAssignMode('all'); setSelectedUsernames([]); }
    setStudentSearch('');
  }, [test]); // eslint-disable-line react-hooks/exhaustive-deps

  const { updateQuestion, updateOption, addOption, removeOption, removeQuestion, updateTestCase, addTestCase, removeTestCase } = useQuestionHandlers(setQuestions);

  if (!test) return null;

  // The backend re-checks this too (409 if it's since started/been
  // joined) — this is only to keep the modal itself from opening on a
  // test that's already locked, since it can be opened from a list that
  // hasn't refreshed in a few seconds.
  if (!test.editable) {
    return (
      <Modal open onClose={onClose} title={`Edit — ${test.title}`}>
        <p className="text-sm text-ink-light">
          This test can no longer be edited — it has already started, or a student has already joined. Content and
          assignment are locked once that happens.
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg border border-line py-2.5 text-sm font-bold text-ink">Close</button>
      </Modal>
    );
  }

  const startTime = startDate && startClock ? `${startDate}T${startClock}` : '';
  const endTime = endDate && endClock ? `${endDate}T${endClock}` : '';
  const durationMinutes = computeDurationMinutes(startTime, endTime);

  const validate = () => {
    if (!title.trim() || !sectionId) return 'Title and section are required.';
    if (setsMode) {
      if (sets.length < 2) return 'Add at least 2 sets.';
      for (const s of sets) {
        if (!s.name.trim()) return 'Every set needs a name.';
        if (s.questions.length === 0) return `Set "${s.name}" needs at least one question.`;
        for (const q of s.questions) {
          if (!q.text.trim()) return 'Every question needs its text filled in.';
          if (q.type === 'mcq' && q.options.some((o) => !o.trim())) return 'Every MCQ option needs text.';
        }
      }
    } else {
      if (questions.length === 0) return 'Add at least one question.';
      for (const q of questions) {
        if (!q.text.trim()) return 'Every question needs its text filled in.';
        if (q.type === 'mcq' && q.options.some((o) => !o.trim())) return 'Every MCQ option needs text.';
      }
    }
    if (!startDate || !startClock || !endDate || !endClock) return 'Starting date, starting time, ending date, and ending time are all required.';
    if (!durationMinutes) return 'Ending date/time must be after starting date/time.';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const updated = await updateTest(test.id, {
        title, subject: subject || 'General', section_id: sectionId,
        start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(),
        duration_minutes: durationMinutes,
        ...(setsMode
          ? { sets: sets.map((s) => ({ name: s.name, questions: s.questions.map(({ _key, ...q }) => q) })) }
          : { questions: questions.map(({ _key, ...q }) => q) }),
        assign_mode: assignMode, assigned_student_usernames: assignMode === 'selected' ? selectedUsernames : undefined,
      });
      showToast('Test updated.', 'success');
      onSaved(updated);
      onClose();
    } catch (err2) {
      setError(err2.message || 'Could not save these changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit — ${test.title}`}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Year ${s.year}` : ''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting date" type="date" value={startDate} onChange={setStartDate} />
          <Field label="Starting time" type="time" value={startClock} onChange={setStartClock} />
          <Field label="Ending date" type="date" value={endDate} onChange={setEndDate} />
          <Field label="Ending time" type="time" value={endClock} onChange={setEndClock} />
        </div>
        {durationMinutes ? <p className="text-xs text-ink-light">Duration: {formatDurationLabel(durationMinutes)}</p> : null}

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Select Students</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAssignMode('all')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${assignMode === 'all' ? 'border-hero-primary bg-hero-primary/10 text-hero-primary' : 'border-line text-ink-light hover:bg-paper'}`}>
              All Students
            </button>
            <button type="button" onClick={() => setAssignMode('selected')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${assignMode === 'selected' ? 'border-hero-primary bg-hero-primary/10 text-hero-primary' : 'border-line text-ink-light hover:bg-paper'}`}>
              Select Students {assignMode === 'selected' && selectedUsernames.length > 0 ? `(${selectedUsernames.length})` : ''}
            </button>
          </div>
          {assignMode === 'selected' && (
            <div className="mt-2 rounded-lg border border-line p-2">
              <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search by name or roll number…" className="mb-2 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs" />
              <div className="mb-2 flex gap-2 text-[11px]">
                <button type="button" className="font-semibold text-teal hover:underline" onClick={() => setSelectedUsernames(sectionStudents.filter((s) => s.section_id === sectionId).map((s) => s.username))}>Select all</button>
                <button type="button" className="font-semibold text-ink-light hover:underline" onClick={() => setSelectedUsernames([])}>Clear selection</button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {sectionStudents
                  .filter((s) => s.section_id === sectionId)
                  .filter((s) => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.roll_number || '').toLowerCase().includes(studentSearch.toLowerCase()))
                  .map((s) => {
                    const checked = selectedUsernames.includes(s.username);
                    return (
                      <label key={s.username} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-paper">
                        <input type="checkbox" checked={checked} onChange={() => setSelectedUsernames((prev) => (checked ? prev.filter((u) => u !== s.username) : [...prev, s.username]))} />
                        <span className="font-semibold text-ink">{s.name}</span>
                        <span className="text-ink-light">{s.roll_number}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-ink">{setsMode ? 'Sets' : 'Questions'}</label>
            {!setsMode && (
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setQuestions((prev) => [...prev, blankMcq()])} className="font-semibold text-teal hover:underline">+ MCQ</button>
                <button type="button" onClick={() => setQuestions((prev) => [...prev, blankTheory()])} className="font-semibold text-teal hover:underline">+ Theory</button>
                <button type="button" onClick={() => setQuestions((prev) => [...prev, blankCode()])} className="font-semibold text-teal hover:underline">+ Code</button>
              </div>
            )}
          </div>
          {setsMode ? (
            <SetsEditor sets={sets} setSets={setSets} />
          ) : (
            <QuestionsEditor
              questions={questions} updateQuestion={updateQuestion} updateOption={updateOption} addOption={addOption}
              removeOption={removeOption} removeQuestion={removeQuestion} updateTestCase={updateTestCase}
              addTestCase={addTestCase} removeTestCase={removeTestCase} setQuestions={setQuestions}
            />
          )}
        </div>

        {error && <p className="text-xs font-semibold text-crimson">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-lg border border-line py-2.5 text-sm font-bold text-ink">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResultsModal({ testId, onClose, onGraded }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gradingSubId, setGradingSubId] = useState(null);
  const [rejoinRequests, setRejoinRequests] = useState([]);
  const [liveStatus, setLiveStatus] = useState([]);
  const [decidingId, setDecidingId] = useState(null);

  const load = () => {
    if (!testId) return;
    setLoading(true);
    fetchTestResults(testId).then(setData).catch((err) => showToast(err.message || 'Could not load results.', 'error')).finally(() => setLoading(false));
    fetchRejoinRequests(testId).then(setRejoinRequests).catch(() => {});
    fetchTestLiveStatus(testId).then(setLiveStatus).catch(() => {});
  };
  useEffect(load, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Faculty/HOD Test Monitoring (item 13) — WebSocket push: test_live and
  // test_rejoin rooms tell this panel to refetch the moment a student
  // joins/submits or a rejoin request is filed/decided (see
  // broadcastToRoom calls in server.js). The 8s poll below is
  // intentionally KEPT as a fallback for the same reason as
  // Leaderboard.jsx's — a socket can silently fail to connect on some
  // networks, and a live monitoring panel is exactly the screen where
  // "silently stale" would be worst, so it's never allowed to depend on
  // the socket alone.
  useEffect(() => {
    if (!testId) return undefined;
    const unsubLive = subscribeRealtime(`test_live:${testId}`, () => fetchTestLiveStatus(testId).then(setLiveStatus).catch(() => {}));
    const unsubRejoin = subscribeRealtime(`test_rejoin:${testId}`, () => fetchRejoinRequests(testId).then(setRejoinRequests).catch(() => {}));
    return () => { unsubLive(); unsubRejoin(); };
  }, [testId]);

  useEffect(() => {
    if (!testId) return;
    const id = setInterval(() => {
      fetchTestLiveStatus(testId).then(setLiveStatus).catch(() => {});
      fetchRejoinRequests(testId).then(setRejoinRequests).catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [testId]);

  const handleRejoinDecision = async (reqId, action) => {
    setDecidingId(reqId);
    try {
      await decideRejoinRequest(testId, reqId, action);
      showToast(action === 'accept' ? 'Rejoin approved.' : 'Rejoin denied.', 'success');
      fetchRejoinRequests(testId).then(setRejoinRequests).catch(() => {});
    } catch (err) {
      showToast(err.message || 'Could not process this request.', 'error');
    } finally {
      setDecidingId(null);
    }
  };

  if (!testId) return null;

  const STATUS_LABEL = { writing: 'Writing', submitted: 'Submitted', auto_submitted: 'Auto-submitted', time_up: 'Time up' };
  const STATUS_COLOR = { writing: 'text-teal', submitted: 'text-ink-light', auto_submitted: 'text-crimson', time_up: 'text-gold' };

  return (
    <Modal open onClose={onClose} title={data?.test?.title ? `Results — ${data.test.title}` : 'Results'}>
      {loading || !data ? (
        <LoadingSpinner label="Loading…" />
      ) : (
        <div className="space-y-5">
          {/* Live monitoring (item 13) */}
          {liveStatus.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">🔴 Currently in this test</h3>
              <div className="space-y-1.5">
                {liveStatus.map((s) => (
                  <div key={s.student_username} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-xs">
                    <span className="font-semibold text-ink">{s.student_username}</span>
                    <span className={`font-bold ${STATUS_COLOR[s.status] || 'text-ink-light'}`}>{STATUS_LABEL[s.status] || s.status}</span>
                    {s.status === 'writing' && <span className="font-mono text-ink-light">{Math.floor(s.seconds_left / 60)}m {s.seconds_left % 60}s left</span>}
                    {s.rejoin_requests?.pending > 0 && <span className="font-bold text-gold">{s.rejoin_requests.pending} pending rejoin</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejoin Requests (item 9) */}
          {rejoinRequests.length > 0 && (
            <div className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">🔁 Rejoin requests</h3>
              <div className="space-y-2">
                {rejoinRequests.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{r.student_name}</span>
                      <span className={`font-bold ${r.status === 'pending' ? 'text-gold' : r.status === 'accepted' ? 'text-teal' : 'text-crimson'}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.reason && <p className="mt-1 text-ink-light">"{r.reason}"</p>}
                    <p className="mt-1 text-[10px] text-ink-light">{new Date(r.requested_at).toLocaleString()}</p>
                    {r.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={decidingId === r.id} onClick={() => handleRejoinDecision(r.id, 'accept')} className="rounded-full bg-teal px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50">
                          Accept
                        </button>
                        <button type="button" disabled={decidingId === r.id} onClick={() => handleRejoinDecision(r.id, 'reject')} className="rounded-full border border-line px-3 py-1 text-[11px] font-bold text-ink disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* item 26: Faculty Set Assignment View — lets faculty verify the
              automatic random distribution across sets at a glance. Only
              present for a sets test (data.set_assignments is null
              otherwise). */}
          {data.set_assignments && data.set_assignments.length > 0 && (
            <div className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">🎲 Set assignment</h3>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-paper text-left uppercase text-ink-light">
                    <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Roll No.</th><th className="px-3 py-2">Set</th><th className="px-3 py-2">Score</th></tr>
                  </thead>
                  <tbody>
                    {data.set_assignments.map((sa) => (
                      <tr key={sa.username} className="border-t border-line">
                        <td className="px-3 py-2">{sa.name}</td>
                        <td className="px-3 py-2 font-mono">{sa.roll_number}</td>
                        <td className="px-3 py-2 font-semibold">{sa.set_name}</td>
                        <td className="px-3 py-2">{sa.submitted ? sa.score : <span className="text-ink-light">Not submitted</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {data.submissions.length === 0 ? (
            <p className="text-sm text-ink-light">No accepted submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {data.submissions.map((s) => (
                <div key={s.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{s.student_name}</span>
                    <span className="text-sm font-bold text-teal">{s.score} / {s.total_marks}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-light">
                    {s.set_name && <span className="font-semibold text-ink-light">Set: {s.set_name}</span>}
                    {!s.fully_graded && <span className="font-semibold text-gold">Needs grading</span>}
                    {s.submission_reason === 'tab_switch' && (
                      <span className="font-semibold text-crimson" title="Automatically submitted after the student switched away from the test tab.">
                        ⚠️ Submitted — Tab Switch
                      </span>
                    )}
                    <span>Submitted {new Date(s.submitted_at).toLocaleString()}</span>
                  </div>
                  {!s.fully_graded && (
                    <button type="button" onClick={() => setGradingSubId(gradingSubId === s.id ? null : s.id)} className="mt-2 text-xs font-semibold text-teal hover:underline">
                      {gradingSubId === s.id ? 'Close' : 'Grade theory answers'}
                    </button>
                  )}
                  {gradingSubId === s.id && (
                    <GradeForm test={data.test} submission={s} onGraded={() => { load(); onGraded(); }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {data.test.has_code && (
            <div className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">Code test attempts</h3>
              <p className="mb-2 text-[11px] text-ink-light">Every run is logged with its time, including solutions that didn't pass and were never accepted.</p>
              {(!data.code_attempts || data.code_attempts.length === 0) ? (
                <p className="text-sm text-ink-light">No code attempts yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.code_attempts.map((a) => {
                    return (
                      <div key={a.id} className="rounded-lg border border-line p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-ink">{a.student_name} · {a.question_text}</span>
                          <span className={`font-bold ${a.passed ? 'text-teal' : 'text-crimson'}`}>{a.passed ? 'Passed' : 'Rejected'}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-light">
                          <span className="capitalize">{a.language}</span>
                          <span>{new Date(a.attempted_at).toLocaleString()}</span>
                          <span>{a.final ? 'Submit attempt' : 'Test run'}</span>
                          <span>{(a.results || []).filter((r) => r.passed).length}/{(a.results || []).length} test cases passed</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab/page-switch monitoring log — never affects a student's
              submission (see TestAttempt.jsx); this is purely a record of
              when a student left the test page, for the faculty responsible
              for this test/section to review. */}
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">⚠️ Tab / page-switch activity</h3>
            {(!data.activity_log || data.activity_log.length === 0) ? (
              <p className="text-sm text-ink-light">No tab-switching or page-switching detected during this test.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.activity_counts || {}).map(([username, count]) => {
                    const name = data.activity_log.find((a) => a.student_username === username)?.student_name || username;
                    return (
                      <span key={username} className="rounded-full bg-crimson/10 px-2.5 py-1 text-[11px] font-bold text-crimson">
                        {name} · {count} occurrence{count === 1 ? '' : 's'}
                      </span>
                    );
                  })}
                </div>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {data.activity_log.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-crimson/20 bg-crimson/5 px-3 py-1.5 text-xs">
                      <span className="font-semibold text-ink">{a.student_name}</span>
                      <span className="text-ink-light">
                        {a.event_type === 'tab_switch_auto_submit' ? 'switched away — test auto-submitted' : 'switched away from the test page'}
                      </span>
                      <span className="font-mono text-[11px] text-ink-light">{new Date(a.occurred_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function GradeForm({ test, submission, onGraded }) {
  const { showToast } = useToast();
  const theoryAnswers = submission.answers.filter((a) => a.type === 'theory');
  const [scores, setScores] = useState(Object.fromEntries(theoryAnswers.map((a) => [a.question_id, a.score ?? 0])));
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await gradeSubmission(test.id, submission.id, scores);
      showToast('Grades saved.', 'success');
      onGraded();
    } catch (err) {
      showToast(err.message || 'Could not save grades.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {theoryAnswers.map((a) => {
        const q = submission.questions.find((qq) => qq.id === a.question_id);
        return (
          <div key={a.question_id}>
            <p className="text-xs font-semibold text-ink-light">{q?.text}</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-paper p-2 text-sm text-ink">{a.answer_text || '(no answer)'}</p>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number" min={0} max={q?.marks || 0}
                value={scores[a.question_id]}
                onChange={(e) => setScores((s) => ({ ...s, [a.question_id]: Number(e.target.value) }))}
                className="w-20 rounded-lg border border-line bg-paper px-2 py-1 text-sm"
              />
              <span className="text-xs text-ink-light">/ {q?.marks} marks</span>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={handleSave} disabled={submitting} className="rounded-lg bg-teal px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {submitting ? 'Saving…' : 'Save grades'}
      </button>
    </div>
  );
}
