import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { fetchMyStudents } from '../../services/facultyService';
import { fetchMyTimetableForDate } from '../../services/timetableService';
import { submitAttendance, fetchSectionAttendance } from '../../services/attendanceService';
import LoadingSpinner from '../common/LoadingSpinner';
import FaceRecognitionAttendance from './FaceRecognitionAttendance';
import FaceUpdateRequests from './FaceUpdateRequests';
import AttendanceCalendar from './AttendanceCalendar';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Shown wherever we need to be unambiguous about exactly which class an
// action applies to: "CSE-A · Year 3 · Hour 1". Centralized so every screen
// (hour cards, roster header, locked view, success toast) reads identically.
export function slotLabel(slot) {
  return `${slot.section_name}${slot.section_year ? ` · Year ${slot.section_year}` : ''} · Hour ${slot.hour}`;
}

/**
 * The Date → Assigned Hours → Normal/Face Attendance flow itself, with no
 * assumption baked in about the signed-in role beyond "the /faculty/*
 * attendance endpoints will scope everything to whoever is calling them".
 * That's true for Faculty (via their section_ids) AND for an HOD assigned
 * as the teacher for a timetable slot (see server.js's
 * myTeachingSectionIds) — so this same component is reused, unmodified,
 * for both FacultyAttendance below and the HOD's own "My Teaching" tab in
 * HodAttendance.jsx. Exported separately so a caller can drop it in
 * without also getting the Faculty-only "Face Update Requests" reviewer
 * toggle that FacultyAttendance wraps around it.
 */
