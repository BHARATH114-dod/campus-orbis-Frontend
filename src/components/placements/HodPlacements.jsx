import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchPlacementReport } from '../../services/placementService';
import LoadingSpinner from '../common/LoadingSpinner';

export default function HodPlacements() {
  const { showToast } = useToast();
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlacementReport('hod')
      .then(setReport)
      .catch((err) => showToast(err.message || 'Could not load the placement report.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = report.reduce((acc, r) => ({
    applied: acc.applied + r.applied, selected: acc.selected + r.selected,
  }), { applied: 0, selected: 0 });

  if (loading) return <LoadingSpinner label="Loading placement report…" />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Placements</h1>
      <p className="mb-6 text-sm text-ink-light">Your department's participation across every drive.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper-card p-5 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-teal">{totals.applied}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink-light">Applications</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-card p-5 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-teal">{totals.selected}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink-light">Students placed</p>
        </div>
      </div>

      {report.length === 0 ? (
        <p className="text-sm text-ink-light">No placement drives posted yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Applied</th>
                <th className="px-4 py-2 text-right">Shortlisted</th>
                <th className="px-4 py-2 text-right">Selected</th>
                <th className="px-4 py-2 text-right">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.drive_id} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-2">{r.company_name}</td>
                  <td className="px-4 py-2 text-ink-light">{r.role_title}</td>
                  <td className="px-4 py-2 text-right">{r.applied}</td>
                  <td className="px-4 py-2 text-right">{r.shortlisted}</td>
                  <td className="px-4 py-2 text-right font-semibold text-teal">{r.selected}</td>
                  <td className="px-4 py-2 text-right text-crimson">{r.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
