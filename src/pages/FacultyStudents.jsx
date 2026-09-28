import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchMySections, fetchMyStudents, createMyStudent, deleteMyStudent, importMyStudents, previewImportMyStudents, studentImportTemplateUrl,
  adjustStudentPoints, resetStudentPoints, bulkDeleteMyStudents, updateMyStudent,
} from '../services/facultyService';
import { AddStudentModal, ImportStudentsModal } from '../components/people/HodPeople';
import StudentProfileEditModal from '../components/people/StudentProfileEditModal';
import BulkActionBar from '../components/common/BulkActionBar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';

// Dedicated "Students" screen for faculty, linked from the sidebar. Same
// data and endpoints already used on the Faculty Dashboard's "Add student"
// card — this gives faculty a full place to add, search, bulk-remove, and
// edit students in the sections the HOD has assigned to them.
export default function FacultyStudents() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pointsStudent, setPointsStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchMySections(), fetchMyStudents()])
      .then(([secs, studs]) => { setSections(secs); setStudents(studs); setSelected(new Set()); })
      .catch((err) => showToast(err.message || 'Could not load your students.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(loadAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Item 16 (User Search) — this list is already scoped to exactly this
  // faculty member's own students by the backend (fetchMyStudents), so
  // filtering the already-authorized list client-side is safe here; it's
  // not a substitute for the scoped /api/search backend call used by
  // GlobalSearchBar elsewhere, just an instant filter over data we're
  // already allowed to see in full.
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.name?.toLowerCase().includes(q) || s.username?.toLowerCase().includes(q) || s.roll_number?.toLowerCase().includes(q)
    );
  }, [students, query]);

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this student? This cannot be undone.')) return;
    try {
      await deleteMyStudent(id);
      showToast('Student removed.', 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove this student.', 'error');
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkRemoveSelected = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteMyStudents({ ids: [...selected] });
      showToast(`Removed ${result.removed} student${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected students.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAll = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteMyStudents({ removeAll: true });
      showToast(`Removed ${result.removed} student${result.removed === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not remove students.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const sectionName = (id) => sections.find((s) => s.id === id)?.name || id;

  // item 15: Points reset — Selected and All Students modes (Individual is
  // handled inside AdjustPointsModal above, per-student). Both routes
  // through the same backend endpoint, scoped to this faculty member's own
  // sections either way, with a confirmation step before the irreversible
  // reset, per spec.
  const handleResetSelectedPoints = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Reset points to zero for ${selected.size} selected student${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setResettingPoints(true);
    try {
      const result = await resetStudentPoints({ studentIds: [...selected] });
      showToast(`Reset points for ${result.reset_count} student${result.reset_count === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not reset points.', 'error');
    } finally {
      setResettingPoints(false);
    }
  };
  const handleResetAllPoints = async () => {
    if (!window.confirm('Reset points to zero for every student in your sections? This cannot be undone.')) return;
    setResettingPoints(true);
    try {
      const result = await resetStudentPoints({ all: true });
      showToast(`Reset points for ${result.reset_count} student${result.reset_count === 1 ? '' : 's'}.`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Could not reset points.', 'error');
    } finally {
      setResettingPoints(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage label="Loading your students…" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Students</h1>
          <p className="text-sm text-ink-light">
            {user.department ? `${user.department} — ` : ''}add students into your assigned sections, or remove them
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={sections.length === 0}
            className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-paper disabled:opacity-50"
          >
            Import from Excel
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={sections.length === 0}
            className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            + Add student
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, or roll number…"
            className="w-full max-w-sm rounded-full border border-line bg-paper-card px-4 py-2 text-sm outline-none focus:border-hero-primary sm:w-auto"
          />
          <button
            type="button"
            onClick={handleResetSelectedPoints}
            disabled={selected.size === 0 || resettingPoints}
            className="rounded-full border border-crimson px-4 py-2 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-40"
          >
            Reset points ({selected.size})
          </button>
          <button
            type="button"
            onClick={handleResetAllPoints}
            disabled={resettingPoints}
            className="rounded-full border border-crimson px-4 py-2 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-40"
          >
            Reset all points
          </button>
        </div>
      )}

      {students.length > 0 && (
        <BulkActionBar
          total={filteredStudents.length}
          selectedCount={selected.size}
          onSelectAll={() => setSelected(new Set(filteredStudents.map((s) => s.id)))}
          onDeselectAll={() => setSelected(new Set())}
          onRemoveSelected={handleBulkRemoveSelected}
          onRemoveAll={handleBulkRemoveAll}
          busy={bulkBusy}
        />
      )}

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No section assigned yet. Ask your HOD to assign you to one before adding students.
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          {query ? `No students match "${query}".` : 'No students in your sections yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Roll No.</th>
                <th className="px-4 py-3">Section</th>
                {/* item: this is the SAME total shown on the Main Leaderboard for
                    this student (server computes both from buildLeaderboard) —
                    never a separate/duplicated number. The faculty's own manual
                    +/- nudge is shown alongside it, not instead of it, since that
                    nudge alone isn't the student's real leaderboard standing. */}
                <th className="px-4 py-3">Leaderboard points</th>
                <th className="px-4 py-3">Faculty adjustment</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.username} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)} />
                  </td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.username}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                  <td className="px-4 py-3 text-ink-light">{sectionName(s.section_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                    {s.leaderboard_points ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs font-semibold ${s.leaderboard_adjustment > 0 ? 'text-teal' : s.leaderboard_adjustment < 0 ? 'text-crimson' : 'text-ink-light'}`}>
                      {s.leaderboard_adjustment > 0 ? '+' : ''}{s.leaderboard_adjustment || 0}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditStudent(s)} className="mr-3 text-xs font-semibold text-hero-primary hover:underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => setPointsStudent(s)} className="mr-3 text-xs font-semibold text-teal hover:underline">
                      Adjust points
                    </button>
                    <button type="button" onClick={() => handleRemove(s.id)} className="text-xs font-semibold text-crimson hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddStudentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sections={sections}
        onCreated={loadAll}
        createFn={createMyStudent}
      />
      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        sections={sections}
        onImported={loadAll}
        previewFn={previewImportMyStudents}
        importFn={importMyStudents}
        templateUrl={studentImportTemplateUrl}
      />
      <AdjustPointsModal student={pointsStudent} onClose={() => setPointsStudent(null)} onSaved={loadAll} />
      <StudentProfileEditModal
        student={editStudent}
        sections={sections}
        updateFn={updateMyStudent}
        onClose={() => setEditStudent(null)}
        onSaved={loadAll}
      />
    </div>
  );
}

// Faculty-controlled leaderboard points (item 6): faculty enters a +/-
// amount, which is added to the student's running adjustment and reflected
// on the leaderboard immediately. Only ever opened for a student already
// scoped to this faculty member's own section (the server double-checks).
function AdjustPointsModal({ student, onClose, onSaved }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState('increase'); // 'increase' | 'decrease'
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setAmount('');
    setDirection('increase');
  }, [student]);

  if (!student) return null;

  const handleSave = async () => {
    const n = Number(amount);
    if (!n || n <= 0) { showToast('Enter a positive number of points.', 'error'); return; }
    const delta = direction === 'increase' ? n : -n;
    setSubmitting(true);
    try {
      await adjustStudentPoints(student.id, delta);
      showToast('Leaderboard points updated.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Could not update points.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // item 15: reset this one student's Points back to zero. A confirmation
  // step first, per spec — this can't be undone with an "undo" button, only
  // by re-entering points manually.
  const handleReset = async () => {
    if (!window.confirm(`Reset ${student.name}'s points to zero? This cannot be undone.`)) return;
    setResetting(true);
    try {
      await resetStudentPoints({ studentIds: [student.id] });
      showToast('Points reset to zero.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message || 'Could not reset points.', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Adjust points — ${student.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-light">
          Current adjustment: <span className="font-mono font-semibold text-ink">{student.leaderboard_adjustment > 0 ? '+' : ''}{student.leaderboard_adjustment || 0}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDirection('increase')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${direction === 'increase' ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink-light hover:bg-paper'}`}
          >
            + Increase
          </button>
          <button
            type="button"
            onClick={() => setDirection('decrease')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${direction === 'decrease' ? 'border-crimson bg-crimson/10 text-crimson' : 'border-line text-ink-light hover:bg-paper'}`}
          >
            − Decrease
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Points</label>
          <input
            type="number" min={1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <button type="button" onClick={handleSave} disabled={submitting} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={handleReset} disabled={resetting} className="w-full rounded-lg border border-crimson py-2 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-60">
          {resetting ? 'Resetting…' : 'Reset points to zero'}
        </button>
      </div>
    </Modal>
  );
}
