import { useAuth } from '../context/AuthContext';
import FacultyTestMonitoring from '../components/monitoring/FacultyTestMonitoring';

export default function TestMonitoring() {
  const { role } = useAuth();
  if (role === 'faculty') return <FacultyTestMonitoring role="faculty" />;
  if (role === 'hod') return <FacultyTestMonitoring role="hod" />;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      Test Monitoring is available to faculty (their own tests) and HOD (read-only, department-wide).
    </div>
  );
}
