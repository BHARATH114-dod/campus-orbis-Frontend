import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchDeptSections, createSection, assignSectionFaculty, deleteSection,
  fetchDeptFaculty, createFaculty, deleteFaculty, bulkDeleteFaculty,
  fetchDeptStudents, createStudent, deleteStudent, importStudents, previewImportStudents, studentImportTemplateUrl, bulkDeleteStudents, updateHodStudent,
  resetHodStudentPoints,
} from '../../services/hodService';
import LoadingSpinner from '../common/LoadingSpinner';
import BulkActionBar from '../common/BulkActionBar';
import PasswordField from '../common/PasswordField';
import StudentProfileEditModal from './StudentProfileEditModal';

const TABS = ['Sections', 'Faculty', 'Students'];

export default function HodPeople() {
  const [tab, setTab] = useState('Sections');
  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchDeptSections(), fetchDeptFaculty(), fetchDeptStudents()])
      .then(([secs, fac, studs]) => { setSections(secs); setFaculty(fac); setStudents(studs); })
      .catch((err) => showToast(err.message || 'Could not load your department.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(loadAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-teal text-teal' : 'text-ink-light'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading your department…" />
      ) : tab === 'Sections' ? (
        <SectionsTab sections={sections} faculty={faculty} onChange={loadAll} />
      ) : tab === 'Faculty' ? (
        <FacultyTab faculty={faculty} onChange={loadAll} />
      ) : (
        <StudentsTab students={students} sections={sections} onChange={loadAll} />
      )}
    </div>
  );
}

