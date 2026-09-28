import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { fetchDeptSections, fetchDeptFaculty, fetchHodAnalytics } from '../../services/hodService';
import BarList from '../BarList';
import LoadingSpinner from '../common/LoadingSpinner';

export default function HodDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { showToast } = useToast();

  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDeptSections(), fetchDeptFaculty(), fetchHodAnalytics()])
      .then(([secs, fac, an]) => { setSections(secs); setFaculty(fac); setAnalytics(an); })
      .catch((err) => showToast(err.message || 'Could not load your dashboard.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage label="Loading your dashboard…" />;

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">{user.department}</h1>
      <p className="mb-6 text-sm text-ink-light">Welcome back, {user.name.split(' ')[0]}. Here's your department at a glance.</p>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={analytics?.totals.students ?? 0} />
        <StatCard label="Sections" value={analytics?.totals.sections ?? 0} />
        <StatCard label="Faculty" value={faculty.length} />
        <StatCard label="Avg. attendance" value={avgOf(analytics?.attendance_by_section) + '%'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHeading title="Students by section" />
          <div className="mb-8 rounded-xl border border-line bg-paper-card p-5">
            <BarList data={analytics?.students_by_section || []} emptyText="No sections yet." />
          </div>

          <SectionHeading title="Attendance by section" subtitle="Overall %, all subjects combined" action={<Link to="/attendance" className="text-xs font-semibold text-teal hover:underline">Full report →</Link>} />
          <div className="mb-8 rounded-xl border border-line bg-paper-card p-5">
            <BarList data={analytics?.attendance_by_section || []} suffix="%" emptyText="No attendance recorded yet." />
          </div>

          <SectionHeading title="Marks by section" subtitle="Average score, all recorded tests" />
          <div className="rounded-xl border border-line bg-paper-card p-5">
            <BarList data={analytics?.marks_by_section || []} suffix="%" emptyText="No marks recorded yet." />
          </div>
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
            <QuickLink to="/events" label="📅 Events" />
            <QuickLink to="/leaderboard" label="🏆 Leaderboard" />
          </div>
        </section>
      </div>
    </div>
  );
}

function avgOf(list) {
  if (!list || list.length === 0) return 0;
  return Math.round(list.reduce((sum, d) => sum + d.count, 0) / list.length);
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
