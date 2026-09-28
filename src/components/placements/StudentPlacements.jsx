import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchDrives, applyToDrive, withdrawApplication } from '../../services/placementService';
import LoadingSpinner from '../common/LoadingSpinner';

const STATUS_STYLE = {
  applied: 'bg-line/50 text-ink-light',
  shortlisted: 'bg-gold/10 text-gold',
  selected: 'bg-teal/10 text-teal',
  rejected: 'bg-crimson/10 text-crimson',
};

export default function StudentPlacements() {
  const { showToast } = useToast();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    fetchDrives().then(setDrives).catch((err) => showToast(err.message || 'Could not load placement drives.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = async (id) => {
    setBusyId(id);
    try {
      await applyToDrive(id);
      showToast('Application submitted.', 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not apply.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (id) => {
    if (!window.confirm('Withdraw your application to this drive?')) return;
    setBusyId(id);
    try {
      await withdrawApplication(id);
      showToast('Application withdrawn.', 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not withdraw.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingSpinner label="Loading placement drives…" />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Placements</h1>
      <p className="mb-6 text-sm text-ink-light">Browse placement drives and track your applications.</p>

      {drives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No placement drives posted yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {drives.map((d) => (
            <div key={d.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{d.company_name}</h3>
                  <p className="text-sm text-ink-light">{d.role_title}</p>
                </div>
                {d.package_info && <span className="shrink-0 rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal">{d.package_info}</span>}
              </div>
              {d.description && <p className="mt-2 line-clamp-2 text-sm text-ink-light">{d.description}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                <span>📅 Drive: {d.drive_date}</span>
                <span>⏰ Apply by: {d.apply_by}</span>
              </div>

              {d.eligible === false && (
                <p className="mt-3 text-xs font-semibold text-crimson">Not open to your department.</p>
              )}

              <div className="mt-4">
                {d.my_application ? (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[d.my_application.status]}`}>
                      {d.my_application.status}
                    </span>
                    {d.my_application.status === 'applied' && (
                      <button
                        type="button"
                        onClick={() => handleWithdraw(d.id)}
                        disabled={busyId === d.id}
                        className="text-xs font-semibold text-crimson hover:underline disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                ) : d.is_open && d.eligible !== false ? (
                  <button
                    type="button"
                    onClick={() => handleApply(d.id)}
                    disabled={busyId === d.id}
                    className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === d.id ? 'Applying…' : 'Apply'}
                  </button>
                ) : (
                  <span className="rounded-full bg-line/50 px-3 py-1 text-xs font-semibold text-ink-light">
                    {d.is_open ? 'Not eligible' : 'Closed'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
