import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  fetchStudentCourses, fetchFacultyCourses, fetchFacultyCourseAccess, setFacultyLanguageEnabled, COURSE_LANGUAGES,
} from '../services/coursesService';

/**
 * Courses landing page — the 5 language cards from the brief. Students see
 * lock state (one language per semester, enforced backend-side — this page
 * never bypasses that, it just reflects what the API returns) and their own
 * progress ring. Faculty always see every language unlocked (spec §4) and
 * additionally get the semester-unlock control (spec §3) here.
 */
export default function Courses() {
  const { role } = useAuth();
  return role === 'faculty' ? <FacultyCourses /> : <StudentCourses />;
}

function StudentCourses() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    fetchStudentCourses()
      .then((res) => setCourses(res.courses))
      .catch((err) => showToast(err.message || 'Could not load courses.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage label="Loading courses…" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Courses</h1>
        <p className="text-sm text-ink-light">Your faculty unlocks one language per semester. Locked courses stay visible so you know what's coming.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => <LanguageCard key={c.language} course={c} />)}
      </div>
    </div>
  );
}

function LanguageCard({ course }) {
  const meta = COURSE_LANGUAGES.find((l) => l.value === course.language);
  if (course.locked) {
    return (
      <div className="relative rounded-xl border border-line bg-paper-card p-5 opacity-70">
        <div className="flex items-center gap-3">
          <span className="text-3xl grayscale">{meta.icon}</span>
          <div>
            <p className="font-bold text-ink">{course.label}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold text-ink-light">🔒 Locked</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-light">This course has not been unlocked for your semester.</p>
      </div>
    );
  }
  const p = course.progress;
  return (
    <Link to={`/courses/${course.language}`} className="rounded-xl border border-line bg-paper-card p-5 transition hover:border-teal hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{meta.icon}</span>
        <div className="min-w-0">
          <p className="font-bold text-ink">{course.label}</p>
          <p className="text-xs text-ink-light">{course.label} Full Course</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-teal" style={{ width: `${p?.percentage || 0}%` }} />
        </div>
        <span className="ml-2 text-xs font-semibold text-ink">{p?.percentage || 0}%</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-teal">
        {p?.status === 'passed' ? '🎉 Course Passed' : p?.status === 'in_progress' ? 'Continue →' : 'Start →'}
      </p>
    </Link>
  );
}

function FacultyCourses() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [collegeStatus, setCollegeStatus] = useState('locked');
  const [expiryDate, setExpiryDate] = useState(null);
  const [enabledMap, setEnabledMap] = useState({});
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    Promise.all([fetchFacultyCourses(), fetchFacultyCourseAccess()])
      .then(([coursesRes, accessRes]) => {
        setCourses(coursesRes.courses);
        setCollegeStatus(accessRes.college_status);
        setExpiryDate(accessRes.expiry_date);
        setEnabledMap(accessRes.languages);
      })
      .catch((err) => showToast(err.message || 'Could not load courses.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(language) {
    if (collegeStatus !== 'unlocked') return;
    setToggling(language);
    const nextValue = !enabledMap[language];
    try {
      await setFacultyLanguageEnabled(language, nextValue);
      setEnabledMap((prev) => ({ ...prev, [language]: nextValue }));
    } catch (err) {
      showToast(err.message || 'Could not update that language.', 'error');
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading courses…" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Courses</h1>
        <p className="text-sm text-ink-light">You can preview every language below. Toggle a language ON to make it visible to your assigned students.</p>
      </div>

      {collegeStatus !== 'unlocked' ? (
        <div className="mb-8 rounded-xl border border-line bg-paper-card p-5 text-center">
          <p className="text-2xl">🔒</p>
          <p className="mt-1 text-sm font-bold text-ink">Courses module locked</p>
          <p className="mt-1 text-xs text-ink-light">Your college doesn't have active course access yet. Ask your College Admin to request it from the Request Course page.</p>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-line bg-paper-card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">Enable languages for your students</h2>
          {expiryDate && <p className="mb-3 text-xs text-ink-light">Course access active until {new Date(expiryDate).toLocaleDateString()}.</p>}
          <div className="flex flex-wrap gap-2">
            {COURSE_LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => handleToggle(l.value)}
                disabled={toggling === l.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${enabledMap[l.value] ? 'border-teal bg-teal/10 text-ink' : 'border-line text-ink-light hover:bg-paper'}`}
              >
                <span>{l.icon}</span> {l.label}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${enabledMap[l.value] ? 'bg-teal text-white' : 'bg-line text-ink-light'}`}>{enabledMap[l.value] ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Preview any course</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const meta = COURSE_LANGUAGES.find((l) => l.value === c.language);
          return (
            <Link key={c.language} to={`/courses/${c.language}`} className="rounded-xl border border-line bg-paper-card p-5 transition hover:border-teal hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{meta.icon}</span>
                <div>
                  <p className="font-bold text-ink">{c.label}</p>
                  {enabledMap[c.language] && <span className="text-[11px] font-semibold text-teal">Enabled for students</span>}
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-teal">Preview course →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
