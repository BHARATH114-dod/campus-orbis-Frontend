import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateProfile } from '../services/authService';
import { fetchMyFees } from '../services/feeService';
import { fetchHodBranchCatalog, fetchHodProfile, updateHodProfile } from '../services/hodService';
import ProfileCard from '../components/ProfileCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

// item 1/10: same course-duration map used everywhere else (AO Office,
// Faculty/HOD Add Student) — kept in sync so a student always sees the
// same Year choices for their course that AO would set for them.
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
function formatAmount(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
}
const STATUS_LABEL = { complete: 'Paid', partial: 'Partially Paid', pending: 'Pending', not_applicable: 'Not Applicable' };
const STATUS_CLASS = {
  complete: 'bg-teal/10 text-teal',
  partial: 'bg-gold/10 text-gold',
  pending: 'bg-crimson/10 text-crimson',
  not_applicable: 'bg-line/50 text-ink-light',
};
function StatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status] || STATUS_CLASS.not_applicable}`}>{STATUS_LABEL[status] || status}</span>;
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  if (!user) return null;

  const handleSave = async (fields) => {
    try {
      const updated = await updateProfile(fields);
      setUser(updated);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update your profile.', 'error');
      throw err; // ProfileCard catches this to stay in edit mode instead of closing
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-5 text-xl font-bold text-ink">Profile</h1>
      <ProfileCard user={user} editable onSave={handleSave} />
      {user.role === 'student' && (
        <>
          <StudentAcademicCard user={user} setUser={setUser} />
          <StudentFeeCard />
        </>
      )}
      {user.role === 'hod' && <HodDepartmentCard user={user} setUser={setUser} />}
      <p className="mt-4 text-xs text-ink-light">
        Need to change your password instead? Head to{' '}
        <Link to="/settings" className="text-teal hover:underline">Settings</Link>.
      </p>
    </div>
  );
}

// items 2-4: HOD selects Course/Department Type, then only the branches
// applicable to that course type — Course Type -> Branch, exactly like the
// student's Course -> Year card above. The catalog itself comes from the
// backend (GET /api/hod/branch-catalog) rather than being duplicated here,
// so adding a new branch or course type server-side never requires a
// matching frontend change. Selecting a Course Type always resets Branch —
// an MBA branch left over from a prior selection is never silently kept
// against a newly chosen course type.
function HodDepartmentCard({ user, setUser }) {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [courseType, setCourseType] = useState('');
  const [branch, setBranch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchHodBranchCatalog(), fetchHodProfile()])
      .then(([cat, profile]) => {
        setCatalog(cat);
        setCourseType(profile.course_type || '');
        setBranch(profile.branch || '');
      })
      .catch((err) => showToast(err.message || 'Could not load department options.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const availableBranches = (courseType && catalog?.branches_by_course_type[courseType]) || [];
  const courseLabel = catalog?.course_types.find((c) => c.value === (user.hod_course_type || courseType))?.label;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateHodProfile({ course_type: courseType, branch });
      // The user object elsewhere in the app (sidebar, headers, etc.) reads
      // department/hod_course_type directly off the auth context, so merge
      // the confirmed values back in rather than only updating local state.
      setUser({ ...user, department: updated.branch, hod_course_type: updated.course_type });
      showToast('Department details updated.', 'success');
      setEditing(false);
    } catch (err) {
      showToast(err.message || 'Could not update your department details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-ink-light">Course & Branch</h2>
        {!editing && !loading && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-teal hover:underline">Edit</button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading…" size="sm" />
      ) : editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Course/Department Type</label>
              <select value={courseType} onChange={(e) => { setCourseType(e.target.value); setBranch(''); }} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">Select…</option>
                {catalog?.course_types.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} disabled={!courseType} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:opacity-50">
                <option value="">Select…</option>
                {availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setCourseType(user.hod_course_type || ''); setBranch(user.department || ''); }}
              className="flex-1 rounded-lg border border-line py-2 text-xs font-semibold text-ink"
            >
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !courseType || !branch} className="flex-1 rounded-lg bg-hero-primary py-2 text-xs font-bold text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-ink-light">Course</span>
          <span className="text-right font-semibold text-ink">{courseLabel || 'Not set'}</span>
          <span className="text-ink-light">Branch</span>
          <span className="text-right font-semibold text-ink">{user.department || 'Not set'}</span>
        </div>
      )}
    </div>
  );
}
// profile — most useful to resolve their own Pending status (item 6)
// without waiting on AO Office. Locked once AO marks the course Completed.
function StudentAcademicCard({ user, setUser }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [course, setCourse] = useState(user.course || '');
  const [currentYear, setCurrentYear] = useState(user.current_year || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCourse(user.course || '');
    setCurrentYear(user.current_year || '');
  }, [user.course, user.current_year]);

  const isCompleted = user.academic_status === 'completed';
  const availableYears = yearsForCourse(course);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ course: course || null, current_year: currentYear ? Number(currentYear) : null });
      setUser(updated);
      showToast('Academic details updated.', 'success');
      setEditing(false);
    } catch (err) {
      showToast(err.message || 'Could not update your academic details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase text-ink-light">Course & Year</h2>
        {!editing && !isCompleted && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-teal hover:underline">Edit</button>
        )}
      </div>

      {isCompleted && (
        <p className="mb-2 rounded-lg bg-teal/10 px-3 py-2 text-xs font-semibold text-teal">
          Your course is marked Completed. Contact AO Office if this needs to change.
        </p>
      )}

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Course</label>
              <select value={course} onChange={(e) => { setCourse(e.target.value); setCurrentYear(''); }} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <option value="">Not set</option>
                {COURSE_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Year</label>
              <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} disabled={!course} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:opacity-50">
                <option value="">Not set</option>
                {availableYears.map((y) => <option key={y} value={y}>{ORDINAL[y] || `Year ${y}`} Year</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setCourse(user.course || ''); setCurrentYear(user.current_year || ''); }} className="flex-1 rounded-lg border border-line py-2 text-xs font-semibold text-ink">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-hero-primary py-2 text-xs font-bold text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-ink-light">Course</span>
          <span className="text-right font-semibold text-ink">{COURSE_OPTIONS.find((c) => c.value === user.course)?.label || 'Not set'}</span>
          <span className="text-ink-light">Year</span>
          <span className="text-right font-semibold text-ink">
            {isCompleted ? 'Completed' : user.current_year ? `${ORDINAL[user.current_year] || `Year ${user.current_year}`} Year` : 'Pending'}
          </span>
        </div>
      )}
    </div>
  );
}

// item 7/8: the student's complete fee picture — total, paid, pending, and
// a per-fee-type breakdown — sourced live from the same record AO Office
// edits, so any AO update shows up here automatically on next load.
function StudentFeeCard() {
  const { showToast } = useToast();
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyFees()
      .then(({ fees }) => setFees(fees))
      .catch((err) => showToast(err.message || 'Could not load your fee details.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-card p-5">
      <h2 className="mb-3 text-sm font-bold uppercase text-ink-light">Fee Details</h2>
      {loading ? (
        <LoadingSpinner label="Loading fee details…" />
      ) : !fees || fees.fee_items.length === 0 ? (
        <p className="text-sm text-ink-light">No fee details have been added by AO Office yet.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-ink-light">Total Fee</p>
              <p className="mt-1 text-base font-bold text-ink">{formatAmount(fees.total_amount)}</p>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-ink-light">Paid</p>
              <p className="mt-1 text-base font-bold text-teal">{formatAmount(fees.paid_amount)}</p>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <p className="text-[11px] font-semibold uppercase text-ink-light">Pending</p>
              <p className="mt-1 text-base font-bold text-crimson">{formatAmount(fees.pending_amount)}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                <tr>
                  <th className="px-3 py-2">Fee Type</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.fee_items.map((f) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">{f.fee_type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatAmount(f.total_amount)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatAmount(f.paid_amount)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatAmount(f.pending_amount)}</td>
                    <td className="px-3 py-2"><StatusBadge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>
        </>
      )}
    </div>
  );
}
