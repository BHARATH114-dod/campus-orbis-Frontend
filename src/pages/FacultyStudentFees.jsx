import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { fetchMyStudentsFees } from '../services/facultyService';
import LoadingSpinner from '../components/common/LoadingSpinner';

// item 16: Faculty can view fee details for exactly the students assigned
// to them (their own sections) — never any other student in the college.
// Read-only: only AO Office edits fee records, from the exact same
// StudentFees collection this page reads (see /api/faculty/students/fees).
function formatAmount(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
}
const STATUS_LABEL = { complete: 'Paid', partial: 'Partially Paid', pending: 'Pending', not_applicable: 'Not Applicable' };
const STATUS_CLASS = {
  complete: 'bg-teal/10 text-teal',
  partial: 'bg-gold/10 text-gold',
  pending: 'bg-crimson/10 text-crimson',
  not_applicable: 'bg-line/50 text-ink-light',
};
function StatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[status] || STATUS_CLASS.not_applicable}`}>{STATUS_LABEL[status] || status}</span>;
}

export default function FacultyStudentFees() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchMyStudentsFees()
      .then(setStudents)
      .catch((err) => showToast(err.message || 'Could not load fee details.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q) || s.roll_number?.toLowerCase().includes(q));
  }, [students, query]);

  if (loading) return <LoadingSpinner fullPage label="Loading fee details…" />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">Fee Details</h1>
        <p className="text-sm text-ink-light">Read-only — fee records are entered and updated by AO Office.</p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No section assigned yet, or no students in your sections.
        </div>
      ) : (
        <>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or roll number…"
            className="mb-3 w-full max-w-sm rounded-full border border-line bg-paper-card px-4 py-2 text-sm outline-none focus:border-hero-primary"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-ink-light">No students match &quot;{query}&quot;.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-ink-light">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Roll No.</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <>
                      <tr key={s.username} className="border-t border-line bg-paper-card">
                        <td className="px-4 py-3">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                        <td className="px-4 py-3 text-ink-light">{s.course_label || 'Not set'}</td>
                        <td className="px-4 py-3 text-ink-light">{s.section_name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatAmount(s.fees.total_amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatAmount(s.fees.paid_amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatAmount(s.fees.pending_amount)}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.fees.status} /></td>
                        <td className="px-4 py-3 text-right">
                          {s.fees.fee_items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpanded(expanded === s.username ? null : s.username)}
                              className="text-xs font-semibold text-teal hover:underline"
                            >
                              {expanded === s.username ? 'Hide' : 'Breakdown'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === s.username && (
                        <tr key={`${s.username}-detail`} className="border-t border-line bg-paper">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="overflow-hidden rounded-xl border border-line">
                              <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-paper-card text-left uppercase text-ink-light">
                                  <tr>
                                    <th className="px-3 py-2">Fee Type</th>
                                    <th className="px-3 py-2">Total</th>
                                    <th className="px-3 py-2">Paid</th>
                                    <th className="px-3 py-2">Pending</th>
                                    <th className="px-3 py-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.fees.fee_items.map((f) => (
                                    <tr key={f.id} className="border-t border-line">
                                      <td className="px-3 py-2 font-semibold text-ink">{f.fee_type}</td>
                                      <td className="px-3 py-2 font-mono">{formatAmount(f.total_amount)}</td>
                                      <td className="px-3 py-2 font-mono">{formatAmount(f.paid_amount)}</td>
                                      <td className="px-3 py-2 font-mono">{formatAmount(f.pending_amount)}</td>
                                      <td className="px-3 py-2"><StatusBadge status={f.status} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
