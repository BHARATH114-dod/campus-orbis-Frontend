import { useAuth } from '../context/AuthContext';
import StudentPlacements from '../components/placements/StudentPlacements';
import FacultyPlacements from '../components/placements/FacultyPlacements';
import HodPlacements from '../components/placements/HodPlacements';
import CollegeAdminPlacements from '../components/placements/CollegeAdminPlacements';

export default function Placements() {
  const { role } = useAuth();
  if (role === 'student') return <StudentPlacements />;
  if (role === 'faculty') return <FacultyPlacements />;
  if (role === 'hod') return <HodPlacements />;
  if (role === 'college_admin') return <CollegeAdminPlacements />;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      There's nothing to show for your role here.
    </div>
  );
}
