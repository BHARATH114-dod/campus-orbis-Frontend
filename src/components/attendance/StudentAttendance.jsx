import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchMyAttendance } from '../../services/attendanceService';
import LoadingSpinner from '../common/LoadingSpinner';
import FaceRegistration from './FaceRegistration';

export default function StudentAttendance() {
  const { showToast } = useToast();
  const [semesterId, setSemesterId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMyAttendance(semesterId || undefined)
      .then(setData)
      .catch((err) => showToast(err.message || 'Could not load your attendance.', 'error'))
      .finally(() => setLoading(false));
  }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <LoadingSpinner label="Loading your attendance…" />;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">My Attendance</h1>
        {data.semesters.length > 0 && (
          <select
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          >
            <option value="">All time</option>
            {data.semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-paper-card p-6 text-center">
        <p className="text-4xl font-extrabold text-teal">
          {data.percentage === null ? '—' : `${data.percentage}%`}
        </p>
        <p className="mt-1 text-sm text-ink-light">
          {data.present_count} / {data.total_count} classes attended
        </p>
      </div>

      <div className="mb-6">
        <FaceRegistration />
      </div>

      {data.by_subject.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-light">Subject-wise</h2>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                <tr>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2 text-right">Present</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.by_subject.map((s) => (
                  <tr key={s.subject_id} className="border-t border-line bg-paper-card">
                    <td className="px-4 py-2">{s.subject_name}</td>
                    <td className="px-4 py-2 text-right">{s.present_count}</td>
                    <td className="px-4 py-2 text-right">{s.total_count}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${s.percentage !== null && s.percentage < 75 ? 'text-crimson' : 'text-teal'}`}>
                      {s.percentage === null ? '—' : `${s.percentage}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-light">History</h2>
        {data.history.length === 0 ? (
          <p className="text-sm text-ink-light">No attendance recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{h.date}{h.hour ? ` · Hour ${h.hour}` : ''}</span>
                  {h.subject_name && <span className="ml-2 text-ink-light">{h.subject_name}</span>}
                  {h.method === 'FACE_RECOGNITION' && (
                    <span className="ml-2 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">Face</span>
                  )}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${h.present ? 'bg-teal/10 text-teal' : 'bg-crimson/10 text-crimson'}`}>
                  {h.present ? 'Present' : 'Absent'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
