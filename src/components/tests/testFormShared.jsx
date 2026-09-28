// Shared building blocks for the test create/edit forms — used by both
// FacultyTests.jsx (faculty's own tests) and HodTests.jsx (HOD's own
// tests + saved-test templates). Factored out here so the two forms can
// never drift apart in how a question or a schedule is represented; a fix
// or a new question type only needs to happen once.
import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';

let qIdCounter = 0;

// item 4: "current/present date" and "current/present time", read fresh
// every time it's called (never hard-coded) — used to default the Create
// Test date/time fields the moment the modal opens.
// Item 3 (Year + Section): sections carry a `year` field from the backend
// (see /api/hod/sections), but several views here only ever rendered
// `s.name` ("A"), leaving Year 1 Section A indistinguishable from Year 3
// Section A. This is the single place both the dropdown and the preview
// below source their label from, so fixing it here fixes both.
export function sectionLabel(s) {
  if (!s) return '—';
  return s.year ? `${s.year} - ${s.name}` : s.name;
}

export function nowLocalDateTimeParts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export const blankMcq = () => ({ _key: ++qIdCounter, type: 'mcq', text: '', marks: 1, options: ['', ''], correct_index: 0 });
export const blankTheory = () => ({ _key: ++qIdCounter, type: 'theory', text: '', marks: 1 });
export const blankCode = () => ({ _key: ++qIdCounter, type: 'code', text: '', marks: 5, language: 'python', starter_code: '', test_cases: [{ input: '', expected_output: '' }] });
// Saved Test / Use Again / Use This Test prefill: a stored question (plain,
// no _key) becomes an editable question row the same shape blank*()
// produce, so the same QuestionsEditor works whether the questions came
// from scratch or from a template.
export const questionFromStored = (q) => ({ ...q, _key: ++qIdCounter });

// Reusable question-array handlers — same shape used by every create/edit
// form and the Saved Test editor, so editing a template and editing a
// from-scratch test work identically everywhere.
export function useQuestionHandlers(setQuestions) {
  const updateQuestion = (key, patch) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, ...patch } : q)));
  const updateOption = (key, i, value) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, options: q.options.map((o, oi) => (oi === i ? value : o)) } : q)));
  const addOption = (key) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, options: [...q.options, ''] } : q)));
  const removeOption = (key, i) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, options: q.options.filter((_, oi) => oi !== i), correct_index: q.correct_index === i ? 0 : q.correct_index } : q)));
  const removeQuestion = (key) => setQuestions((prev) => prev.filter((q) => q._key !== key));
  const updateTestCase = (key, i, patch) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, test_cases: q.test_cases.map((tc, ti) => (ti === i ? { ...tc, ...patch } : tc)) } : q)));
  const addTestCase = (key) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, test_cases: [...q.test_cases, { input: '', expected_output: '' }] } : q)));
  const removeTestCase = (key, i) => setQuestions((prev) => prev.map((q) => (q._key === key ? { ...q, test_cases: q.test_cases.filter((_, ti) => ti !== i) } : q)));
  return { updateQuestion, updateOption, addOption, removeOption, removeQuestion, updateTestCase, addTestCase, removeTestCase };
}

