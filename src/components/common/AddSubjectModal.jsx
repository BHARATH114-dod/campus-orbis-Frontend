import { useEffect, useState } from 'react';
import Modal from './Modal';
import { createSubject } from '../../services/timetableService';
import { useToast } from '../../context/ToastContext';

/**
 * "Add Subject" modal, shared by HOD (Timetables → a section's editor) and
 * College Admin (the Subjects page). The backend enforces who's allowed to
 * call this regardless of which role's UI renders this modal — see
 * requireRole('hod', 'college_admin') on POST /api/hod/subjects in
 * Backend/server.js — so hiding/showing this component is purely a UX
 * nicety, never the actual access boundary.
 *
 * @param {{ open: boolean, onClose: () => void, departments?: string[], onCreated: (subject: object) => void }} props
 * Pass `departments` (the college's list of departments, from
 * fetchHods()) for College Admin, who must say which department a
 * subject belongs to. Omit it entirely for HOD, whose own department is
 * always used automatically server-side — no field is shown for them.
 */
export default function AddSubjectModal({ open, onClose, departments, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState(departments?.[0] || '');
  const [submitting, setSubmitting] = useState(false);

  const needsDepartment = Array.isArray(departments);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCode('');
    setDepartment(departments?.[0] || '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { showToast('Subject name is required.', 'error'); return; }
    if (needsDepartment && !department) { showToast('Choose a department.', 'error'); return; }
    setSubmitting(true);
    try {
      const subject = await createSubject({ name: name.trim(), code: code.trim(), department: needsDepartment ? department : undefined });
      showToast(`"${subject.name}" added.`, 'success');
      onCreated(subject);
      onClose();
    } catch (err) {
      // Backend returns 409 with a clear message for a duplicate name
      // within the same department — surfaced verbatim rather than a
      // generic failure, since it tells the person exactly what to fix.
      showToast(err.message || 'Could not add this subject.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Subject">
      <form onSubmit={handleSubmit} className="space-y-4">
        {needsDepartment && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Department</label>
            {departments.length === 0 ? (
              <p className="text-xs text-crimson">No departments yet — add an HOD first, then subjects can be assigned to their department.</p>
            ) : (
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Subject name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Structures" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Code (optional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CS201" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={submitting || (needsDepartment && departments.length === 0)} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Adding…' : 'Add Subject'}
        </button>
      </form>
    </Modal>
  );
}