function SectionsTab({ sections, faculty, onChange }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createSection({ name, year });
      showToast('Section created.', 'success');
      setName(''); setYear('');
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not create this section.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (sectionId, facultyUsername) => {
    try {
      await assignSectionFaculty(sectionId, facultyUsername);
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not assign faculty.', 'error');
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this section? It must have no students in it first.')) return;
    try {
      await deleteSection(id);
      showToast('Section removed.', 'success');
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove this section.', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Sections</h1>
          <p className="text-sm text-ink-light">{user.department} — create sections and assign a faculty in-charge</p>
        </div>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Section name" className="rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year (optional)" className="w-32 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          <button type="submit" disabled={submitting} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
            + Add section
          </button>
        </form>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-ink-light">No sections yet.</p>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper-card p-4 shadow-sm">
              <span className="text-sm font-semibold text-ink">
                {s.name}{s.year ? ` (${s.year})` : ''} <span className="font-normal text-ink-light">— in-charge: {s.faculty_username || 'unassigned'}</span>
              </span>
              <div className="flex items-center gap-3">
                <select
                  value={s.faculty_username || ''}
                  onChange={(e) => handleAssign(s.id, e.target.value)}
                  className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {faculty.map((f) => <option key={f.username} value={f.username}>{f.name}</option>)}
                </select>
                <button type="button" onClick={() => handleRemove(s.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FacultyTab({ faculty, onChange }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faculty;
    return faculty.filter((f) => f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q));
  }, [faculty, query]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this faculty member? This cannot be undone.')) return;
    try {
      await deleteFaculty(id);
      showToast('Faculty removed.', 'success');
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove this faculty member.', 'error');
    }
  };

  const handleBulkRemoveSelected = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteFaculty({ ids: [...selected] });
      showToast(`Removed ${result.removed} faculty member${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected faculty.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAll = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteFaculty({ removeAll: true });
      showToast(`Removed ${result.removed} faculty member${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove faculty.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Faculty</h1>
          <p className="text-sm text-ink-light">{user.department}</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          + Add faculty
        </button>
      </div>

      {faculty.length > 0 && (
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username…"
          className="mb-3 w-full max-w-sm rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hero-primary"
        />
      )}
      {faculty.length > 0 && (
        <BulkActionBar
          total={filtered.length} selectedCount={selected.size}
          onSelectAll={() => setSelected(new Set(filtered.map((f) => f.id)))}
          onDeselectAll={() => setSelected(new Set())}
          onRemoveSelected={handleBulkRemoveSelected}
          onRemoveAll={handleBulkRemoveAll}
          busy={bulkBusy}
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-light">{query ? `No faculty match "${query}".` : 'No faculty added yet.'}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr><th className="px-4 py-3"></th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Sections</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.username} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} /></td>
                  <td className="px-4 py-3">{f.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{f.username}</td>
                  <td className="px-4 py-3 text-ink-light">{f.section_ids?.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => handleRemove(f.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <AddFacultyModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={onChange} />
    </div>
  );
}

function AddFacultyModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) { setError('All fields are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createFaculty({ name, username, password });
      showToast('Faculty added.', 'success');
      onCreated();
      onClose();
      setName(''); setUsername(''); setPassword('');
    } catch (err) {
      setError(err.message || 'Could not add this faculty member.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add faculty</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Username" value={username} onChange={setUsername} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudentsTab({ students, sections, onChange }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [query, setQuery] = useState('');
  // item 5: Course -> Branch -> Year -> Section filtering. Branch is fixed
  // for an HOD (their own department — the page header already shows it),
  // so the remaining levels an HOD needs are Course, Year (which lives on
  // the student's Section, not the student directly — see Sections'
  // `year` field), and Section itself.
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);

  const sectionYearById = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.year])), [sections]);
  const availableYears = useMemo(() => [...new Set(sections.map((s) => s.year).filter(Boolean))].sort(), [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !(s.name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q) || s.roll_number?.toLowerCase().includes(q))) return false;
      if (courseFilter && s.course !== courseFilter) return false;
      if (sectionFilter && s.section_id !== sectionFilter) return false;
      if (yearFilter && sectionYearById[s.section_id] !== yearFilter) return false;
      return true;
    });
  }, [students, query, courseFilter, yearFilter, sectionFilter, sectionYearById]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this student? This cannot be undone.')) return;
    try {
      await deleteStudent(id);
      showToast('Student removed.', 'success');
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove this student.', 'error');
    }
  };

  const handleBulkRemoveSelected = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteStudents({ ids: [...selected] });
      showToast(`Removed ${result.removed} student${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected students.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAll = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteStudents({ removeAll: true });
      showToast(`Removed ${result.removed} student${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not remove students.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const sectionName = (id) => sections.find((s) => s.id === id)?.name || id;

  // item 15: Points reset (department-wide, since an HOD is authorized over
  // every student in their department — see every other HOD-scoped route).
  const handleResetSelectedPoints = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Reset points to zero for ${selected.size} selected student${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setResettingPoints(true);
    try {
      const result = await resetHodStudentPoints({ studentIds: [...selected] });
      showToast(`Reset points for ${result.reset_count} student${result.reset_count === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not reset points.', 'error');
    } finally {
      setResettingPoints(false);
    }
  };
  const handleResetAllPoints = async () => {
    if (!window.confirm('Reset points to zero for every student in your department? This cannot be undone.')) return;
    setResettingPoints(true);
    try {
      const result = await resetHodStudentPoints({ all: true });
      showToast(`Reset points for ${result.reset_count} student${result.reset_count === 1 ? '' : 's'}.`, 'success');
      onChange();
    } catch (err) {
      showToast(err.message || 'Could not reset points.', 'error');
    } finally {
      setResettingPoints(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Students</h1>
          <p className="text-sm text-ink-light">{user.department}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={sections.length === 0}
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-paper disabled:opacity-50"
          >
            Import from Excel
          </button>
          <button type="button" onClick={() => setModalOpen(true)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            + Add student
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or roll number…"
            className="w-full max-w-sm rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hero-primary"
          />
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-full border border-line bg-paper px-3 py-2 text-sm">
            <option value="">All courses</option>
            {COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-full border border-line bg-paper px-3 py-2 text-sm">
            <option value="">All years</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="rounded-full border border-line bg-paper px-3 py-2 text-sm">
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {students.length > 0 && (
        <BulkActionBar
          total={filtered.length} selectedCount={selected.size}
          onSelectAll={() => setSelected(new Set(filtered.map((s) => s.id)))}
          onDeselectAll={() => setSelected(new Set())}
          onRemoveSelected={handleBulkRemoveSelected}
          onRemoveAll={handleBulkRemoveAll}
          busy={bulkBusy}
        />
      )}
      {students.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetSelectedPoints}
            disabled={selected.size === 0 || resettingPoints}
            className="rounded-full border border-crimson px-4 py-2 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-40"
          >
            Reset points ({selected.size})
          </button>
          <button
            type="button"
            onClick={handleResetAllPoints}
            disabled={resettingPoints}
            className="rounded-full border border-crimson px-4 py-2 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-40"
          >
            Reset all points
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-light">{query ? `No students match "${query}".` : 'No students added yet.'}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr><th className="px-4 py-3"></th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Roll No.</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Section</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.username} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.username}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                  <td className="px-4 py-3 text-ink-light">{COURSE_OPTIONS.find((c) => c.value === s.course)?.label || 'Not set'}</td>
                  <td className="px-4 py-3 text-ink-light">{sectionName(s.section_id)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditStudent(s)} className="mr-3 text-xs font-semibold text-hero-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => handleRemove(s.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <AddStudentModal open={modalOpen} onClose={() => setModalOpen(false)} sections={sections} onCreated={onChange} createFn={createStudent} />
      <ImportStudentsModal open={importOpen} onClose={() => setImportOpen(false)} sections={sections} onImported={onChange} previewFn={previewImportStudents} importFn={importStudents} templateUrl={studentImportTemplateUrl} />
      <StudentProfileEditModal student={editStudent} sections={sections} updateFn={updateHodStudent} onClose={() => setEditStudent(null)} onSaved={onChange} />
    </div>
  );
}

// Shared by HOD's Students tab and the Faculty Dashboard's "Add student"
// card — same form, different createFn (createStudent vs createMyStudent)
// and a different, narrower section list depending on who's using it.
// item 1/10: same course-duration map AO Office uses — kept in sync so
// Faculty/HOD Add Student offers the same Year choices per course.
const COURSE_DURATIONS = { btech: 4, mtech: 2, degree: 3, diploma: 3 };
const COURSE_OPTIONS = [
  { value: 'btech', label: 'B.Tech' },
  { value: 'mtech', label: 'M.Tech' },
  { value: 'degree', label: 'Degree' },
  { value: 'diploma', label: 'Diploma' },
];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
function yearsForCourse(course) {
  return Array.from({ length: COURSE_DURATIONS[course] || 0 }, (_, i) => i + 1);
}

export function AddStudentModal({ open, onClose, sections, onCreated, createFn }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [sectionId, setSectionId] = useState(sections[0]?.id || '');
  const [course, setCourse] = useState('');
  const [currentYear, setCurrentYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setSectionId(sections[0]?.id || ''); setCourse(''); setCurrentYear(''); } }, [open, sections]);

  if (!open) return null;

  const availableYears = yearsForCourse(course);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password || !sectionId) { setError('Name, username, password, and section are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // item 5: Course optional, Year optional even when Course is set —
      // leaving Year blank is valid and lands the student on the Pending
      // list rather than guessing a year for them.
      await createFn({ name, username, password, rollNumber, sectionId, course: course || null, currentYear: currentYear ? Number(currentYear) : null });
      showToast('Student added.', 'success');
      onCreated();
      onClose();
      setName(''); setUsername(''); setPassword(''); setRollNumber(''); setCourse(''); setCurrentYear('');
    } catch (err) {
      setError(err.message || 'Could not add this student.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add student</h2>
        {sections.length === 0 ? (
          <p className="text-sm text-ink-light">You need a section to add a student to first.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Name" value={name} onChange={setName} />
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            <Field label="Roll number (optional)" value={rollNumber} onChange={setRollNumber} />
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Year ${s.year}` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">Course (optional)</label>
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
            {error && <p className="text-xs text-crimson">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// FIX: rewritten as a 3-step wizard (Upload → Preview + pick a Section →
// Result), shared by HOD's Students tab, the Faculty Students page, and
// the AO dashboard. Section is never required in the Excel file itself —
// it's picked here, after upload, from this scope's actual sections
// (already loaded by the caller), and applied to every student on import.
// `previewFn`/`importFn` differ per caller (HOD/Faculty/AO versions), same
// pattern as AddStudentModal above.
export function ImportStudentsModal({ open, onClose, sections, onImported, previewFn, importFn, templateUrl }) {
  const { showToast } = useToast();
  const [step, setStep] = useState('upload'); // upload -> preview -> result
  const [file, setFile] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setStep('upload'); setFile(null); setSectionId(''); setPreview(null); setResult(null); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Choose an Excel (.xlsx/.xls) or CSV file first.'); return; }
    setBusy(true); setError('');
    try {
      const res = await previewFn(file);
      setPreview(res);
      setSectionId(sections[0]?.id || '');
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!sectionId) { setError('Choose a section to add these students to.'); return; }
    setBusy(true); setError('');
    try {
      const res = await importFn(file, sectionId);
      setResult(res);
      setStep('result');
      if (res.created_count) {
        showToast(`${res.created_count} student${res.created_count === 1 ? '' : 's'} added to ${res.section?.name || 'the selected section'}.`, 'success');
        onImported();
      } else {
        showToast('No students were added — see the errors below.', 'error');
      }
    } catch (err) {
      setError(err.message || 'Could not import that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        {step === 'upload' && (
          <>
            <h2 className="mb-1 text-lg font-semibold text-ink">Import students from Excel</h2>
            <p className="mb-4 text-xs text-ink-light">
              Columns: <span className="font-mono">Name, Username, Password, Roll Number</span>. Section is not
              needed in the file — you'll pick one on the next step for the whole file.
              {templateUrl && <> <a href={templateUrl} className="font-semibold text-hero-primary hover:underline">Download a template</a>.</>}
            </p>
            <form onSubmit={handleUpload} className="space-y-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
              {error && <p className="text-xs text-crimson">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
                  {busy ? 'Reading…' : 'Next'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Students detected: {preview.total}</h2>
            <p className="text-xs text-ink-light">
              <span className="font-semibold text-teal">{preview.valid_count} ready</span>
              {preview.invalid_count > 0 && <span className="text-crimson"> · {preview.invalid_count} have issues</span>}
            </p>

            <div className="max-h-56 overflow-y-auto overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="bg-paper text-left uppercase text-ink-light">
                  <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Roll No.</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">Status</th></tr>
                </thead>
                <tbody>
                  {preview.students.map((s) => (
                    <tr key={s.row} className="border-t border-line align-top">
                      <td className="px-3 py-1.5 font-mono">{s.row}</td>
                      <td className="px-3 py-1.5">{s.name}</td>
                      <td className="px-3 py-1.5 font-mono">{s.roll_number}</td>
                      <td className="px-3 py-1.5 font-mono">{s.username}</td>
                      <td className="px-3 py-1.5">
                        {s.status === 'valid'
                          ? <span className="font-semibold text-teal">Valid</span>
                          : <span className="text-crimson">{s.errors.join('; ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Add Section</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">Select a section…</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.department ? `${s.department} — ` : ''}{s.name}{s.year ? ` (${s.year})` : ''}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-light">All {preview.valid_count} valid students above will be added to this section.</p>
            </div>

            {error && <p className="text-xs text-crimson">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={reset} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Back</button>
              <button type="button" onClick={handleImport} disabled={busy || !preview.valid_count} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
                {busy ? 'Importing…' : `Add Students (${preview.valid_count})`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Import complete</h2>
            <p className="text-sm text-ink">
              <span className="font-semibold text-teal">{result.created_count} added</span> to {result.section?.name || 'the selected section'}
              {result.failed_count > 0 && <span className="text-ink-light"> · {result.failed_count} failed</span>}
            </p>
            {result.failures?.length > 0 && (
              <div className="max-h-48 overflow-y-auto overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-paper text-left uppercase text-ink-light">
                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Roll No.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reason</th></tr>
                  </thead>
                  <tbody>
                    {result.failures.map((f, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-3 py-1.5 font-mono">{f.row}</td>
                        <td className="px-3 py-1.5 font-mono">{f.roll_number}</td>
                        <td className="px-3 py-1.5 text-crimson">{f.status}</td>
                        <td className="px-3 py-1.5 text-crimson">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={reset} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Import another file</button>
              <button type="button" onClick={handleClose} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  // Spec item 18: password fields get the show/hide eye icon everywhere.
  const InputComponent = type === 'password' ? PasswordField : 'input';
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <InputComponent type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    </div>
  );
}