export function QuestionsEditor({ questions, updateQuestion, updateOption, addOption, removeOption, removeQuestion, updateTestCase, addTestCase, removeTestCase, setQuestions }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={q._key} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-light">Question {i + 1}</span>
            <div className="flex items-center gap-2">
              <select value={q.type} onChange={(e) => updateQuestion(q._key, { type: e.target.value })} className="rounded-lg border border-line bg-paper px-2 py-1 text-xs">
                <option value="mcq">Multiple choice</option>
                <option value="theory">Theory / long answer</option>
                <option value="code">Code test</option>
              </select>
              <input type="number" min={1} value={q.marks} onChange={(e) => updateQuestion(q._key, { marks: Number(e.target.value) })} className="w-14 rounded-lg border border-line bg-paper px-2 py-1 text-xs" />
              <button type="button" onClick={() => removeQuestion(q._key)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
            </div>
          </div>
          <textarea rows={2} value={q.text} onChange={(e) => updateQuestion(q._key, { text: e.target.value })} placeholder="Question text" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          {q.type === 'mcq' && (
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" checked={q.correct_index === oi} onChange={() => updateQuestion(q._key, { correct_index: oi })} />
                  <input value={opt} onChange={(e) => updateOption(q._key, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className="flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" />
                  {q.options.length > 2 && <button type="button" onClick={() => removeOption(q._key, oi)} className="text-xs text-crimson">✕</button>}
                </div>
              ))}
              <button type="button" onClick={() => addOption(q._key)} className="text-xs font-semibold text-teal hover:underline">+ Add option</button>
            </div>
          )}
          {q.type === 'code' && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Language (fixed for this question)</label>
                <select value={q.language} onChange={(e) => updateQuestion(q._key, { language: e.target.value })} className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm">
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="c">C</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Starter code (optional)</label>
                <textarea
                  rows={3}
                  value={q.starter_code}
                  onChange={(e) => updateQuestion(q._key, { starter_code: e.target.value })}
                  placeholder="Code shown to the student when they open the question…"
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Test cases (input → expected output)</label>
                <p className="mb-2 text-[11px] text-ink-light">A student's solution must match every expected output exactly (after trimming whitespace) to be accepted.</p>
                <div className="space-y-2">
                  {q.test_cases.map((tc, ti) => (
                    <div key={ti} className="flex items-start gap-2 rounded-lg border border-line p-2">
                      <div className="flex-1 space-y-1">
                        <textarea
                          rows={2}
                          value={tc.input}
                          onChange={(e) => updateTestCase(q._key, ti, { input: e.target.value })}
                          placeholder="Input (stdin) — leave blank if none"
                          className="w-full rounded-lg border border-line bg-paper px-2 py-1 font-mono text-xs"
                        />
                        <textarea
                          rows={2}
                          value={tc.expected_output}
                          onChange={(e) => updateTestCase(q._key, ti, { expected_output: e.target.value })}
                          placeholder="Expected output"
                          className="w-full rounded-lg border border-line bg-paper px-2 py-1 font-mono text-xs"
                        />
                      </div>
                      {q.test_cases.length > 1 && (
                        <button type="button" onClick={() => removeTestCase(q._key, ti)} className="text-xs text-crimson">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addTestCase(q._key)} className="mt-2 text-xs font-semibold text-teal hover:underline">+ Add test case</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-3">
        <button type="button" onClick={() => setQuestions((prev) => [...prev, blankMcq()])} className="text-xs font-semibold text-teal hover:underline">+ Add MCQ</button>
        <button type="button" onClick={() => setQuestions((prev) => [...prev, blankTheory()])} className="text-xs font-semibold text-teal hover:underline">+ Add theory question</button>
        <button type="button" onClick={() => setQuestions((prev) => [...prev, blankCode()])} className="text-xs font-semibold text-teal hover:underline">+ Add code test</button>
      </div>
    </div>
  );
}

export const blankSet = (name) => ({ _key: ++qIdCounter, name, questions: [blankMcq()] });

// items 19-26: Multiple Question Sets editor. Each set gets its own name
// and its own independent QuestionsEditor — reusing the exact same
// useQuestionHandlers/QuestionsEditor building blocks a single-list test
// uses, just once per set, so set-editing behaves identically to normal
// question-editing in every other respect (add/remove/reorder question
// types, MCQ options, code test cases). At least 2 sets are required
// (enforced here and again server-side); removing a set below 2 is
// blocked so a test never accidentally drops back to being un-set-able.
export function SetsEditor({ sets, setSets }) {
  const updateSetName = (key, name) => setSets((prev) => prev.map((s) => (s._key === key ? { ...s, name } : s)));
  const removeSet = (key) => {
    if (sets.length <= 2) return;
    setSets((prev) => prev.filter((s) => s._key !== key));
  };
  const addSet = () => setSets((prev) => [...prev, blankSet(`Set ${prev.length + 1}`)]);
  const setQuestionsFor = (key) => (updater) =>
    setSets((prev) => prev.map((s) => (s._key === key ? { ...s, questions: typeof updater === 'function' ? updater(s.questions) : updater } : s)));

  return (
    <div className="space-y-4">
      {sets.map((s, i) => {
        const handlers = useQuestionHandlers(setQuestionsFor(s._key)); // eslint-disable-line react-hooks/rules-of-hooks
        return (
          <div key={s._key} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={s.name} onChange={(e) => updateSetName(s._key, e.target.value)}
                placeholder={`Set ${i + 1} name`}
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold"
              />
              <span className="text-xs text-ink-light">{s.questions.length} question{s.questions.length === 1 ? '' : 's'}</span>
              {sets.length > 2 && (
                <button type="button" onClick={() => removeSet(s._key)} className="text-xs font-semibold text-crimson hover:underline">Remove set</button>
              )}
            </div>
            <QuestionsEditor questions={s.questions} setQuestions={setQuestionsFor(s._key)} {...handlers} />
          </div>
        );
      })}
      <button type="button" onClick={addSet} className="text-xs font-semibold text-teal hover:underline">+ Add another set</button>
    </div>
  );
}

export function computeDurationMinutes(startLocal, endLocal) {
  if (!startLocal || !endLocal) return null;
  const start = new Date(startLocal).getTime();
  const end = new Date(endLocal).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}
export function formatDurationLabel(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

// Fixed Date + Test Duration scheduling. The caller picks one start moment
// and a duration preset; the end time is derived automatically (e.g. a
// 3:00 PM start + "1 hour" duration ends at 4:00 PM). Values are minutes.
export const DURATION_PRESETS = [
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1 hour 30 minutes', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
];
// "YYYY-MM-DDTHH:MM" (local, no timezone suffix) + minutes -> the same
// shaped local datetime string, so it composes with computeDurationMinutes
// and the rest of the form exactly like a hand-picked end time would.
export function addMinutesToLocal(startLocal, minutes) {
  if (!startLocal || !minutes) return '';
  const d = new Date(startLocal);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return 'now';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    </div>
  );
}

// ===========================================================================
// TestCreateModal — the ONE Create Test form, used as-is by both Faculty
// (FacultyTests.jsx) and HOD (HodTests.jsx). Item 3 requires HOD's test
// creation to "remain exactly like the existing Faculty test creation
// interface" — same fields, question types, scheduling modes, assignment,
// preview step, and Save Test behaviour — rather than a separate simplified
// system, so this single component is shared instead of being copied.
// `fetchSections`/`fetchStudents`/`createTestFn`/`saveTemplateFn` are the
// only things that differ between the two callers (their own scoped API
// calls); everything else — every field, every validation rule, every
// pixel of UI — is identical for Faculty and HOD.
// ===========================================================================
// `initialMode` ('normal' | 'set') is set by the two distinct "+ Normal
// Test" / "+ Set Test" entry points (FacultyTests.jsx / HodTests.jsx) — the
// choice is made BEFORE this form opens, so there is no in-form toggle to
// second-guess it afterward. A `prefill` (Saved Tests "Use Again") instead
// carries its own type forward from the source test, same as before.
export function TestCreateModal({ open, prefill, initialMode = 'normal', onClose, onCreated, fetchSections, fetchStudents, createTestFn, saveTemplateFn }) {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Advanced Test Scheduling — 'window' keeps the original start+end date/
  // time fields exactly as they always worked (Option A); 'duration' is
  // Option B (fixed date + duration preset, end time computed for you);
  // 'range' is Option C — Fixed Date Range + Individual Test Duration: a
  // start date/time, an end DATE (availability window), and a duration that
  // every student gets individually, counted from their own actual start.
  const [scheduleMode, setScheduleMode] = useState('window');
  const [startDate, setStartDate] = useState('');
  const [startClock, setStartClock] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endClock, setEndClock] = useState('');
  const [durationDate, setDurationDate] = useState('');
  const [durationClock, setDurationClock] = useState('');
  const [durationPreset, setDurationPreset] = useState(60);
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeStartClock, setRangeStartClock] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeDurationPreset, setRangeDurationPreset] = useState(60);
  const [questions, setQuestions] = useState([blankMcq()]);
  // items 19-26: Multiple Question Sets — mutually exclusive with the plain
  // `questions` list above. `sets` always holds at least 2 entries so
  // there's a sane starting point the moment Sets Mode is turned on.
  const [setsMode, setSetsMode] = useState(false);
  const [sets, setSets] = useState([blankSet('Set 1'), blankSet('Set 2')]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('edit'); // 'edit' | 'preview'
  // Student Selection / Test Assignment — defaults to "All Students";
  // switching to "Select Students" loads this section's roster for a
  // searchable pick list.
  const [assignMode, setAssignMode] = useState('all'); // 'all' | 'selected'
  const [sectionStudents, setSectionStudents] = useState([]);
  const [selectedUsernames, setSelectedUsernames] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Starting date, starting time, ending date, and ending time as four
  // separate fields (Option A); these two combined "YYYY-MM-DDTHH:MM"
  // strings are what the rest of this form (duration calc, preview, submit)
  // works with, same as a single datetime-local field would.
  const windowStartTime = startDate && startClock ? `${startDate}T${startClock}` : '';
  const windowEndTime = endDate && endClock ? `${endDate}T${endClock}` : '';

  // Option B: a single start moment (date + time) plus a duration preset —
  // the end time is always derived, never entered directly.
  const durationStartTime = durationDate && durationClock ? `${durationDate}T${durationClock}` : '';
  const durationEndTime = addMinutesToLocal(durationStartTime, durationPreset);

  // Option C — Fixed Date Range + Individual Test Duration: the ending date
  // marks the END of the availability window (11:59 PM that day), completely
  // independent of the duration — every student who starts gets the full
  // duration individually, capped only by this window's end.
  const rangeStartTime = rangeStartDate && rangeStartClock ? `${rangeStartDate}T${rangeStartClock}` : '';
  const rangeEndTime = rangeEndDate ? `${rangeEndDate}T23:59` : '';

  // Whichever scheduling method is active resolves to the same
  // start/end/duration trio the rest of the form (preview, validation,
  // submit) already knows how to work with.
  const startTime = scheduleMode === 'duration' ? durationStartTime : scheduleMode === 'range' ? rangeStartTime : windowStartTime;
  const endTime = scheduleMode === 'duration' ? durationEndTime : scheduleMode === 'range' ? rangeEndTime : windowEndTime;
  const durationMinutes = scheduleMode === 'duration'
    ? (durationStartTime ? durationPreset : null)
    : scheduleMode === 'range'
    ? (rangeStartTime && rangeEndTime ? rangeDurationPreset : null)
    : computeDurationMinutes(windowStartTime, windowEndTime);

  useEffect(() => {
    if (!open) return;
    setStep('edit');
    fetchSections().then((secs) => { setSections(secs); if (secs[0]) setSectionId(secs[0].id); }).catch(() => {});
    fetchStudents().then(setSectionStudents).catch(() => {});
    setAssignMode('all'); setSelectedUsernames([]); setStudentSearch('');
    // item 4: every scheduling mode's date/time defaults to the current/
    // present date & time the moment the modal opens — never hard-coded —
    // while still leaving every field freely editable before publishing.
    const now = nowLocalDateTimeParts();
    setStartDate(now.date); setStartClock(now.time);
    setEndDate(''); setEndClock('');
    setDurationDate(now.date); setDurationClock(now.time);
    setRangeStartDate(now.date); setRangeStartClock(now.time); setRangeEndDate('');
    setScheduleMode('window');
    // "Use Again" from a Saved Test: prefill the same questions/title/
    // subject/duration. Section and other scheduling are left for
    // Faculty/HOD to choose fresh — nothing is auto-assigned or
    // auto-scheduled from the template. A saved template CAN itself be a
    // sets test (SavedTests copies `sets` alongside `questions` when the
    // source test had them — see saveTestTemplate/saveHodTestTemplate on
    // the backend), so this has to branch the same way test.sets does
    // everywhere else, not assume `questions` is always populated.
    if (prefill) {
      setTitle(prefill.title);
      setSubject(prefill.subject);
      setDescription(prefill.description || '');
      if (prefill.sets) {
        setSetsMode(true);
        setSets(prefill.sets.map((s) => ({ ...questionFromStored({}), name: s.name, questions: s.questions.map(questionFromStored) })));
        setQuestions([blankMcq()]);
      } else {
        setSetsMode(false);
        setQuestions((prefill.questions || []).map(questionFromStored));
        setSets([blankSet('Set 1'), blankSet('Set 2')]);
      }
      const preset = DURATION_PRESETS.find((p) => p.minutes === prefill.duration_minutes);
      if (preset) setDurationPreset(preset.minutes);
    } else {
      setTitle(''); setSubject(''); setDescription(''); setQuestions([blankMcq()]);
      setSetsMode(initialMode === 'set');
      setSets([blankSet('Set 1'), blankSet('Set 2')]);
    }
  }, [open, prefill, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const { updateQuestion, updateOption, addOption, removeOption, removeQuestion, updateTestCase, addTestCase, removeTestCase } = useQuestionHandlers(setQuestions);

  const validate = () => {
    if (!title.trim() || !sectionId) return 'Title and section are required.';
    if (setsMode) {
      if (sets.length < 2) return 'Add at least 2 sets.';
      for (const s of sets) {
        if (!s.name.trim()) return 'Every set needs a name.';
        if (s.questions.length === 0) return `Set "${s.name}" needs at least one question.`;
      }
    } else if (questions.length === 0) {
      return 'Add at least one question.';
    }
    if (scheduleMode === 'duration') {
      if (!durationDate || !durationClock) return 'Test date and start time are required.';
      if (!durationPreset) return 'Choose a test duration.';
    } else if (scheduleMode === 'range') {
      if (!rangeStartDate || !rangeStartClock || !rangeEndDate) return 'Starting date, starting time, and ending date are all required.';
      if (!rangeDurationPreset) return 'Choose a test duration.';
      if (new Date(rangeEndTime).getTime() <= new Date(rangeStartTime).getTime()) return 'Ending date must be on or after the starting date.';
    } else {
      if (!startDate || !startClock || !endDate || !endClock) return 'Starting date, starting time, ending date, and ending time are all required.';
      if (!durationMinutes) return 'Ending date/time must be after starting date/time.';
    }
    return '';
  };

  // "Save Test" — available whether the test is still a draft or already
  // published: snapshots the current question paper into Saved Tests as
  // its own independent template. This never publishes/creates a
  // Conducted Test and never touches one that already exists.
  // `templateToken` makes an accidental double-click safe: it's reused for
  // the life of this open modal, so a second click for the same draft
  // returns the same saved row instead of inserting a duplicate.
  const [templateToken] = useState(() => `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const handleSaveTemplate = async () => {
    if (setsMode) { setError('Save Test (template) is not available for a Sets-mode test yet — publish it directly instead.'); return; }
    if (!title.trim() || questions.length === 0) { setError('Add a title and at least one question before saving.'); return; }
    if (savingTemplate) return;
    setSavingTemplate(true);
    try {
      await saveTemplateFn({
        title, subject: subject || 'General', description,
        duration_minutes: durationMinutes || 20,
        questions: questions.map(({ _key, ...q }) => q),
        client_token: templateToken,
      });
      showToast('Saved to Saved Tests.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save this test as a template.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleContinueToPreview = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep('preview');
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); setStep('edit'); return; }
    setSubmitting(true);
    setError('');
    try {
      const test = await createTestFn({
        title, subject: subject || 'General', section_id: sectionId,
        duration_minutes: durationMinutes, schedule_mode: scheduleMode,
        start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(),
        // items 19-26: `sets` (mutually exclusive with `questions`) — each
        // set's own question list goes through the same _key stripping a
        // plain question list already does.
        ...(setsMode
          ? { sets: sets.map((s) => ({ name: s.name, questions: s.questions.map(({ _key, ...q }) => q) })) }
          : { questions: questions.map(({ _key, ...q }) => q) }),
        assign_mode: assignMode, assigned_student_usernames: assignMode === 'selected' ? selectedUsernames : undefined,
      });
      onCreated(test);
      showToast('Test created.', 'success');
      setTitle(''); setDescription(''); setSubject(''); setStartDate(''); setStartClock(''); setEndDate(''); setEndClock('');
      setDurationDate(''); setDurationClock(''); setDurationPreset(60);
      setRangeStartDate(''); setRangeStartClock(''); setRangeEndDate(''); setRangeDurationPreset(60);
      setScheduleMode('window'); setQuestions([blankMcq()]);
      setSetsMode(false); setSets([blankSet('Set 1'), blankSet('Set 2')]);
      setAssignMode('all'); setSelectedUsernames([]);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create this test.');
      setStep('edit');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'preview') {
    const selectedSection = sections.find((s) => s.id === sectionId);
    return (
      <Modal open={open} onClose={onClose} fullScreen title={setsMode ? 'Preview Set Test' : 'Preview test'}>
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-paper p-4">
            <h3 className="text-base font-bold text-ink">{title || 'Untitled test'}</h3>
            {description && <p className="mt-1 text-sm text-ink-light">{description}</p>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-light">
              <span><span className="font-semibold text-ink">Subject:</span> {subject || 'General'}</span>
              <span><span className="font-semibold text-ink">Section:</span> {sectionLabel(selectedSection)}</span>
              {setsMode ? (
                <span><span className="font-semibold text-ink">Sets:</span> {sets.map((s) => s.name).join(', ')}</span>
              ) : (
                <>
                  <span><span className="font-semibold text-ink">Questions:</span> {questions.length}</span>
                  <span><span className="font-semibold text-ink">Total marks:</span> {questions.reduce((s, q) => s + (Number(q.marks) || 0), 0)}</span>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-light">
              <span><span className="font-semibold text-ink">Scheduling:</span> {scheduleMode === 'duration' ? 'Fixed date + duration' : scheduleMode === 'range' ? 'Fixed date range + individual duration' : 'Fixed start & end time'}</span>
              <span><span className="font-semibold text-ink">{scheduleMode === 'range' ? 'Window opens:' : 'Start:'}</span> {startTime ? new Date(startTime).toLocaleString() : '—'}</span>
              <span><span className="font-semibold text-ink">{scheduleMode === 'range' ? 'Window closes:' : 'End:'}</span> {endTime ? new Date(endTime).toLocaleString() : '—'}</span>
              <span><span className="font-semibold text-ink">{scheduleMode === 'range' ? 'Duration per student:' : 'Duration:'}</span> {formatDurationLabel(durationMinutes)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {setsMode ? (
              // items 21-26: preview makes clear each set's students are
              // decided by a random, balanced, persistent assignment
              // computed automatically at publish time — never roll-number
              // order, and never something the faculty picks per-student.
              <>
                <p className="rounded-lg bg-teal/10 px-3 py-2 text-xs font-semibold text-teal">
                  Students in this section will be randomly and evenly split across these {sets.length} sets the moment this test is published. Each student keeps their assigned set for the whole test — this can't be changed afterward.
                </p>
                {sets.map((s) => (
                  <div key={s._key} className="rounded-lg border border-line p-3">
                    <div className="mb-1 text-xs font-bold text-ink-light">{s.name} · {s.questions.length} question{s.questions.length === 1 ? '' : 's'} · {s.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)} marks</div>
                    <ul className="space-y-0.5 text-xs text-ink-light">
                      {s.questions.map((q, i) => <li key={q._key}>{i + 1}. {q.text || <span className="italic">No question text</span>}</li>)}
                    </ul>
                  </div>
                ))}
              </>
            ) : questions.map((q, i) => (
              <div key={q._key} className="rounded-lg border border-line p-3">
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-ink-light">
                  <span>Question {i + 1} · {q.type === 'mcq' ? 'Multiple choice' : q.type === 'code' ? 'Coding' : 'Theory'}</span>
                  <span>{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                </div>
                <p className="text-sm text-ink">{q.text || <span className="italic text-ink-light">No question text</span>}</p>
                {q.type === 'mcq' && (
                  <ul className="mt-2 space-y-1 text-xs text-ink-light">
                    {q.options.map((opt, oi) => (
                      <li key={oi} className={oi === q.correct_index ? 'font-semibold text-teal' : ''}>
                        {oi === q.correct_index ? '✓ ' : '· '}{opt || `Option ${oi + 1}`}
                      </li>
                    ))}
                  </ul>
                )}
                {q.type === 'code' && (
                  <p className="mt-1 text-xs text-ink-light">
                    Language: <span className="font-semibold capitalize">{q.language}</span> · {q.test_cases.length} test case{q.test_cases.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep('edit')} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper">
              ← Back to edit
            </button>
            <button
              type="button" onClick={handleSaveTemplate} disabled={savingTemplate}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-60"
              title="Save this question paper to Saved Tests so you can reuse it later"
            >
              {savingTemplate ? 'Saving…' : '💾 Save Test'}
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? 'Publishing…' : 'Publish test'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} fullScreen title={prefill ? (setsMode ? 'Create Set Test' : 'Create test') : (initialMode === 'set' ? 'Create Set Test' : 'Create Normal Test')}>
      <form onSubmit={handleContinueToPreview} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" value={title} onChange={setTitle} />
          <Field label="Subject" value={subject} onChange={setSubject} placeholder="General" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Description (optional)</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this test covers…" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
          </select>
        </div>

        {/* Student Selection / Test Assignment */}
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
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or roll number…"
                className="mb-2 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs"
              />
              <div className="mb-2 flex gap-2 text-[11px]">
                <button type="button" className="font-semibold text-teal hover:underline" onClick={() => {
                  const inSection = sectionStudents.filter((s) => s.section_id === sectionId);
                  setSelectedUsernames(inSection.map((s) => s.username));
                }}>Select all</button>
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
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedUsernames((prev) => (checked ? prev.filter((u) => u !== s.username) : [...prev, s.username]))}
                        />
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
          <label className="mb-1 block text-xs font-semibold text-ink">Test scheduling</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('window')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                scheduleMode === 'window' ? 'border-hero-primary bg-hero-primary/10 text-hero-primary' : 'border-line text-ink-light hover:bg-paper'
              }`}
            >
              Fixed start &amp; end time
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('duration')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                scheduleMode === 'duration' ? 'border-hero-primary bg-hero-primary/10 text-hero-primary' : 'border-line text-ink-light hover:bg-paper'
              }`}
            >
              Fixed date + duration
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('range')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                scheduleMode === 'range' ? 'border-hero-primary bg-hero-primary/10 text-hero-primary' : 'border-line text-ink-light hover:bg-paper'
              }`}
            >
              Date range + individual duration
            </button>
          </div>
        </div>

        {scheduleMode === 'range' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting date" type="date" value={rangeStartDate} onChange={setRangeStartDate} />
              <Field label="Starting time" type="time" value={rangeStartClock} onChange={setRangeStartClock} />
            </div>
            <Field label="Ending date" type="date" value={rangeEndDate} onChange={setRangeEndDate} />
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Duration (given to every student individually)</label>
              <select
                value={rangeDurationPreset}
                onChange={(e) => setRangeDurationPreset(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
              >
                {DURATION_PRESETS.map((p) => <option key={p.minutes} value={p.minutes}>{p.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-ink-light">
              The test stays open to students from the starting date/time through 11:59 PM on the ending date. Each
              student who starts gets the full duration above, timed individually from the moment <em>they</em> begin
              — not from when the window opened. A student who starts late still can't run past the window's ending
              date/time.
            </p>
          </>
        ) : scheduleMode === 'window' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting date" type="date" value={startDate} onChange={setStartDate} />
              <Field label="Starting time" type="time" value={startClock} onChange={setStartClock} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ending date" type="date" value={endDate} onChange={setEndDate} />
              <Field label="Ending time" type="time" value={endClock} onChange={setEndClock} />
            </div>
            <p className="text-xs text-ink-light">
              Duration is calculated automatically from the window above: <span className="font-semibold text-ink">{formatDurationLabel(durationMinutes)}</span>.
              The test is only accessible to students between these times.
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Test date" type="date" value={durationDate} onChange={setDurationDate} />
              <Field label="Start time" type="time" value={durationClock} onChange={setDurationClock} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Duration</label>
              <select
                value={durationPreset}
                onChange={(e) => setDurationPreset(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
              >
                {DURATION_PRESETS.map((p) => <option key={p.minutes} value={p.minutes}>{p.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-ink-light">
              Ending time is calculated automatically:{' '}
              <span className="font-semibold text-ink">{endTime ? new Date(endTime).toLocaleString() : '—'}</span>.
              The test is only accessible to students between these times.
            </p>
          </>
        )}

        {/* Set Test is a distinct type chosen via the "+ Set Test" entry point
            before this form ever opens (see initialMode) — there's no
            toggle here to flip it mid-form, so a Normal Test can never
            accidentally end up with sets or vice versa. */}
        {setsMode ? (
          <div className="rounded-lg border border-teal/30 bg-teal/5 p-3">
            <p className="text-sm font-semibold text-teal">Set Test — Multiple Question Sets</p>
            <p className="text-xs text-ink-light">Each student is randomly, evenly assigned exactly one set and keeps that same set for the whole test.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-sm font-semibold text-ink">Normal Test</p>
            <p className="text-xs text-ink-light">One shared question list for every student.</p>
          </div>
        )}

        {setsMode ? (
          <SetsEditor sets={sets} setSets={setSets} />
        ) : (
          <QuestionsEditor
            questions={questions} setQuestions={setQuestions}
            updateQuestion={updateQuestion} updateOption={updateOption} addOption={addOption} removeOption={removeOption}
            removeQuestion={removeQuestion} updateTestCase={updateTestCase} addTestCase={addTestCase} removeTestCase={removeTestCase}
          />
        )}

        {error && <p className="text-xs text-crimson">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button" onClick={handleSaveTemplate} disabled={savingTemplate}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper disabled:opacity-60"
            title="Save this question paper to Saved Tests so you can reuse it later"
          >
            {savingTemplate ? 'Saving…' : '💾 Save Test'}
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white">
            Preview test →
          </button>
        </div>
      </form>
    </Modal>
  );
}
