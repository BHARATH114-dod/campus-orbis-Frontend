import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchDrives } from '../../services/placementService';
import LoadingSpinner from '../common/LoadingSpinner';

// Faculty get read-only visibility into what's available to their students —
// there's no faculty-specific placement report on the backend (that level
// of detail lives with HOD/College Admin), so this stays a simple browse
// view rather than pretending to have per-section stats it can't back up.
export default function FacultyPlacements() {
  const { showToast } = useToast();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrives().then(setDrives).catch((err) => showToast(err.message || 'Could not load placement drives.', 'error')).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner label="Loading placement drives…" />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Placements</h1>
      <p className="mb-6 text-sm text-ink-light">Drives currently open to your students.</p>

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
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                <span>📅 Drive: {d.drive_date}</span>
                <span>⏰ Apply by: {d.apply_by}</span>
                <span>{d.applicant_count} applicant{d.applicant_count === 1 ? '' : 's'}</span>
              </div>
              <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${d.is_open ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>
                {d.is_open ? 'Open' : 'Closed'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
