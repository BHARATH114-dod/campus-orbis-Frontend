import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { fetchSuperCourseRequests, approveCourseRequest, rejectCourseRequest } from '../services/courseAccessService';
import api from '../services/api';

const DURATIONS = [
  { value: 1, label: '1 Month' }, { value: 3, label: '3 Months' }, { value: 6, label: '6 Months' },
  { value: 12, label: '1 Year' }, { value: 24, label: '2 Years' }, { value: 'custom', label: 'Custom Date' },
];

// Super Admin → Payment Verification Panel (spec §9). Every pending
// request as a glass card; Approve opens the duration picker, Reject asks
// for an optional reason.
export default function SuperPaymentVerification() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [approveTarget, setApproveTarget] = useState(null);
  const [duration, setDuration] = useState(1);
  const [customDate, setCustomDate] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true);
    fetchSuperCourseRequests(filter).then((res) => setRequests(res.requests)).catch((err) => showToast(err.message || 'Could not load requests.', 'error')).finally(() => setLoading(false));
  }

  async function handleApprove() {
    try {
      const opts = duration === 'custom' ? { customExpiry: customDate } : { durationMonths: duration };
      await approveCourseRequest(approveTarget.id, opts);
      setApproveTarget(null);
      load();
    } catch (err) {
      showToast(err.message || 'Could not approve that request.', 'error');
    }
  }

  async function handleReject() {
    try {
      await rejectCourseRequest(rejectTarget.id, reason);
      setRejectTarget(null);
      setReason('');
      load();
    } catch (err) {
      showToast(err.message || 'Could not reject that request.', 'error');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Payment Verification</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading requests…" />
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper-card p-8 text-center text-sm text-ink-light">No requests here.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-paper-card p-4">
              <p className="text-sm font-bold text-ink">{r.college_name}</p>
              <p className="text-xs text-ink-light">{r.admin_username} · {r.package_label} ({r.duration_months} mo)</p>
              <img src={`${api.defaults.baseURL}/super/course-requests/${r.id}/screenshot`} alt="Payment screenshot" className="my-3 h-32 w-full rounded-lg border border-line object-contain bg-paper" />
              <p className="text-xs text-ink-light">Txn: {r.transaction_id}</p>
              <p className="text-xs text-ink-light">UPI: {r.upi_id || '—'}</p>
              <p className="text-xs text-ink-light">{new Date(r.created_at).toLocaleString()}</p>
              {r.notes && <p className="mt-1 text-xs italic text-ink-light">"{r.notes}"</p>}
              <p className={`mt-2 text-xs font-semibold ${r.status === 'approved' ? 'text-teal' : r.status === 'rejected' ? 'text-crimson' : 'text-gold'}`}>{r.status}</p>
              {r.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setApproveTarget(r); setDuration(r.duration_months); }} className="flex-1 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                  <button onClick={() => setRejectTarget(r)} className="flex-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-crimson">Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {approveTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-paper-card p-5 max-h-[85vh] overflow-y-auto">
            <h2 className="mb-3 text-sm font-bold text-ink">Approve — choose unlock duration</h2>
            <select value={duration} onChange={(e) => setDuration(e.target.value === 'custom' ? 'custom' : Number(e.target.value))} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink">
              {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            {duration === 'custom' && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setApproveTarget(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink">Cancel</button>
              <button onClick={handleApprove} className="rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white">Approve & Unlock</button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-paper-card p-5 max-h-[85vh] overflow-y-auto">
            <h2 className="mb-3 text-sm font-bold text-ink">Reject request</h2>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" rows={3} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectTarget(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink">Cancel</button>
              <button onClick={handleReject} className="rounded-lg bg-crimson px-3 py-1.5 text-xs font-semibold text-white">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
