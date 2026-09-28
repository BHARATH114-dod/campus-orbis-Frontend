import { useAuth } from '../context/AuthContext';
import HodPeople from '../components/people/HodPeople';
import CollegeAdminPeople from '../components/people/CollegeAdminPeople';

// UPDATED: replicates the original app's Sections/Faculty/Students screens
// inside the React rebuild, role-branched to match the existing hierarchy
// exactly — HOD gets full create/remove (their own department only),
// College Admin gets a read-only college-wide view for oversight (adding
// faculty/students stays HOD's job, same as the backend already enforces).
export default function People() {
  const { role } = useAuth();
  if (role === 'hod') return <HodPeople />;
  if (role === 'college_admin') return <CollegeAdminPeople />;
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
      There's nothing to show for your role here.
    </div>
  );
}
