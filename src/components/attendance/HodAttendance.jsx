import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchDeptSections, fetchDeptFaculty } from '../../services/hodService';
import {
  fetchSemesters, createSemester, deleteSemester,
  fetchSubjects, createSubject, deleteSubject,
  fetchSectionTimetable, upsertTimetableSlot, deleteTimetableSlot,
  fetchPeerHods,
  fetchHodAcademicCalendar, upsertAcademicCalendarEntry, deleteAcademicCalendarEntry,
  DAYS_OF_WEEK,
} from '../../services/timetableService';
import { fetchAttendanceReport, attendanceReportCsvUrl, sendLowAttendanceAlert } from '../../services/attendanceService';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import { TakeAttendance } from './FacultyAttendance';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];
// NEW: "My Teaching" — an HOD can be assigned as the teacher for a
// timetable slot (see the Timetable tab's assignee dropdown / assignee_role:
// 'hod'), and now has the same Date → Assigned Hours → Normal/Face
// Attendance flow Faculty gets, reusing TakeAttendance unmodified. The
// backend scopes every one of those calls to timetable rows this HOD is
// personally assigned to teach (myTeachingSectionIds in server.js) — never
// their whole department, and never another faculty member's classes.
const TABS = ['Report', 'My Teaching', 'Subjects', 'Semesters', 'Timetable', 'Academic Calendar'];

const CALENDAR_STATUS_META = {
  WORKING_DAY: { label: 'Working Day', badge: 'bg-teal/10 text-teal', icon: '·' },
  HOLIDAY: { label: 'Holiday', badge: 'bg-crimson/10 text-crimson', icon: 'H' },
  SPECIAL_WORKING_DAY: { label: 'Special Working Day', badge: 'bg-gold/10 text-gold', icon: '★' },
};

// Item 3 (Year + Section): a section carries its own `year` field (see
// /api/hod/sections), but this dropdown previously rendered only the bare
// section name ("A"), so an HOD with, say, both a 1st Year A and a 3rd
// Year A couldn't tell them apart. Shows the stored year rather than
// deriving/guessing one from the section name.
function sectionLabel(s) {
  if (!s) return '—';
  return s.year ? `${s.year} - ${s.name}` : s.name;
}

export default function HodAttendance() {
  const [tab, setTab] = useState('Report');

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Attendance</h1>
      <p className="mb-5 text-sm text-ink-light">
        Manage subjects, semesters, and the timetable that governs when faculty can take attendance.
      </p>

      <div className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
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
      {tab === 'My Teaching' && <TakeAttendance />}
      {tab === 'Subjects' && <SubjectsTab />}
      {tab === 'Semesters' && <SemestersTab />}
      {tab === 'Timetable' && <TimetableTab />}
      {tab === 'Academic Calendar' && <AcademicCalendarTab />}
    </div>
  );
}

