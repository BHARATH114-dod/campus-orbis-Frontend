import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchHods } from '../services/collegeAdminService';
import { fetchSubjects, deleteSubject } from '../services/timetableService';
import AddSubjectModal from '../components/common/AddSubjectModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBoundary from '../components/common/ErrorBoundary';

// College Admin's half of the "Add Subject" requirement in the Timetable
// module. College Admin isn't scoped to one department the way HOD is, so
// this page manages subjects across every department in the college,
// grouped for readability, rather than the single-department view HOD
// gets inside Timetables → a section's editor.
//
// A subject added here shows up immediately (no refresh needed) in this
// list, persists across a real refresh (it's read fresh from
// GET /api/hod/subjects on mount, same endpoint HOD's timetable editor
// reads from), and becomes selectable the moment that department's HOD
// opens their Timetable editor — same underlying `subjects` collection,
// scoped by department either way.
export default function CollegeAdminSubjects() {
  return (
    <ErrorBoundary message="Something went wrong loading Subjects.">
      <CollegeAdminSubjectsInner />
    </ErrorBoundary>
  );
}

function CollegeAdminSubjectsInner() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchSubjects(), fetchHods()])
      .then(([subs, hods]) => {
        setSubjects(subs);
        // The department dropdown offers exactly the departments that
        // actually exist in this college (one per HOD) — matches what the
        // backend itself validates a new subject's department against.
        setDepartments([...new Set(hods.map((h) => h.department).filter(Boolean))].sort());
      })
      .catch((err) => {
        const message = err.message || 'Could not load subjects.';
        setLoadError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (subject) => {
    if (!window.confirm(`Remove "${subject.name}"? This won't affect attendance records that already use it.`)) return;
    try {
      await deleteSubject(subject.id);
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
    } catch (err) {
      showToast(err.message || 'Could not remove this subject.', 'error');
    }
  };

  const filtered = departmentFilter ? subjects.filter((s) => s.department === departmentFilter) : subjects;
  const byDepartment = filtered.reduce((acc, s) => { (acc[s.department] = acc[s.department] || []).push(s); return acc; }, {});

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Subjects</h1>
          <p className="text-sm text-ink-light">Subjects available for attendance across every department.</p>
        </div>
        <button
          type="button" onClick={() => setAddOpen(true)}
          className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          + Add Subject
        </button>
      </div>

      {departments.length > 0 && (
        <div className="mb-4">
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading subjects…" />
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-paper-card p-8 text-center">
          <p className="text-sm font-semibold text-crimson">⚠ {loadError}</p>
          <button type="button" onClick={load} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:bg-paper">Try again</button>
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No subjects yet — add the first one so departments can start taking attendance.
        </div>
      ) : Object.keys(byDepartment).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No subjects in this department yet.</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byDepartment).sort(([a], [b]) => a.localeCompare(b)).map(([dept, subs]) => (
            <div key={dept}>
              <h2 className="mb-2 text-xs font-bold uppercase text-ink-light">{dept}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-card px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      {s.code && <p className="truncate text-[11px] text-ink-light">{s.code}</p>}
                    </div>
                    <button type="button" onClick={() => handleDelete(s)} className="ml-2 shrink-0 text-xs font-semibold text-crimson hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSubjectModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        departments={departments}
        onCreated={(subject) => setSubjects((prev) => [...prev, subject])}
      />
    </div>
  );
}
