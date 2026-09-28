import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchMyStudentTimetable, DAYS_OF_WEEK } from '../services/timetableService';
import LoadingSpinner from '../components/common/LoadingSpinner';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// item 14: a student sees only their own exact section's timetable —
// enforced server-side (GET /api/student/timetable takes no section_id
// parameter at all, so there's nothing to tamper with here).
export default function StudentTimetable() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(null);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    fetchMyStudentTimetable()
      .then((data) => { setSection(data.section); setSlots(data.slots); })
      .catch((err) => showToast(err.message || 'Could not load your timetable.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cellFor = (day, hour) => slots.find((s) => s.day_of_week === day && String(s.hour) === String(hour));

  if (loading) return <LoadingSpinner fullPage label="Loading your timetable…" />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">Timetable</h1>
        <p className="text-sm text-ink-light">{section ? `${section.name}${section.year ? ` · Year ${section.year}` : ''}` : 'No section assigned yet.'}</p>
      </div>

      {!section ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          You haven't been added to a section yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-line bg-paper p-2 text-left">Hour</th>
                {DAYS_OF_WEEK.map((d) => (
                  <th key={d} className="border border-line bg-paper p-2 capitalize">{d.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="border border-line p-2 font-semibold">Hour {hour}</td>
                  {DAYS_OF_WEEK.map((day) => {
                    const cell = cellFor(day, hour);
                    return (
                      <td key={day} className="border border-line p-1.5 align-top">
                        {cell ? (
                          <div>
                            <p className="font-semibold text-ink">{cell.subject_name}</p>
                            <p className="text-ink-light">
                              {cell.assignee_name}
                              {cell.assignee_role === 'hod' && <span className="ml-1 rounded bg-line/50 px-1 text-[9px] font-bold uppercase text-ink-light">HOD</span>}
                            </p>
                          </div>
                        ) : (
                          <span className="text-ink-light">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
