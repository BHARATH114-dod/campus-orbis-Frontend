import { useAuth } from '../context/AuthContext';
import FacultyTests from '../components/tests/FacultyTests';
import StudentTests from '../components/tests/StudentTests';
import HodTests from '../components/tests/HodTests';

export default function Tests() {
  const { role } = useAuth();
  if (role === 'faculty') return <FacultyTests />;
  if (role === 'student') return <StudentTests />;
  if (role === 'hod') return <HodTests />;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      Tests are created by faculty and taken by students — there's nothing to show for your role here.
    </div>
  );
}
