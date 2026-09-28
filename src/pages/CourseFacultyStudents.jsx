import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchFacultyCourseStudents, fetchFacultyCourseStudentDetail, fetchFacultyDailyProgress, COURSE_LANGUAGES } from '../services/coursesService';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

// item 2: Faculty → Student Course Status. Assigned-students list (with
// Section/Year/Student/Progress/Completion filters) -> click a student ->
// detailed drill-down with a topic-level Completed/Remaining checklist,
// plus an aggregate daily-progress chart across the class. All data comes
// live from the backend (CourseProgress) — nothing here is hardcoded.
export default function CourseFacultyStudents() {
  const { language } = useParams();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [daily, setDaily] = useState([]);
  const [selected, setSelected] = useState(null);
  const meta = COURSE_LANGUAGES.find((l) => l.value === language);

  // item 2 filters
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minProgress, setMinProgress] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFacultyCourseStudents(language), fetchFacultyDailyProgress(language)])
      .then(([s, d]) => { setStudents(s.students); setDaily(d.series); })
      .catch((err) => showToast(err.message || 'Could not load student progress.', 'error'))
      .finally(() => setLoading(false));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => [...new Set(students.map((s) => s.section_name).filter(Boolean))].sort(), [students]);
  const years = useMemo(() => [...new Set(students.map((s) => s.year).filter(Boolean))].sort(), [students]);

  const filtered = useMemo(() => students.filter((s) => (
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.roll_number || '').toLowerCase().includes(search.toLowerCase()))
    && (!sectionFilter || s.section_name === sectionFilter)
    && (!yearFilter || s.year === yearFilter)
    && (!statusFilter || s.status === statusFilter)
    && (!minProgress || s.progress >= Number(minProgress))
  )), [students, search, sectionFilter, yearFilter, statusFilter, minProgress]);

  if (loading) return <LoadingSpinner fullPage label="Loading student progress…" />;

  if (selected) return <StudentDetail language={language} username={selected} onBack={() => setSelected(null)} />;

  return (
    <div>
      <Link to="/courses" className="text-xs font-semibold text-teal hover:underline">← Courses</Link>
      <div className="mt-2 mb-6 flex items-center gap-3">
        <span className="text-3xl">{meta?.icon}</span>
        <h1 className="text-xl font-bold text-ink">{meta?.label} — Student Status</h1>
      </div>

      {daily.length > 0 && (
        <div className="mb-6 rounded-xl border border-line bg-paper-card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">Class Daily Progress (last 30 days)</h2>
          <div className="flex h-24 items-end gap-1">
            {daily.map((d) => (
              <div key={d.date} className="flex-1 rounded-t bg-teal" style={{ height: `${Math.max(4, d.average_percentage)}%` }} title={`${d.date}: ${d.average_percentage}%`} />
            ))}
          </div>
        </div>
      )}

      {/* item 2: filtering/search by Section, Year, Student, Progress, Completion status */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or roll no…" className="rounded-full border border-line bg-paper-card px-4 py-2 text-sm outline-none focus:border-hero-primary" />
        <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">Any completion status</option>
          <option value="Passed">Passed</option>
          <option value="In Progress">In Progress</option>
          <option value="Not Started">Not Started</option>
        </select>
        <select value={minProgress} onChange={(e) => setMinProgress(e.target.value)} className="rounded-lg border border-line bg-paper-card px-3 py-2 text-sm">
          <option value="">Any progress</option>
          <option value="75">75%+</option>
          <option value="50">50%+</option>
          <option value="25">25%+</option>
          <option value="1">Started (1%+)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          {students.length === 0 ? 'No students assigned to you yet.' : 'No students match these filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-light">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3">Test Score</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.username} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper" onClick={() => setSelected(s.username)}>
                  <td className="px-4 py-3 font-medium text-ink">{s.name} <span className="text-xs text-ink-light">({s.roll_number || s.username})</span></td>
                  <td className="px-4 py-3 text-ink-light">{s.section_name || '—'}</td>
                  <td className="px-4 py-3 text-ink-light">{s.year || '—'}</td>
                  <td className="px-4 py-3 text-ink">{s.progress}%</td>
                  <td className="px-4 py-3 text-ink">{s.todays_progress}%</td>
                  <td className="px-4 py-3 text-ink-light">{s.last_active ? new Date(s.last_active).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-ink">{s.test_score}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === 'Passed' ? 'bg-teal/15 text-teal' : s.status === 'In Progress' ? 'bg-gold/15 text-gold' : 'bg-line text-ink-light'}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentDetail({ language, username, onBack }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState(null);

  useEffect(() => {
    fetchFacultyCourseStudentDetail(language, username)
      .then(setD)
      .catch((err) => showToast(err.message || 'Could not load student detail.', 'error'))
      .finally(() => setLoading(false));
  }, [language, username]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner fullPage label="Loading student…" />;
  if (!d) return null;

  return (
    <div>
      <button onClick={onBack} className="text-xs font-semibold text-teal hover:underline">← Back to students</button>
      <div className="mt-2 mb-6">
        <h1 className="text-xl font-bold text-ink">{d.student.name}</h1>
        <p className="text-xs text-ink-light">{d.student.roll_number || d.student.username} · {d.course.title}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Overall" value={`${d.overall_percentage}%`} />
        <StatBox label="Today" value={`${d.todays_progress}%`} />
        <StatBox label="Avg Score" value={`${d.average_score}%`} />
        <StatBox label="Status" value={d.status} />
        <StatBox label="Tests Attempted" value={d.tests_attempted} />
        <StatBox label="Tests Passed" value={d.tests_passed} />
        <StatBox label="Last Completed" value={d.last_completed_topic || '—'} />
        <StatBox label="Last Active" value={d.last_active ? new Date(d.last_active).toLocaleDateString() : '—'} />
      </div>

      {d.weekly_progress.length > 0 && (
        <div className="mb-6 rounded-xl border border-line bg-paper-card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">This Week</h2>
          <div className="flex h-20 items-end gap-2">
            {d.weekly_progress.map((w) => (
              <div key={w.date} className="flex-1 text-center">
                <div className="mx-auto rounded-t bg-teal" style={{ height: `${Math.max(4, w.percentage)}px`, width: '60%' }} />
                <p className="mt-1 text-[10px] text-ink-light">{w.date.slice(5)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* item 2's example: "Completed: ✓ Introduction ✓ Variables..." /
          "Remaining: ○ Strings ○ OOP..." — rendered per module from the
          same lesson-level completed/locked data the student's own course
          view already uses, not a separate/duplicated data source. */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Topic-wise Completion</h2>
      <div className="space-y-2">
        {d.modules.map((mod) => {
          const completedLessons = mod.lessons.filter((l) => l.completed);
          const remainingLessons = mod.lessons.filter((l) => !l.completed);
          return (
            <details key={mod.id} className="rounded-lg border border-line bg-paper-card p-3" open={completedLessons.length > 0 && remainingLessons.length > 0}>
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Module {mod.order} — {mod.title} ({mod.completed_lessons}/{mod.total_lessons})
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-bold text-teal">Completed</p>
                  {completedLessons.length === 0 ? <p className="text-xs text-ink-light">None yet</p> : (
                    <ul className="space-y-0.5 text-xs text-ink">
                      {completedLessons.map((l) => <li key={l.id}>✓ {l.title}</li>)}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-ink-light">Remaining</p>
                  {remainingLessons.length === 0 ? <p className="text-xs text-ink-light">All done</p> : (
                    <ul className="space-y-0.5 text-xs text-ink-light">
                      {remainingLessons.map((l) => <li key={l.id}>○ {l.title}{l.locked ? ' (locked)' : ''}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-3 text-center">
      <p className="truncate text-sm font-bold text-ink">{value}</p>
      <p className="text-[11px] text-ink-light">{label}</p>
    </div>
  );
}
