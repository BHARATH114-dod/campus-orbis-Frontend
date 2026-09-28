import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchMyFullTimetable, DAYS_OF_WEEK } from '../services/timetableService';
import LoadingSpinner from '../components/common/LoadingSpinner';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

// items 12/13: Faculty sees the COMPLETE timetable for each of their
// assigned sections — every slot, not just their own — with exactly their
// own assigned hours highlighted. View-only: there is no edit/create/delete
// control anywhere on this page (see items 9/10 — that's enforced
// server-side too, this page just never renders one).
export default function FacultyTimetable() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [slots, setSlots] = useState([]);
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    fetchMyFullTimetable()
      .then((data) => {
        setSections(data.sections);
        setSlots(data.slots);
        if (data.sections[0]) setSectionId(data.sections[0].id);
      })
      .catch((err) => showToast(err.message || 'Could not load your timetable.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cellFor = (day, hour) => slots.find((s) => s.section_id === sectionId && s.day_of_week === day && String(s.hour) === String(hour));

  if (loading) return <LoadingSpinner fullPage label="Loading your timetable…" />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">Timetable</h1>
        <p className="text-sm text-ink-light">View-only — your own assigned hours are highlighted below.</p>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No section assigned to you yet.
        </div>
      ) : (
        <>
          {sections.length > 1 && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Year ${s.year}` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="mb-3 flex items-center gap-2 text-xs text-ink-light">
            <span className="inline-block h-3 w-3 rounded bg-gold/30 ring-1 ring-gold" /> Your assigned hours
          </div>
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
                        <td key={day} className={`border border-line p-1.5 align-top ${cell?.is_mine ? 'bg-gold/20 ring-1 ring-inset ring-gold' : ''}`}>
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
        </>
      )}
    </div>
  );
}
