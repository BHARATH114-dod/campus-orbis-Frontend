import { useAuth } from '../context/AuthContext';
import CollegeAdminDashboard from '../components/dashboard/CollegeAdminDashboard';
import HodDashboard from '../components/dashboard/HodDashboard';
import SuperAdminDashboard from '../components/dashboard/SuperAdminDashboard';

export default function AdminDashboard() {
  const { role } = useAuth();
  if (role === 'college_admin') return <CollegeAdminDashboard />;
  if (role === 'hod') return <HodDashboard />;
  if (role === 'super_admin') return <SuperAdminDashboard />;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      There's nothing to show for your role here.
    </div>
  );
}