export function TakeAttendance() {
  const { showToast } = useToast();
  const [date, setDate] = useState(todayStr());
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [activeSlot, setActiveSlot] = useState(null); // the slot currently open for marking
  const [mode, setMode] = useState('normal'); // 'normal' | 'face'

  useEffect(() => {
    fetchMyStudents().then(setStudents).catch(() => {});
  }, []);

  const loadTimetable = () => {
    setLoading(true);
    setActiveSlot(null);
    fetchMyTimetableForDate(date)
      .then(setTimetable)
      .catch((err) => showToast(err.message || 'Could not load your timetable.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(loadTimetable, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
      <>
      <p className="mb-4 text-sm text-ink-light">
        Marked strictly according to your timetable — only the hours you're actually scheduled to teach show up here.
      </p>

      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('normal'); setActiveSlot(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'normal' ? 'bg-hero-primary text-white' : 'border border-line text-ink-light'}`}
        >
          Normal Attendance
        </button>
        <button
          type="button"
          onClick={() => { setMode('face'); setActiveSlot(null); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'face' ? 'bg-hero-primary text-white' : 'border border-line text-ink-light'}`}
        >
          Face Recognition Attendance
        </button>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-semibold text-ink">Date</label>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-ink-light">Future dates can't be selected — attendance can only be taken for today or an earlier date.</p>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading your timetable…" />
      ) : !timetable || timetable.slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          Nothing on your timetable for {date} ({timetable?.day_of_week || ''}). Ask your HOD if this looks wrong.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {timetable.slots.map((slot) => {
            return (
              <button
                key={slot.id}
                type="button"
                disabled={slot.is_holiday || slot.is_future}
                onClick={() => setActiveSlot(slot)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  slot.already_taken ? 'border-teal/40 bg-teal/5'
                    : slot.is_holiday ? 'border-line bg-line/20 opacity-70 cursor-not-allowed'
                    : slot.is_future ? 'border-line bg-paper opacity-60 cursor-not-allowed'
                    : 'border-line bg-paper-card hover:bg-paper'
                } ${activeSlot?.id === slot.id ? 'ring-2 ring-teal' : ''}`}
              >
                <p className="text-sm font-semibold text-ink">{slotLabel(slot)}</p>
                <p className="text-xs text-ink-light">{slot.subject_name}</p>
                {slot.already_taken && <p className="mt-1 text-[11px] font-semibold text-teal">🔒 Already submitted</p>}
                {!slot.already_taken && slot.is_holiday && (
                  <p className="mt-1 text-[11px] font-semibold text-ink-light">H · Holiday — attendance is unavailable for this date{slot.holiday_reason ? ` (${slot.holiday_reason})` : ''}.</p>
                )}
                {!slot.already_taken && !slot.is_holiday && slot.is_future && (
                  <p className="mt-1 text-[11px] font-semibold text-ink-light">🔒 Future date — locked</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeSlot && (
        <div className="mt-6">
          {mode === 'normal' ? (
            <SlotRoster
              slot={activeSlot}
              date={date}
              students={students.filter((s) => s.section_id === activeSlot.section_id)}
              onSubmitted={loadTimetable}
            />
          ) : (
            <FaceRecognitionAttendance
              slot={activeSlot}
              date={date}
              onConfirmed={() => { setActiveSlot(null); loadTimetable(); }}
            />
          )}
        </div>
      )}
      </>
  );
}

/**
 * Faculty-facing wrapper: adds the page header and the "Face Update
 * Requests" reviewer toggle (Faculty-only — HODs assigned as a teacher
 * don't get a student-face-update queue in this pass) around the shared
 * TakeAttendance flow above.
 */
export default function FacultyAttendance() {
  const [view, setView] = useState('attendance'); // 'attendance' | 'calendar' | 'face_requests'

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Attendance</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView(view === 'calendar' ? 'attendance' : 'calendar')}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:bg-paper"
          >
            {view === 'calendar' ? 'Back to Attendance' : 'Attendance Calendar'}
          </button>
          <button
            type="button"
            onClick={() => setView(view === 'face_requests' ? 'attendance' : 'face_requests')}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-light hover:bg-paper"
          >
            {view === 'face_requests' ? 'Back to Attendance' : 'Face Update Requests'}
          </button>
        </div>
      </div>

      {view === 'calendar' && <div className="mt-4"><AttendanceCalendar /></div>}
      {view === 'face_requests' && <div className="mt-4"><FaceUpdateRequests /></div>}
      {view === 'attendance' && <TakeAttendance />}
    </div>
  );
}

function SlotRoster({ slot, date, students, onSubmitted }) {
  const { showToast } = useToast();
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchSectionAttendance(slot.section_id)
      .then((history) => {
        const found = history.find((h) => h.date === date && String(h.hour) === String(slot.hour));
        setExisting(found || null);
        if (!found) setMarks(Object.fromEntries(students.map((s) => [s.username, true])));
      })
      .catch((err) => showToast(err.message || 'Could not check this slot.', 'error'))
      .finally(() => setLoading(false));
  }, [slot.id, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const records = students.map((s) => ({ student_username: s.username, present: !!marks[s.username] }));
      await submitAttendance({ sectionId: slot.section_id, date, hour: slot.hour, subjectId: slot.subject_id, records });
      showToast(`Attendance saved for ${slotLabel(slot)}. This cannot be edited once submitted.`, 'success');
      onSubmitted();
    } catch (err) {
      showToast(err.message || 'Could not save attendance.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading roster…" />;
  if (students.length === 0) return <p className="text-sm text-ink-light">No students in this section.</p>;

  if (existing) {
    return (
      <div>
        <div className="mb-4 rounded-lg bg-teal/10 p-3 text-sm text-ink">
          🔒 Attendance for <strong>{slotLabel(slot)} ({slot.subject_name})</strong> was already submitted by {existing.taken_by_name} and is locked.
        </div>
        <div className="space-y-2">
          {students.map((s) => {
            const rec = existing.records.find((r) => r.student_username === s.username);
            return (
              <div key={s.username} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2.5">
                <span className="text-sm">{s.name} <span className="font-mono text-xs text-ink-light">{s.roll_number}</span></span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rec?.present ? 'bg-teal/10 text-teal' : 'bg-crimson/10 text-crimson'}`}>
                  {rec?.present ? 'Present' : 'Absent'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">
        {slotLabel(slot)} · {slot.subject_name}
      </h2>
      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.username} className="flex items-center justify-between rounded-lg border border-line bg-paper-card px-4 py-2.5">
            <span className="text-sm">{s.name} <span className="font-mono text-xs text-ink-light">{s.roll_number}</span></span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMarks((m) => ({ ...m, [s.username]: true }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${marks[s.username] ? 'bg-teal text-white' : 'border border-line text-ink-light'}`}
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => setMarks((m) => ({ ...m, [s.username]: false }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${marks[s.username] === false ? 'bg-crimson text-white' : 'border border-line text-ink-light'}`}
              >
                Absent
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 rounded-lg bg-hero-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : `Save attendance for Hour ${slot.hour}`}
      </button>
    </div>
  );
}
