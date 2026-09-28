import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { fetchMyCollege, fetchHods, fetchCollegeAnalytics } from '../../services/collegeAdminService';
import BarList from '../BarList';
import LoadingSpinner from '../common/LoadingSpinner';

export default function CollegeAdminDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { showToast } = useToast();

  const [college, setCollege] = useState(null);
  const [hods, setHods] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMyCollege(), fetchHods(), fetchCollegeAnalytics()])
      .then(([col, hodList, an]) => { setCollege(col); setHods(hodList); setAnalytics(an); })
      .catch((err) => showToast(err.message || 'Could not load your dashboard.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard…" />;

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">{college?.name || 'Your college'}</h1>
      <p className="mb-6 text-sm text-ink-light">Welcome back, {user.name.split(' ')[0]}. Here's the college-wide picture.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={analytics?.totals.students ?? 0} />
        <StatCard label="HODs" value={hods.length} />
        <StatCard label="Events" value={analytics?.totals.events ?? 0} />
        <StatCard label="Open board posts" value={analytics?.totals.open_posts ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading title="Department participation" subtitle="Event RSVPs by department" />
          <div className="rounded-xl border border-line bg-paper-card p-5">
            <BarList data={analytics?.department_participation || []} suffix=" RSVPs" emptyText="No department data yet." />
          </div>

          <SectionHeading title="HODs" className="mt-8" action={<Link to="/attendance" className="text-xs font-semibold text-teal hover:underline">Attendance overview →</Link>} />
          {hods.length === 0 ? (
            <EmptyCard text="No HODs added yet." />
          ) : (
            <div className="space-y-2">
              {hods.map((h) => (
                <div key={h.username} className="flex items-center justify-between rounded-xl border border-line bg-paper-card px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{h.name}</p>
                    <p className="text-xs text-ink-light">{h.department}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-light">{h.username}</span>
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
            <QuickLink to="/events" label="📅 Events" />
            <QuickLink to="/clubs" label="🎭 Clubs" />
            <QuickLink to="/competition" label="🥇 Competition" />
            <QuickLink to="/attendance" label="✅ Attendance" />
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
function SectionHeading({ title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-3 flex items-end justify-between ${className}`}>
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">{title}</h2>
        {subtitle && <p className="text-xs text-ink-light">{subtitle}</p>}
      </div>
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
