import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchAttendanceReport, attendanceReportCsvUrl, sendLowAttendanceAlert } from '../../services/attendanceService';
import { fetchAllSections } from '../../services/collegeAdminService';
import { fetchCollegeAcademicCalendar } from '../../services/timetableService';
import LoadingSpinner from '../common/LoadingSpinner';

const CALENDAR_STATUS_META = {
  WORKING_DAY: { label: 'Working Day', badge: 'bg-teal/10 text-teal', icon: '·' },
  HOLIDAY: { label: 'Holiday', badge: 'bg-crimson/10 text-crimson', icon: 'H' },
  SPECIAL_WORKING_DAY: { label: 'Special Working Day', badge: 'bg-gold/10 text-gold', icon: '★' },
};

// College Admin gets the college-wide report + export + alert tools, but not
// Subjects/Semesters/Timetable management — those are HOD-owned per
// department, by design (a College Admin can still see the *result* across
// every department at once here). Same for the Academic Calendar: HOD is
// the sole owner/editor (item 3), Admin only ever views it here.
export default function CollegeAdminAttendance() {
  const [tab, setTab] = useState('Report');
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Attendance</h1>
      <p className="mb-5 text-sm text-ink-light">College-wide attendance, across every department.</p>
      <div className="mb-6 flex gap-2 border-b border-line">
        {['Report', 'Academic Calendar'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-teal text-teal' : 'text-ink-light'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Report' && <ReportTab />}
      {tab === 'Academic Calendar' && <AcademicCalendarViewTab />}
    </div>
  );
}

function AcademicCalendarViewTab() {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllSections()
      .then((secs) => {
        setSections(secs);
        if (secs[0]) setDepartment(secs[0].department);
      })
      .catch(() => {});
  }, []);

  const departments = [...new Set(sections.map((s) => s.department).filter(Boolean))];
  const years = [...new Set(sections.filter((s) => s.department === department).map((s) => s.year).filter(Boolean))];

  useEffect(() => {
    if (!department) return;
    setLoading(true);
    fetchCollegeAcademicCalendar({ department, year: year || undefined })
      .then((rows) => setEntries(rows.sort((a, b) => (a.date < b.date ? 1 : -1))))
      .catch((err) => showToast(err.message || 'Could not load the academic calendar.', 'error'))
      .finally(() => setLoading(false));
  }, [department, year]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Branch / Department</label>
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setYear(''); }} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Year</label>
          <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            <option value="">Whole department</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading calendar…" />
      ) : !department ? (
        <p className="text-sm text-ink-light">No departments found yet.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-light">No holidays or special working days set for this selection.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const meta = CALENDAR_STATUS_META[e.status] || {};
            return (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2.5">
                <div className="text-sm">
                  <span className="font-mono font-semibold text-ink">{e.date}</span>{' '}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.icon} {meta.label}</span>
                  <span className="ml-2 text-xs text-ink-light">{e.year ? `${e.year} only` : 'Whole department'}</span>
                  {e.reason && <span className="ml-2 text-xs text-ink-light">— {e.reason}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportTab() {
  const { showToast } = useToast();
  const [department, setDepartment] = useState('');
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(75);
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchAttendanceReport('college_admin', { department: department || undefined })
      .then(setReport)
      .catch((err) => showToast(err.message || 'Could not load the report.', 'error'))
      .finally(() => setLoading(false));
  }, [department]); // eslint-disable-line react-hooks/exhaustive-deps

  const departments = [...new Set(report.map((r) => r.department).filter(Boolean))];
  const belowThreshold = report.filter((r) => r.percentage !== null && r.percentage < threshold);

  const handleAlert = async () => {
    if (!window.confirm(`Send a low-attendance notification to ${belowThreshold.length} student(s) below ${threshold}%?`)) return;
    setSendingAlert(true);
    try {
      const { flagged_count } = await sendLowAttendanceAlert('college_admin', { threshold, department: department || undefined });
      showToast(`Sent to ${flagged_count} student(s).`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not send alerts.', 'error');
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <a
          href={attendanceReportCsvUrl('college_admin', { department: department || undefined })}
          download
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper"
        >
          ⬇ Export CSV
        </a>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Alert threshold %</label>
            <input
              type="number" min={1} max={100} value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-24 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAlert}
            disabled={sendingAlert || belowThreshold.length === 0}
            className="rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sendingAlert ? 'Sending…' : `Alert ${belowThreshold.length} below ${threshold}%`}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading report…" />
      ) : report.length === 0 ? (
        <p className="text-sm text-ink-light">No student attendance data yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Roll No.</th>
                <th className="px-4 py-2 text-right">Present</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.username} className={`border-t border-line bg-paper-card ${r.percentage !== null && r.percentage < threshold ? 'bg-crimson/5' : ''}`}>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-ink-light">{r.department}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.roll_number}</td>
                  <td className="px-4 py-2 text-right">{r.present_count}</td>
                  <td className="px-4 py-2 text-right">{r.total_count}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.percentage !== null && r.percentage < threshold ? 'text-crimson' : 'text-teal'}`}>
                    {r.percentage === null ? '—' : `${r.percentage}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
