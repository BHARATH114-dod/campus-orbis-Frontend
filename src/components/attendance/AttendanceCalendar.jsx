import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchMyFullTimetable } from '../../services/timetableService';
import { fetchAttendanceCalendar } from '../../services/attendanceService';
import LoadingSpinner from '../common/LoadingSpinner';

const todayMonth = () => new Date().toISOString().slice(0, 7);

// Per-date status → the exact glyph set from the spec: ✓ completed,
// ✗ pending, H holiday, 🔒 locked/future. Colour is never the only signal —
// every cell also carries its own text glyph and a title tooltip.
const DAY_META = {
  completed: { glyph: '✓', className: 'bg-teal/15 text-teal', title: 'Attendance marked' },
  pending: { glyph: '✗', className: 'bg-crimson/10 text-crimson', title: 'Working day — attendance not yet marked' },
  holiday: { glyph: 'H', className: 'bg-line/60 text-ink-light', title: 'Holiday' },
  future: { glyph: '🔒', className: 'bg-paper text-ink-light/60', title: 'Future date — locked' },
  no_class: { glyph: '', className: 'bg-transparent text-ink-light/30', title: 'No class scheduled' },
};

/**
 * Faculty's own Attendance Calendar + Summary for one section, per month —
 * spec items 5/6. Pick a section, see the month grid and the eligible /
 * completed / pending / holiday counts, computed strictly from this
 * faculty's own timetable slots for that section (never bare calendar
 * dates — see the backend's attendance-calendar route).
 */
export default function AttendanceCalendar() {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(todayMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyFullTimetable()
      .then(({ sections: secs }) => {
        setSections(secs);
        if (secs[0]) setSectionId(secs[0].id);
      })
      .catch((err) => showToast(err.message || 'Could not load your sections.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sectionId) return;
    setLoading(true);
    fetchAttendanceCalendar(sectionId, month)
      .then(setData)
      .catch((err) => showToast(err.message || 'Could not load the attendance calendar.', 'error'))
      .finally(() => setLoading(false));
  }, [sectionId, month]); // eslint-disable-line react-hooks/exhaustive-deps

  if (sections.length === 0 && !loading) {
    return <p className="text-sm text-ink-light">You aren't assigned to any section yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.year ? `${s.year} - ${s.name}` : s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
      </div>

      {loading || !data ? (
        <LoadingSpinner label="Loading calendar…" />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Eligible Working Days" value={data.summary.eligible_working_days} />
            <SummaryCard label="Attendance Completed" value={data.summary.attendance_completed} tone="text-teal" />
            <SummaryCard label="Attendance Pending" value={data.summary.attendance_pending} tone="text-crimson" />
            <SummaryCard label="Holidays" value={data.summary.holidays} />
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-ink-light">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <CalendarGrid days={data.days} />

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-light">
            <span><span className="mr-1 rounded bg-teal/15 px-1.5 py-0.5 font-bold text-teal">✓</span>Marked</span>
            <span><span className="mr-1 rounded bg-crimson/10 px-1.5 py-0.5 font-bold text-crimson">✗</span>Pending</span>
            <span><span className="mr-1 rounded bg-line/60 px-1.5 py-0.5 font-bold text-ink-light">H</span>Holiday</span>
            <span><span className="mr-1 rounded bg-paper px-1.5 py-0.5 font-bold">🔒</span>Future (locked)</span>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-line bg-paper-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-light">{label}</p>
      <p className={`text-xl font-bold ${tone || 'text-ink'}`}>{value}</p>
    </div>
  );
}

function CalendarGrid({ days }) {
  if (!days.length) return null;
  const firstDow = new Date(`${days[0].date}T00:00:00`).getDay();
  const leadingBlanks = Array.from({ length: firstDow });
  return (
    <div className="mt-1 grid grid-cols-7 gap-1.5">
      {leadingBlanks.map((_, i) => <div key={`b${i}`} />)}
      {days.map((d) => {
        const meta = DAY_META[d.status] || DAY_META.no_class;
        const dayNum = Number(d.date.slice(-2));
        return (
          <div
            key={d.date}
            title={`${d.date}${d.reason ? ` — ${d.reason}` : ''} · ${meta.title}`}
            className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg text-[11px] touch-manipulation ${meta.className}`}
          >
            <span className="leading-none">{dayNum}</span>
            {meta.glyph && <span className="mt-0.5 text-xs font-bold leading-none">{meta.glyph}</span>}
          </div>
        );
      })}
    </div>
  );
}
