import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { fetchMySections, fetchMyStudents, createMyStudent, deleteMyStudent } from '../services/facultyService';
import { fetchSectionAttendance } from '../services/attendanceService';
import { fetchEvents } from '../services/eventService';
import { fetchNotes } from '../services/noteService';
import { isPastDate, todayStr } from '../utils/date';
import { AddStudentModal } from '../components/people/HodPeople';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [attendanceToday, setAttendanceToday] = useState({}); // { [section_id]: boolean }
  const [addStudentOpen, setAddStudentOpen] = useState(false);

  const loadDashboard = () => {
    setLoading(true);
    Promise.all([fetchMySections(), fetchMyStudents(), fetchEvents(), fetchNotes()])
      .then(async ([secs, studs, evts, nts]) => {
        setSections(secs);
        setStudents(studs);
        setEvents(evts);
        setNotes(nts);

        // For each of the faculty's own sections, check whether *any* hour
        // of attendance has been taken today — a quick nudge, not a full
        // per-hour breakdown (that detail lives on the Attendance page).
        const todayFlags = {};
        await Promise.all(
          secs.map(async (s) => {
            try {
              const history = await fetchSectionAttendance(s.id);
              todayFlags[s.id] = history.some((h) => h.date === todayStr());
            } catch {
              todayFlags[s.id] = null; // unknown — don't claim either way
            }
          })
        );
        setAttendanceToday(todayFlags);
      })
      .catch((err) => showToast(err.message || 'Could not load your dashboard.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(loadDashboard, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemoveStudent = async (id) => {
    if (!window.confirm('Remove this student? This cannot be undone.')) return;
    try {
      await deleteMyStudent(id);
      showToast('Student removed.', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'Could not remove this student.', 'error');
    }
  };

  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard…" />;

  const myUpcomingEvents = events
    .filter((e) => e.author_username === user.username && !isPastDate(e.date))
    .slice(0, 4);
  const myNotesCount = notes.filter((n) => n.author_username === user.username).length;
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Welcome back, {user.name.split(' ')[0]}</h1>
      <p className="mb-6 text-sm text-ink-light">Here's what's happening across your sections.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sections" value={sections.length} />
        <StatCard label="Students" value={students.length} />
        <StatCard label="Notes shared" value={myNotesCount} />
        <StatCard label="Upcoming events" value={myUpcomingEvents.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading
            title="Your sections"
            action={
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setAddStudentOpen(true)} className="text-xs font-semibold text-teal hover:underline">+ Add student</button>
                <Link to="/attendance" className="text-xs font-semibold text-teal hover:underline">Take attendance →</Link>
              </div>
            }
          />
          {sections.length === 0 ? (
            <EmptyCard text="No section assigned yet. Ask your HOD to assign you to one." />
          ) : (
            <div className="space-y-2">
              {sections.map((s) => {
                const count = students.filter((st) => st.section_id === s.id).length;
                const taken = attendanceToday[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-card px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-ink-light">{count} student{count === 1 ? '' : 's'}{s.year ? ` · ${s.year}` : ''}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        taken ? 'bg-teal/10 text-teal' : taken === false ? 'bg-gold/10 text-gold' : 'bg-line/50 text-ink-light'
                      }`}
                    >
                      {taken ? 'Attendance taken today' : taken === false ? 'Not taken today' : 'Unknown'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <SectionHeading title="Your students" className="mt-8" />
          {students.length === 0 ? (
            <EmptyCard text="No students in your sections yet." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Roll No.</th><th className="px-4 py-3">Section</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.username} className="border-t border-line bg-paper-card">
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                      <td className="px-4 py-3 text-ink-light">{sections.find((sec) => sec.id === s.section_id)?.name || s.section_id}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => handleRemoveStudent(s.id)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </div>
          )}

          <SectionHeading title="Your upcoming events" className="mt-8" action={<Link to="/events" className="text-xs font-semibold text-teal hover:underline">View all →</Link>} />
          {myUpcomingEvents.length === 0 ? (
            <EmptyCard text="You haven't scheduled any upcoming events." />
          ) : (
            <div className="space-y-2">
              {myUpcomingEvents.map((e) => (
                <div key={e.id} className="rounded-xl border border-line bg-paper-card px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{e.title}</p>
                  <p className="text-xs text-ink-light">{e.date} · {e.rsvp_count} attending</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeading title="Recent notifications" action={<Link to="/notifications" className="text-xs font-semibold text-teal hover:underline">View all →</Link>} />
          {recentNotifications.length === 0 ? (
            <EmptyCard text="Nothing new." />
          ) : (
            <div className="space-y-2">
              {recentNotifications.map((n) => (
                <div key={n.id} className={`rounded-xl border px-4 py-3 text-sm ${n.read ? 'border-line bg-paper-card' : 'border-teal/40 bg-teal/5'}`}>
                  <p className="font-medium text-ink">{n.title}</p>
                  {n.message && <p className="mt-0.5 text-xs text-ink-light">{n.message}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2">
            <QuickLink to="/notes" label="📝 Notes" />
            <QuickLink to="/clubs" label="🎭 Clubs" />
            <QuickLink to="/competition" label="🥇 Competition" />
            <QuickLink to="/attendance" label="✅ Attendance" />
            <QuickLink to="/leaderboard" label="🏆 Leaderboard" />
          </div>
        </section>
      </div>

      <AddStudentModal
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        sections={sections}
        onCreated={loadDashboard}
        createFn={createMyStudent}
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-card p-5 text-center shadow-sm">
      <p className="text-2xl font-extrabold text-teal">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ink-light">{label}</p>
    </div>
  );
}

function SectionHeading({ title, action, className = '' }) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">{title}</h2>
      {action}
    </div>
  );
}

function EmptyCard({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper-card p-5 text-center text-sm text-ink-light">
      {text}
    </div>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link to={to} className="rounded-xl border border-line bg-paper-card px-4 py-3 text-center text-sm font-semibold text-ink hover:bg-paper">
      {label}
    </Link>
  );
}
