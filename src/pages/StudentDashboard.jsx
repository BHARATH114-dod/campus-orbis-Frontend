import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { fetchMyAttendance } from '../services/attendanceService';
import { fetchEvents } from '../services/eventService';
import { fetchNotes } from '../services/noteService';
import { fetchLeaderboard } from '../services/leaderboardService';
import { isPastDate } from '../utils/date';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState(null);
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    Promise.all([fetchMyAttendance(), fetchEvents(), fetchNotes(), fetchLeaderboard({ scope: 'college' })])
      .then(([att, evts, nts, lb]) => { setAttendance(att); setEvents(evts); setNotes(nts); setLeaderboard(lb); })
      .catch((err) => showToast(err.message || 'Could not load your dashboard.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard…" />;

  const upcomingEvents = events.filter((e) => !isPastDate(e.date)).slice(0, 4);
  const bookmarkedNotes = notes.filter((n) => n.bookmarked);
  const recentNotifications = notifications.slice(0, 5);
  const myRank = leaderboard?.me?.rank ?? null;

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">Welcome back, {user.name.split(' ')[0]}</h1>
      <p className="mb-6 text-sm text-ink-light">Here's what's happening on campus.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Attendance" value={attendance?.percentage === null ? '—' : `${attendance?.percentage}%`} />
        <StatCard label="Leaderboard rank" value={myRank ? `#${myRank}` : '—'} />
        <StatCard label="Bookmarked notes" value={bookmarkedNotes.length} />
        <StatCard label="Upcoming events" value={upcomingEvents.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading title="Upcoming events" action={<Link to="/events" className="text-xs font-semibold text-teal hover:underline">View all →</Link>} />
          {upcomingEvents.length === 0 ? (
            <EmptyCard text="No upcoming events." />
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-card px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{e.title}</p>
                    <p className="text-xs text-ink-light">{e.date} · {e.venue || 'TBA'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${e.rsvped ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>
                    {e.rsvped ? "You're going" : 'Not RSVP\u2019d'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <SectionHeading title="Bookmarked notes" className="mt-8" action={<Link to="/notes" className="text-xs font-semibold text-teal hover:underline">View all →</Link>} />
          {bookmarkedNotes.length === 0 ? (
            <EmptyCard text="You haven't bookmarked any notes yet." />
          ) : (
            <div className="space-y-2">
              {bookmarkedNotes.slice(0, 4).map((n) => (
                <div key={n.id} className="rounded-xl border border-line bg-paper-card px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="text-xs text-ink-light">{n.subject}</p>
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
            <QuickLink to="/attendance" label="✅ Attendance" />
            <QuickLink to="/notes" label="📝 Notes" />
            <QuickLink to="/clubs" label="🎭 Clubs" />
            <QuickLink to="/competition" label="🥇 Competition" />
            <QuickLink to="/leaderboard" label="🏆 Leaderboard" />
          </div>
        </section>
      </div>
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
  return <div className="rounded-xl border border-dashed border-line bg-paper-card p-5 text-center text-sm text-ink-light">{text}</div>;
}
function QuickLink({ to, label }) {
  return (
    <Link to={to} className="rounded-xl border border-line bg-paper-card px-4 py-3 text-center text-sm font-semibold text-ink hover:bg-paper">
      {label}
    </Link>
  );
}
