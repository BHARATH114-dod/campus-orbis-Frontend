import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  fetchHods, createHod, deleteHod, bulkDeleteHods,
  fetchAos, createAo, deleteAo, bulkDeleteAos,
  fetchAllFaculty, fetchAllStudents, fetchAllSections,
} from '../../services/collegeAdminService';
import { fetchHodBranchCatalog } from '../../services/hodService';
import LoadingSpinner from '../common/LoadingSpinner';
import BulkActionBar from '../common/BulkActionBar';
import PasswordField from '../common/PasswordField';

const TABS = ['HODs', 'AOs', 'Sections', 'Faculty', 'Students'];
// Student "Course" values (item 5) — same fixed set used by AO/HOD/Faculty
// student-creation forms everywhere else in the app (btech/mtech/degree/
// diploma), not to be confused with an HOD's own Course/Department Type
// catalog (which also includes MBA/MCA) fetched from the backend above.
const STUDENT_COURSE_OPTIONS = [
  { value: 'btech', label: 'B.Tech' },
  { value: 'mtech', label: 'M.Tech' },
  { value: 'degree', label: 'Degree' },
  { value: 'diploma', label: 'Diploma' },
];

// UPDATED: HODs and AOs are the two tabs on this page that are actually
// CRUD-enabled — College Admin creates/removes both directly (matches the
// role hierarchy: College Admin manages the layer directly below them).
// The other three tabs stay read-only, college-wide — adding
// sections/faculty/students stays each department's HOD's job, not
// College Admin's, same as before. Bulk removal (item 14) applies to both
// HODs and AOs, matching the backend's own authority boundary (POST
// /api/college/hods/bulk-delete and /api/college/aos/bulk-delete) — the
// other tabs get search only, no delete authority was ever added there.
export default function CollegeAdminPeople() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('HODs');
  const [department, setDepartment] = useState('');
  const [query, setQuery] = useState('');
  const [hods, setHods] = useState([]);
  const [aos, setAos] = useState([]);
  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addHodOpen, setAddHodOpen] = useState(false);
  const [addAoOpen, setAddAoOpen] = useState(false);
  const [selectedHods, setSelectedHods] = useState(new Set());
  const [selectedAos, setSelectedAos] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // item 5: Course -> Branch -> Year -> Section filtering for the Students
  // tab. Branch is the existing `department` filter above; these add the
  // remaining levels. Year lives on the student's Section (see HOD's
  // POST /api/hod/sections), not the student doc directly, so it's derived
  // from `sections` the same way AODashboard.jsx already does it.
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  // items 2-4: course-type labels for display only ("Course: B.Tech" next
  // to "Branch: CSE") — the catalog itself (which branches are valid for
  // which course type) lives entirely on the backend; Admin only ever
  // reads it here, never edits an HOD's course/branch from this screen.
  const [courseLabels, setCourseLabels] = useState({});

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchHods(), fetchAos(), fetchAllSections(), fetchAllFaculty(), fetchAllStudents()])
      .then(([h, a, secs, fac, studs]) => { setHods(h); setAos(a); setSections(secs); setFaculty(fac); setStudents(studs); setSelectedHods(new Set()); setSelectedAos(new Set()); })
      .catch((err) => showToast(err.message || 'Could not load this data.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(loadAll, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchHodBranchCatalog()
      .then((cat) => setCourseLabels(Object.fromEntries(cat.course_types.map((c) => [c.value, c.label]))))
      .catch(() => {}); // display-only enhancement — a failed fetch here just falls back to showing "Not set"
  }, []);
  useEffect(() => { setQuery(''); setSelectedHods(new Set()); setSelectedAos(new Set()); setCourseFilter(''); setYearFilter(''); setSectionFilter(''); }, [tab]);

  const handleRemoveHod = async (id) => {
    if (!window.confirm('Remove this HOD? This cannot be undone.')) return;
    try {
      await deleteHod(id);
      showToast('HOD removed.', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove this HOD.', 'error');
    }
  };
  const toggleHod = (id) => setSelectedHods((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleBulkRemoveSelected = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteHods({ ids: [...selectedHods] });
      showToast(`Removed ${result.removed} HOD${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected HODs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAll = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteHods({ removeAll: true });
      showToast(`Removed ${result.removed} HOD${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove HODs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRemoveAo = async (id) => {
    if (!window.confirm('Remove this AO? This cannot be undone.')) return;
    try {
      await deleteAo(id);
      showToast('AO removed.', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove this AO.', 'error');
    }
  };
  const toggleAo = (id) => setSelectedAos((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleBulkRemoveSelectedAos = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteAos({ ids: [...selectedAos] });
      showToast(`Removed ${result.removed} AO${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected AOs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAllAos = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteAos({ removeAll: true });
      showToast(`Removed ${result.removed} AO${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove AOs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const departments = [...new Set([...hods, ...sections, ...faculty, ...students].map((r) => r.department).filter(Boolean))].sort();

  // Item 16 (User Search) — this data is already fully authorized for
  // College Admin (college-wide), so this is an instant client-side filter
  // over already-scoped data. GlobalSearchBar (using /api/search) is the
  // backend-scoped cross-page entry point used from the dashboard instead.
  const q = query.trim().toLowerCase();
  const matchesQuery = (r, extraFields = []) => !q || [r.name, r.username, ...extraFields].some((v) => v?.toLowerCase().includes(q));

  const filteredHods = hods.filter((h) => (!department || h.department === department) && matchesQuery(h));
  const filteredAos = aos.filter((a) => matchesQuery(a));
  const filteredSections = sections.filter((s) => (!department || s.department === department) && (!q || s.name?.toLowerCase().includes(q)));
  const filteredFaculty = faculty.filter((f) => (!department || f.department === department) && matchesQuery(f));
  const sectionYearById = Object.fromEntries(sections.map((s) => [s.id, s.year]));
  const availableYears = [...new Set(sections.map((s) => s.year).filter(Boolean))].sort();
  const filteredStudents = students.filter((s) =>
    (!department || s.department === department)
    && (!courseFilter || s.course === courseFilter)
    && (!sectionFilter || s.section_id === sectionFilter)
    && (!yearFilter || sectionYearById[s.section_id] === yearFilter)
    && matchesQuery(s, [s.roll_number])
  );
  const sectionName = (id) => sections.find((s) => s.id === id)?.name || id;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">People</h1>
          <p className="text-sm text-ink-light">
            {tab === 'HODs' ? 'You manage HODs directly.' : tab === 'AOs' ? 'You manage Administrative Officer (Fee Management) accounts directly.' : "Read-only college-wide oversight — adding sections, faculty, and students stays with each department's HOD."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'Students' ? 'Search by name, username, or roll number…' : 'Search by name or username…'}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-hero-primary"
          />
          {departments.length > 0 && tab !== 'AOs' && (
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {tab === 'Students' && (
            <>
              <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">All courses</option>
                {STUDENT_COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">All years</option>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">All sections</option>
                {sections.filter((s) => !department || s.department === department).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
          {tab === 'HODs' && (
            <button type="button" onClick={() => setAddHodOpen(true)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              + Add HOD
            </button>
          )}
          {tab === 'AOs' && (
            <button type="button" onClick={() => setAddAoOpen(true)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              + Add AO
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-teal text-teal' : 'text-ink-light'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading…" />
      ) : tab === 'HODs' ? (
        <>
          {hods.length > 0 && (
            <BulkActionBar
              total={filteredHods.length} selectedCount={selectedHods.size}
              onSelectAll={() => setSelectedHods(new Set(filteredHods.map((h) => h.id)))}
              onDeselectAll={() => setSelectedHods(new Set())}
              onRemoveSelected={handleBulkRemoveSelected}
              onRemoveAll={handleBulkRemoveAll}
              busy={bulkBusy}
            />
          )}
          {filteredHods.length === 0 ? <p className="text-sm text-ink-light">{q ? `No HODs match "${query}".` : 'No HODs added yet.'}</p> : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                  <tr><th className="px-4 py-3"></th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody>
                  {filteredHods.map((h) => (
                    <tr key={h.username} className="border-t border-line bg-paper-card">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedHods.has(h.id)} onChange={() => toggleHod(h.id)} /></td>
                      <td className="px-4 py-3">{h.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{h.username}</td>
                      <td className="px-4 py-3 text-ink-light">{courseLabels[h.hod_course_type] || 'Not set'}</td>
                      <td className="px-4 py-3 text-ink-light">{h.department || 'Not set'}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => handleRemoveHod(h.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </div>
          )}
        </>
      ) : tab === 'AOs' ? (
        <>
          {aos.length > 0 && (
            <BulkActionBar
              total={filteredAos.length} selectedCount={selectedAos.size}
              onSelectAll={() => setSelectedAos(new Set(filteredAos.map((a) => a.id)))}
              onDeselectAll={() => setSelectedAos(new Set())}
              onRemoveSelected={handleBulkRemoveSelectedAos}
              onRemoveAll={handleBulkRemoveAllAos}
              busy={bulkBusy}
            />
          )}
          {filteredAos.length === 0 ? <p className="text-sm text-ink-light">{q ? `No AOs match "${query}".` : 'No AOs added yet.'}</p> : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                  <tr><th className="px-4 py-3"></th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody>
                  {filteredAos.map((a) => (
                    <tr key={a.username} className="border-t border-line bg-paper-card">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedAos.has(a.id)} onChange={() => toggleAo(a.id)} /></td>
                      <td className="px-4 py-3">{a.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.username}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => handleRemoveAo(a.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </div>
          )}
        </>
      ) : tab === 'Sections' ? (
        filteredSections.length === 0 ? <p className="text-sm text-ink-light">{q ? `No sections match "${query}".` : 'No sections found.'}</p> : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                <tr><th className="px-4 py-3">Section</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Year</th><th className="px-4 py-3">In-charge</th></tr>
              </thead>
              <tbody>
                {filteredSections.map((s) => (
                  <tr key={s.id} className="border-t border-line bg-paper-card">
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-ink-light">{s.department}</td>
                    <td className="px-4 py-3 text-ink-light">{s.year || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.faculty_username || 'unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
        )
      ) : tab === 'Faculty' ? (
        filteredFaculty.length === 0 ? <p className="text-sm text-ink-light">{q ? `No faculty match "${query}".` : 'No faculty found.'}</p> : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Sections</th></tr>
              </thead>
              <tbody>
                {filteredFaculty.map((f) => (
                  <tr key={f.username} className="border-t border-line bg-paper-card">
                    <td className="px-4 py-3">{f.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{f.username}</td>
                    <td className="px-4 py-3 text-ink-light">{f.department}</td>
                    <td className="px-4 py-3 text-ink-light">{(f.section_ids || []).map(sectionName).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
        )
      ) : (
        filteredStudents.length === 0 ? <p className="text-sm text-ink-light">{q ? `No students match "${query}".` : 'No students found.'}</p> : (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Roll No.</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Section</th></tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.username} className="border-t border-line bg-paper-card">
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.username}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                    <td className="px-4 py-3 text-ink-light">{STUDENT_COURSE_OPTIONS.find((c) => c.value === s.course)?.label || 'Not set'}</td>
                    <td className="px-4 py-3 text-ink-light">{s.department}</td>
                    <td className="px-4 py-3 text-ink-light">{sectionName(s.section_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
        )
      )}

      <AddHodModal open={addHodOpen} onClose={() => setAddHodOpen(false)} onCreated={loadAll} />
      <AddAoModal open={addAoOpen} onClose={() => setAddAoOpen(false)} onCreated={loadAll} />
    </div>
  );
}

function AddHodModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password || !department.trim()) { setError('All fields are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createHod({ name, username, password, department });
      showToast('HOD added.', 'success');
      onCreated();
      onClose();
      setName(''); setUsername(''); setPassword(''); setDepartment('');
    } catch (err) {
      setError(err.message || 'Could not add this HOD.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add HOD</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Department" value={department} onChange={setDepartment} placeholder="e.g. Computer Science" />
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

// AO accounts have no department — the AO Fee Management module is
// college-wide by design (see item 1: "AO login ayyaka college students
// list motham visible ga undaali").
function AddAoModal({ open, onClose, onCreated }) {
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
      await createAo({ name, username, password });
      showToast('AO added.', 'success');
      onCreated();
      onClose();
      setName(''); setUsername(''); setPassword('');
    } catch (err) {
      setError(err.message || 'Could not add this AO.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add AO (Fee Management)</h2>
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