// NEW: HOD manages the department's Academic Calendar — holidays, working
// days, and special working days, scoped to the whole department or to one
// year. This is the source of truth Attendance checks before letting
// faculty mark a date, and the only place a date's status can be added,
// changed mid-semester, or removed (spec items 1/2/12/13).
function AcademicCalendarTab() {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [year, setYear] = useState(''); // '' = whole department
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('HOLIDAY');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDeptSections().then(setSections).catch(() => {});
  }, []);

  const years = [...new Set(sections.map((s) => s.year).filter(Boolean))];

  const load = () => {
    setLoading(true);
    fetchHodAcademicCalendar({ year: year || undefined })
      .then((rows) => setEntries(rows.sort((a, b) => (a.date < b.date ? 1 : -1))))
      .catch((err) => showToast(err.message || 'Could not load the academic calendar.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e) => {
    e.preventDefault();
    if (!date) { showToast('Pick a date first.', 'error'); return; }
    setSaving(true);
    try {
      await upsertAcademicCalendarEntry({ date, status, reason, year: year || null });
      showToast(`Saved — ${date} is now ${CALENDAR_STATUS_META[status].label}.`, 'success');
      setDate(''); setReason('');
      load();
    } catch (err) {
      showToast(err.message || 'Could not save this calendar entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAcademicCalendarEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      showToast(err.message || 'Could not remove this entry.', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <label className="mb-1 block text-xs font-semibold text-ink">Applies to</label>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
          <option value="">Whole department (every year)</option>
          {years.map((y) => <option key={y} value={y}>{y} only</option>)}
        </select>
      </div>

      <form onSubmit={handleSave} className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {Object.entries(CALENDAR_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-semibold text-ink">Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Department Event" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save date'}
        </button>
      </form>
      <p className="mb-4 text-xs text-ink-light">
        Saving a date that already has an entry updates it — this is also how you change a working day to a holiday (or back) after the semester has started. Historical attendance already recorded for that date is never deleted.
      </p>

      {loading ? (
        <LoadingSpinner label="Loading calendar…" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-light">No holidays or special working days set yet — every day is treated as a normal working day.</p>
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
                <button type="button" onClick={() => handleDelete(e.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
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
  const [semesters, setSemesters] = useState([]);
  const [semesterId, setSemesterId] = useState('');
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(75);
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    fetchSemesters().then(setSemesters).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAttendanceReport('hod', { semesterId: semesterId || undefined })
      .then(setReport)
      .catch((err) => showToast(err.message || 'Could not load the report.', 'error'))
      .finally(() => setLoading(false));
  }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const belowThreshold = report.filter((r) => r.percentage !== null && r.percentage < threshold);

  const handleAlert = async () => {
    if (!window.confirm(`Send a low-attendance notification to ${belowThreshold.length} student(s) below ${threshold}%?`)) return;
    setSendingAlert(true);
    try {
      const { flagged_count } = await sendLowAttendanceAlert('hod', { threshold, semesterId: semesterId || undefined });
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
          <label className="mb-1 block text-xs font-semibold text-ink">Semester</label>
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            <option value="">All time</option>
            {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <a
          href={attendanceReportCsvUrl('hod', { semesterId: semesterId || undefined })}
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

function SubjectsTab() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const load = () => {
    setLoading(true);
    fetchSubjects().then(setSubjects).catch((err) => showToast(err.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const subject = await createSubject({ name, code });
      setSubjects((prev) => [...prev, subject]);
      setName(''); setCode('');
    } catch (err) {
      showToast(err.message || 'Could not add this subject.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      showToast(err.message || 'Could not remove this subject.', 'error');
    }
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleAdd} className="mb-5 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name" className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (optional)" className="w-28 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      {loading ? <LoadingSpinner label="Loading…" /> : subjects.length === 0 ? (
        <p className="text-sm text-ink-light">No subjects yet.</p>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2.5">
              <span className="text-sm">{s.name} {s.code && <span className="font-mono text-xs text-ink-light">({s.code})</span>}</span>
              <button type="button" onClick={() => handleDelete(s.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SemestersTab() {
  const { showToast } = useToast();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchSemesters().then(setSemesters).catch((err) => showToast(err.message, 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !startDate || !endDate) { setError('Name, start date, and end date are all required.'); return; }
    if (startDate > endDate) { setError('Start date must be before end date.'); return; }
    try {
      const sem = await createSemester({ name, startDate, endDate });
      setSemesters((prev) => [sem, ...prev]);
      setName(''); setStartDate(''); setEndDate('');
    } catch (err) {
      setError(err.message || 'Could not add this semester.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSemester(id);
      setSemesters((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      showToast(err.message || 'Could not remove this semester.', 'error');
    }
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleAdd} className="mb-5 space-y-2 rounded-lg border border-dashed border-line p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Semester 5, 2026" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button type="submit" className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white">Add semester</button>
      </form>
      {loading ? <LoadingSpinner label="Loading…" /> : semesters.length === 0 ? (
        <p className="text-sm text-ink-light">No semesters defined yet — attendance will show as "All time" for students until you add one.</p>
      ) : (
        <div className="space-y-2">
          {semesters.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2.5">
              <span className="text-sm">{s.name} <span className="text-xs text-ink-light">({s.start_date} → {s.end_date})</span></span>
              <button type="button" onClick={() => handleDelete(s.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimetableTab() {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [peerHods, setPeerHods] = useState([]); // item 11: any HOD in the same college, any department
  const [sectionId, setSectionId] = useState('');
  const [grid, setGrid] = useState([]); // timetable rows for the selected section
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { day, hour }

  useEffect(() => {
    Promise.all([fetchDeptSections(), fetchSubjects(), fetchDeptFaculty(), fetchPeerHods()])
      .then(([secs, subs, fac, hods]) => {
        setSections(secs);
        setSubjects(subs);
        setFaculty(fac);
        setPeerHods(hods);
        if (secs[0]) setSectionId(secs[0].id);
      })
      .catch((err) => showToast(err.message || 'Could not load timetable setup.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGrid = () => {
    if (!sectionId) return;
    fetchSectionTimetable(sectionId).then(setGrid).catch((err) => showToast(err.message, 'error'));
  };
  useEffect(loadGrid, [sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellFor = (day, hour) => grid.find((g) => g.day_of_week === day && String(g.hour) === String(hour));

  const handleRemove = async (id) => {
    try {
      await deleteTimetableSlot(id);
      loadGrid();
    } catch (err) {
      showToast(err.message || 'Could not remove this slot.', 'error');
    }
  };

  if (loading) return <LoadingSpinner label="Loading…" />;
  if (sections.length === 0) return <p className="text-sm text-ink-light">Create a section first.</p>;
  if (subjects.length === 0 || faculty.length === 0) {
    return <p className="text-sm text-ink-light">Add at least one subject and one faculty member before building a timetable.</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-semibold text-ink">Year &amp; Section</label>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
          {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
        </select>
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
                    <td key={day} className="border border-line p-1 align-top">
                      {cell ? (
                        <div className="rounded bg-teal/10 p-1.5">
                          <p className="font-semibold text-ink">{subjects.find((s) => s.id === cell.subject_id)?.name || '—'}</p>
                          <p className="text-ink-light">
                            {(cell.assignee_role === 'hod' ? peerHods.find((h) => h.username === cell.faculty_username)?.name : faculty.find((f) => f.username === cell.faculty_username)?.name) || cell.faculty_username}
                            {cell.assignee_role === 'hod' && <span className="ml-1 rounded bg-gold/20 px-1 text-[9px] font-bold uppercase text-gold">HOD</span>}
                          </p>
                          <button type="button" onClick={() => handleRemove(cell.id)} className="mt-0.5 text-[10px] font-semibold text-crimson hover:underline">
                            remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingCell({ day, hour })}
                          className="grid h-full min-h-[52px] w-full place-items-center rounded text-ink-light hover:bg-paper"
                        >
                          + Add
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CellEditModal
        cell={editingCell}
        sectionId={sectionId}
        subjects={subjects}
        faculty={faculty}
        peerHods={peerHods}
        onClose={() => setEditingCell(null)}
        onSaved={() => { setEditingCell(null); loadGrid(); }}
      />
    </div>
  );
}

function CellEditModal({ cell, sectionId, subjects, faculty, peerHods, onClose, onSaved }) {
  const { showToast } = useToast();
  const [subjectId, setSubjectId] = useState('');
  const [assigneeRole, setAssigneeRole] = useState('faculty'); // item 11: 'faculty' | 'hod'
  const [assigneeUsername, setAssigneeUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSubjectId(subjects[0]?.id || '');
    setAssigneeRole('faculty');
    setAssigneeUsername(faculty[0]?.username || '');
  }, [cell]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cell) return null;

  const handleRoleChange = (role) => {
    setAssigneeRole(role);
    setAssigneeUsername(role === 'hod' ? (peerHods[0]?.username || '') : (faculty[0]?.username || ''));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await upsertTimetableSlot({ sectionId, dayOfWeek: cell.day, hour: cell.hour, subjectId, assigneeUsername, assigneeRole });
      onSaved();
    } catch (err) {
      showToast(err.message || 'Could not save this slot.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const assigneeOptions = assigneeRole === 'hod' ? peerHods : faculty;

  return (
    <Modal open onClose={onClose} title={`${cell.day[0].toUpperCase() + cell.day.slice(1)} · Hour ${cell.hour}`}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Subject</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Assign to</label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleRoleChange('faculty')}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${assigneeRole === 'faculty' ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink-light hover:bg-paper'}`}
            >
              Faculty
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('hod')}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${assigneeRole === 'hod' ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink-light hover:bg-paper'}`}
            >
              HOD
            </button>
          </div>
          {assigneeOptions.length === 0 ? (
            <p className="text-xs text-ink-light">{assigneeRole === 'hod' ? 'No other HODs in your college yet.' : 'No faculty in your department yet.'}</p>
          ) : (
            <select value={assigneeUsername} onChange={(e) => setAssigneeUsername(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
              {assigneeOptions.map((f) => (
                <option key={f.username} value={f.username}>{f.name}{assigneeRole === 'hod' && f.department ? ` (${f.department})` : ''}</option>
              ))}
            </select>
          )}
        </div>
        <button type="submit" disabled={submitting || assigneeOptions.length === 0} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Modal>
  );
}
