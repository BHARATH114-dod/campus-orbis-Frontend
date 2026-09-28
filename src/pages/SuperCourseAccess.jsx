import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  fetchSuperCourseAccess, fetchSuperCourseAccessHistory, unlockCollegeCourseAccess, unlockCollegeCourseAccessFree, lockCollegeCourseAccess,
} from '../services/courseAccessService';

const DURATIONS = [
  { value: 1, label: '1 Month' }, { value: 3, label: '3 Months' }, { value: 6, label: '6 Months' },
  { value: 12, label: '1 Year' }, { value: 24, label: '2 Years' }, { value: 'custom', label: 'Custom Date' },
];

// Super Admin → Course Access Management (spec §6). Every college's access
// is independent — changing one never touches another, since every action
// here is scoped by :collegeId on the backend.
export default function SuperCourseAccess() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState([]);
  const [unlockTarget, setUnlockTarget] = useState(null); // { college_id, free }
  const [duration, setDuration] = useState(1);
  const [customDate, setCustomDate] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    fetchSuperCourseAccess().then((res) => setColleges(res.colleges)).catch((err) => showToast(err.message || 'Could not load colleges.', 'error')).finally(() => setLoading(false));
  }

  async function handleLock(collegeId) {
    try {
      await lockCollegeCourseAccess(collegeId);
      load();
    } catch (err) {
      showToast(err.message || 'Could not lock that college.', 'error');
    }
  }

  async function handleConfirmUnlock() {
    if (!unlockTarget) return;
    try {
      const opts = duration === 'custom' ? { customExpiry: customDate } : { durationMonths: duration };
      if (unlockTarget.free) await unlockCollegeCourseAccessFree(unlockTarget.college_id, opts);
      else await unlockCollegeCourseAccess(unlockTarget.college_id, opts);
      setUnlockTarget(null);
      load();
    } catch (err) {
      showToast(err.message || 'Could not unlock that college.', 'error');
    }
  }

  async function openHistory(collegeId) {
    setHistoryTarget(collegeId);
    try {
      const res = await fetchSuperCourseAccessHistory(collegeId);
      setHistory(res.history);
    } catch (err) {
      showToast(err.message || 'Could not load history.', 'error');
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading colleges…" />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Course Access Management</h1>
      <p className="mb-6 text-sm text-ink-light">Every college's course access is independent — changes here never affect another college.</p>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-light">
              <th className="px-4 py-3">College</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Faculties</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.college_id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{c.college_name}</td>
                <td className="px-4 py-3 text-ink-light">{c.admin_name}</td>
                <td className="px-4 py-3 text-ink">{c.total_faculties}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === 'unlocked' ? 'bg-teal/15 text-teal' : 'bg-line text-ink-light'}`}>{c.status === 'unlocked' ? 'Unlocked' : 'Locked'}</span>
                </td>
                <td className="px-4 py-3 text-ink-light">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => { setUnlockTarget({ college_id: c.college_id, free: false }); setDuration(1); }} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink hover:bg-paper">Unlock</button>
                    <button onClick={() => { setUnlockTarget({ college_id: c.college_id, free: true }); setDuration(12); }} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink hover:bg-paper">Unlock Free</button>
                    <button onClick={() => handleLock(c.college_id)} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-crimson hover:bg-crimson/5">Lock</button>
                    <button onClick={() => openHistory(c.college_id)} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink hover:bg-paper">History</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unlockTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-paper-card p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">{unlockTarget.free ? 'Unlock Free' : 'Unlock'} — choose duration</h2>
            <select value={duration} onChange={(e) => setDuration(e.target.value === 'custom' ? 'custom' : Number(e.target.value))} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
              {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            {duration === 'custom' && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setUnlockTarget(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink">Cancel</button>
              <button onClick={handleConfirmUnlock} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-paper-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Request History</h2>
              <button onClick={() => setHistoryTarget(null)} className="text-ink-light">✕</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-ink-light">No requests yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-line p-3 text-xs">
                    <p className="font-semibold text-ink">{h.package} · {h.duration_months} months · {h.status}</p>
                    <p className="text-ink-light">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
