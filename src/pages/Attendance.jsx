import { useAuth } from '../context/AuthContext';
import StudentAttendance from '../components/attendance/StudentAttendance';
import FacultyAttendance from '../components/attendance/FacultyAttendance';
import HodAttendance from '../components/attendance/HodAttendance';
import CollegeAdminAttendance from '../components/attendance/CollegeAdminAttendance';

export default function Attendance() {
  const { role } = useAuth();

  if (role === 'student') return <StudentAttendance />;
  if (role === 'faculty') return <FacultyAttendance />;
  if (role === 'hod') return <HodAttendance />;
  if (role === 'college_admin') return <CollegeAdminAttendance />;

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      There's nothing to show for your role here.
    </div>
  );
}
