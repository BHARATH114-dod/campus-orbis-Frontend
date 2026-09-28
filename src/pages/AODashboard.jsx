import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  fetchAoStudents, fetchAoSections, fetchAoStudent, updateAoStudent, updateAoStudentFees, createAoStudent,
  previewImportAoStudents, importAoStudents, studentImportTemplateUrl,
} from '../services/aoService';
import { ImportStudentsModal } from '../components/people/HodPeople';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PasswordField from '../components/common/PasswordField';

// item 1: only these four courses, each with its configured duration —
// never hard-coded per-course anywhere else in this file; every "final
// year -> Completed" / "years available for this course" check reads from
// this one map.
const COURSE_DURATIONS = { btech: 4, mtech: 2, degree: 3, diploma: 3 };
const COURSE_OPTIONS = [
  { value: 'btech', label: 'B.Tech' },
  { value: 'mtech', label: 'M.Tech' },
  { value: 'degree', label: 'Degree' },
  { value: 'diploma', label: 'Diploma' },
];
const CATEGORY_TABS = [
  { value: 'all', label: 'All Students' },
  { value: 'pending', label: 'Pending' },
];
const DEFAULT_FEE_TYPES = ['Tuition Fee', 'Hostel Fee', 'Transport Fee'];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

const STATUS_LABEL = { complete: 'Complete', partial: 'Partially Paid', pending: 'Pending', not_applicable: 'Not Applicable' };
const STATUS_CLASS = {
  complete: 'bg-teal/10 text-teal',
  partial: 'bg-gold/10 text-gold',
  pending: 'bg-crimson/10 text-crimson',
  not_applicable: 'bg-line/50 text-ink-light',
};

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status] || STATUS_CLASS.not_applicable}`}>{STATUS_LABEL[status] || status}</span>;
}
function formatAmount(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
}
function courseLabel(course) {
  return COURSE_OPTIONS.find((c) => c.value === course)?.label || 'Not set';
}
function yearsForCourse(course) {
  const duration = COURSE_DURATIONS[course] || 0;
  return Array.from({ length: duration }, (_, i) => i + 1);
}
// item 1: academic status badge — "Completed" wherever the student's
// academic status is shown, for every course (not just B.Tech).
function AcademicBadge({ academic }) {
  if (!academic) return <span className="text-ink-light">—</span>;
  if (academic.academic_status === 'completed') {
    return <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-semibold text-teal">Completed</span>;
  }
  if (academic.pending) {
    return <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">Pending</span>;
  }
  if (!academic.course) return <span className="text-ink-light">—</span>;
  return <span className="text-ink-light">{ORDINAL[academic.current_year] || `Year ${academic.current_year}`}</span>;
}

export default function AODashboard() {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchAoStudents({
        department: department || undefined, course: course || undefined, year: year || undefined,
        section_id: sectionId || undefined, q: query.trim() || undefined,
        pending: category === 'pending' ? 'true' : undefined,
      }),
      fetchAoSections(),
    ])
      .then(([studs, secs]) => { setStudents(studs); setSections(secs); })
      .catch((err) => showToast(err.message || 'Could not load students.', 'error'))
      .finally(() => setLoading(false));
  };

  // Server-side filters (department/course/year/section/pending/search) all
  // live in the query params (item 1/6), so any change to them re-fetches
  // — a light debounce on the search box only, so every keystroke doesn't
  // fire a request.
  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [category, department, course, year, sectionId, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const departments = useMemo(() => [...new Set(sections.map((s) => s.department).filter(Boolean))].sort(), [sections]);
  const years = useMemo(() => [...new Set(sections.map((s) => s.year).filter(Boolean))].sort(), [sections]);
  const sectionsForFilter = useMemo(() => sections.filter((s) => !department || s.department === department), [sections, department]);
  const pendingCount = useMemo(() => students.filter((s) => s.academic?.pending).length, [students]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">AO Fee Management</h1>
          <p className="text-sm text-ink-light">Every student in your college, with course/year and fee status at a glance. Fee records are entered and updated manually from offline college records.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setImportOpen(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper">
            Import from Excel
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            + Add Student
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-line">
        {CATEGORY_TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setCategory(t.value)} className={`px-3 py-2 text-sm font-semibold ${category === t.value ? 'border-b-2 border-teal text-teal' : 'text-ink-light'}`}>
            {t.label}{t.value === 'pending' && category !== 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or roll number…"
          className="rounded-full border border-line bg-paper-card px-4 py-2 text-sm outline-none focus:border-hero-primary"
        />
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setSectionId(''); }} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All courses</option>
          {COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All sections' years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All sections</option>
          {sectionsForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading students…" />
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          {query || department || course || year || sectionId || category !== 'all' ? 'No students match these filters.' : 'No students yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Roll No.</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Fees (Paid / Total)</th>
                <th className="px-4 py-3">Fee Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.roll_number || '—'}</td>
                  <td className="px-4 py-3 text-ink-light">{s.department}</td>
                  <td className="px-4 py-3 text-ink-light">{courseLabel(s.academic?.course)}</td>
                  <td className="px-4 py-3 text-ink-light">{s.section_name || '—'}</td>
                  <td className="px-4 py-3"><AcademicBadge academic={s.academic} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{formatAmount(s.fees.paid_amount)} / {formatAmount(s.fees.total_amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.fees.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setProfileId(s.id)} className="text-xs font-semibold text-hero-primary hover:underline">View / Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentProfileModal studentId={profileId} onClose={() => setProfileId(null)} onSaved={load} />
      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} sections={sections} onCreated={load} />
      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        sections={sections}
        onImported={load}
        previewFn={previewImportAoStudents}
        importFn={importAoStudents}
        templateUrl={studentImportTemplateUrl}
      />
    </div>
  );
}

// Student Profile (item 11): Basic Details (Course/Year + Completion, item
// 1) + Fee Details, each with their own inline edit form and Save button —
// Basic Details saves the AO-owned Course/Year fields, Fee Details saves
// the full fee_items array (item 4/5/6).
function StudentProfileModal({ studentId, onClose, onSaved }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingFees, setSavingFees] = useState(false);
  const [markingCompleted, setMarkingCompleted] = useState(false);

  const [course, setCourse] = useState('');
  const [currentYear, setCurrentYear] = useState('');
  const [feeItems, setFeeItems] = useState([]);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    fetchAoStudent(studentId)
      .then(({ student, fees }) => {
        setData({ student, fees });
        setCourse(student.academic?.course || '');
        setCurrentYear(student.academic?.current_year || '');
        setFeeItems(fees.fee_items.map((f) => ({ ...f })));
      })
      .catch((err) => showToast(err.message || 'Could not load this student.', 'error'))
      .finally(() => setLoading(false));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!studentId) return null;

  const academic = data?.student.academic;
  const availableYears = yearsForCourse(course);
  // item 1: "the 1st Year must automatically be selected by default" when
  // AO picks a course — applied here in the form itself so it's visible
  // immediately, not only after saving.
  const handleCourseChange = (value) => {
    setCourse(value);
    setCurrentYear(value ? 1 : '');
  };
  const isFinalYear = !!course && !!currentYear && Number(currentYear) >= (COURSE_DURATIONS[course] || 0);

  const saveBasic = async () => {
    setSavingBasic(true);
    try {
      const updated = await updateAoStudent(studentId, {
        course: course || null,
        current_year: currentYear ? Number(currentYear) : null,
      });
      setData((prev) => ({ ...prev, student: { ...prev.student, ...updated } }));
      showToast('Student details updated.', 'success');
      onSaved();
    } catch (err) {
      showToast(err.message || 'Could not save changes.', 'error');
    } finally {
      setSavingBasic(false);
    }
  };

  // item 1: "AO marks the student as Completed" — only offered once the
  // student is actually in their course's final year (button is disabled
  // otherwise); works identically for every course, not just B.Tech.
  const toggleCompleted = async () => {
    setMarkingCompleted(true);
    try {
      const updated = await updateAoStudent(studentId, {
        academic_status: academic?.academic_status === 'completed' ? 'active' : 'completed',
      });
      setData((prev) => ({ ...prev, student: { ...prev.student, ...updated } }));
      showToast(updated.academic?.academic_status === 'completed' ? 'Marked as Completed.' : 'Reverted to active.', 'success');
      onSaved();
    } catch (err) {
      showToast(err.message || 'Could not update completion status.', 'error');
    } finally {
      setMarkingCompleted(false);
    }
  };

  const updateFeeItem = (id, patch) => setFeeItems((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFeeItem = (id) => setFeeItems((prev) => prev.filter((f) => f.id !== id));
  const addFeeItem = () => setFeeItems((prev) => [...prev, { id: `new_${Date.now()}_${prev.length}`, fee_type: '', total_amount: 0, paid_amount: 0 }]);
  const addPresetFeeType = (label) => {
    if (feeItems.some((f) => f.fee_type.trim().toLowerCase() === label.toLowerCase())) return;
    setFeeItems((prev) => [...prev, { id: `new_${Date.now()}_${prev.length}`, fee_type: label, total_amount: 0, paid_amount: 0 }]);
  };

  const saveFees = async () => {
    for (const f of feeItems) {
      if (!f.fee_type.trim()) { showToast('Every fee type needs a name.', 'error'); return; }
      if (!(Number(f.total_amount) >= 0) || !(Number(f.paid_amount) >= 0)) { showToast('Amounts must be zero or more.', 'error'); return; }
      // item 9: Paid can never exceed Total.
      if (Number(f.paid_amount) > Number(f.total_amount)) { showToast(`"${f.fee_type || 'Fee'}" paid amount cannot exceed its total.`, 'error'); return; }
    }
    setSavingFees(true);
    try {
      const cleanItems = feeItems.map((f) => ({
        id: f.id?.startsWith('new_') ? undefined : f.id,
        fee_type: f.fee_type.trim(), total_amount: Number(f.total_amount), paid_amount: Number(f.paid_amount),
      }));
      const fees = await updateAoStudentFees(studentId, cleanItems);
      setData((prev) => ({ ...prev, fees }));
      setFeeItems(fees.fee_items.map((f) => ({ ...f })));
      showToast('Fee details updated.', 'success');
      onSaved();
    } catch (err) {
      showToast(err.message || 'Could not save fee details.', 'error');
    } finally {
      setSavingFees(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={data ? data.student.name : 'Student profile'}>
      {loading || !data ? (
        <LoadingSpinner label="Loading profile…" />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase text-ink-light">Basic Details</h3>
            <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink-light">
              <span>Roll No.: <span className="font-mono text-ink">{data.student.roll_number || '—'}</span></span>
              <span>Department: <span className="text-ink">{data.student.department}</span></span>
              <span>Section: <span className="text-ink">{data.student.section_name || '—'}</span></span>
              <span>Status: <AcademicBadge academic={academic} /></span>
            </div>
            <div className="space-y-3 rounded-xl border border-line p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Course</label>
                  <select value={course} onChange={(e) => handleCourseChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm">
                    <option value="">Not set</option>
                    {COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label} — {COURSE_DURATIONS[c.value]} Years</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Year</label>
                  <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} disabled={!course} className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm disabled:opacity-50">
                    <option value="">Pending</option>
                    {availableYears.map((y) => <option key={y} value={y}>{ORDINAL[y] || `Year ${y}`} Year</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={saveBasic} disabled={savingBasic} className="rounded-full bg-hero-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {savingBasic ? 'Saving…' : 'Save details'}
                </button>
                {academic?.academic_status === 'completed' ? (
                  <button type="button" onClick={toggleCompleted} disabled={markingCompleted} className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-60">
                    {markingCompleted ? 'Updating…' : 'Revert to active'}
                  </button>
                ) : (
                  <button
                    type="button" onClick={toggleCompleted} disabled={markingCompleted || !isFinalYear}
                    title={isFinalYear ? '' : 'Only available once the student reaches their final year'}
                    className="rounded-full bg-teal px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {markingCompleted ? 'Updating…' : 'Mark Completed'}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase text-ink-light">Fee Details</h3>
            <div className="space-y-2">
              {feeItems.length === 0 && <p className="text-sm text-ink-light">No fee types configured yet.</p>}
              {feeItems.map((f) => {
                const total = Number(f.total_amount) || 0;
                const paid = Number(f.paid_amount) || 0;
                const status = total <= 0 ? 'not_applicable' : paid <= 0 ? 'pending' : paid >= total ? 'complete' : 'partial';
                return (
                  <div key={f.id} className="rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        value={f.fee_type} onChange={(e) => updateFeeItem(f.id, { fee_type: e.target.value })}
                        placeholder="Fee type (e.g. Tuition Fee)"
                        className="flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm font-semibold"
                      />
                      <StatusBadge status={status} />
                      <button type="button" onClick={() => removeFeeItem(f.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink-light">Total fee (₹)</label>
                        <input type="number" min={0} value={f.total_amount} onChange={(e) => updateFeeItem(f.id, { total_amount: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink-light">Paid amount (₹)</label>
                        <input type="number" min={0} value={f.paid_amount} onChange={(e) => updateFeeItem(f.id, { paid_amount: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink-light">Pending (₹)</label>
                        <input disabled value={Math.max(0, total - paid)} className="w-full rounded-lg border border-line bg-line/20 px-2 py-1.5 text-sm text-ink-light" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {DEFAULT_FEE_TYPES.filter((label) => !feeItems.some((f) => f.fee_type.trim().toLowerCase() === label.toLowerCase())).map((label) => (
                <button key={label} type="button" onClick={() => addPresetFeeType(label)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-paper">+ {label}</button>
              ))}
              <button type="button" onClick={addFeeItem} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-paper">+ Other fee</button>
            </div>
            <button type="button" onClick={saveFees} disabled={savingFees} className="mt-3 w-full rounded-lg bg-hero-primary py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {savingFees ? 'Saving…' : 'Save fee details'}
            </button>
          </section>
        </div>
      )}
    </Modal>
  );
}

// Add Student (item 5/7) — AO picks any department's section (college-wide,
// unlike HOD's Add Student which is limited to their own department).
// Course is optional at creation, Year is optional even when Course is
// picked (a Course with no Year leaves the student on the Pending list,
// item 6). Duplicate protection (item 9) happens server-side on username +
// roll number within the chosen department.
function AddStudentModal({ open, onClose, sections, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [course, setCourse] = useState('');
  const [currentYear, setCurrentYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(''); setUsername(''); setPassword(''); setRollNumber('');
    setSectionId(sections[0]?.id || ''); setCourse(''); setCurrentYear('');
    setError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const availableYears = yearsForCourse(course);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password || !sectionId) { setError('Name, username, password, and section are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createAoStudent({
        name, username, password, roll_number: rollNumber, section_id: sectionId,
        course: course || null, current_year: currentYear ? Number(currentYear) : null,
      });
      showToast('Student added.', 'success');
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not add this student.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Student">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Roll Number" value={rollNumber} onChange={setRollNumber} />
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.department} — {s.name}{s.year ? ` (${s.year})` : ''}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Course</label>
            <select value={course} onChange={(e) => { setCourse(e.target.value); setCurrentYear(''); }} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
              <option value="">Not set</option>
              {COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Year (optional)</label>
            <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} disabled={!course} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:opacity-50">
              <option value="">Leave pending</option>
              {availableYears.map((y) => <option key={y} value={y}>{ORDINAL[y] || `Year ${y}`} Year</option>)}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-ink-light">Leaving Year blank marks the student as Pending — they'll show up in the Pending tab until a year is set.</p>
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Adding…' : 'Add student'}
        </button>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  // Spec item 18: password fields get the show/hide eye icon everywhere.
  const InputComponent = type === 'password' ? PasswordField : 'input';
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <InputComponent type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    </div>
  );
}
