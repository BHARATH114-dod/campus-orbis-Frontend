import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchFaceUpdateRequests, decideFaceUpdateRequest } from '../../services/faceService';
import LoadingSpinner from '../common/LoadingSpinner';

export default function FaceUpdateRequests() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    fetchFaceUpdateRequests()
      .then(setRequests)
      .catch((err) => showToast(err.message || 'Could not load face update requests.', 'error'));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (id, decision) => {
    setBusyId(id);
    try {
      await decideFaceUpdateRequest(id, decision);
      showToast(`Request ${decision === 'approve' ? 'approved' : 'rejected'}.`, 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not update this request.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (!requests) return <LoadingSpinner size="sm" label="Loading face update requests…" />;

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Face Update Requests</h2>
      {pending.length === 0 ? (
        <p className="mb-4 text-sm text-ink-light">No pending requests.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-paper-card p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{r.student_name} <span className="font-mono text-xs text-ink-light">{r.roll_number}</span></p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.current_face_status === 'registered' ? 'bg-teal/10 text-teal' : 'bg-amber-500/10 text-amber-600'}`}>
                  {r.current_face_status === 'registered' ? 'Face Registered' : 'Not Registered'}
                </span>
              </div>
              <p className="mb-2 text-xs text-ink-light">{r.branch} · {r.year} · {r.section_name}</p>
              {r.reason && <p className="mb-3 text-sm text-ink">"{r.reason}"</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'approve')}
                  className="rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'reject')}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">Past requests</h3>
          <div className="space-y-1.5">
            {decided.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2 text-sm">
                <span>{r.student_name} <span className="font-mono text-xs text-ink-light">{r.roll_number}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === 'approved' ? 'bg-teal/10 text-teal' : 'bg-crimson/10 text-crimson'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
