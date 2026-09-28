import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';

/**
 * Student Profile / Section Management (item 15) edit modal — used by both
 * FacultyStudents.jsx (own sections only) and HodPeople.jsx (any section in
 * the department). `sections` is whichever list the caller is authorized to
 * move a student into; `updateFn` is the matching scoped API call
 * (updateMyStudent for faculty, updateHodStudent for HOD) — the server
 * re-validates the section choice either way, this only controls what's
 * offered in the dropdown.
 *
 * @param {{
 *   student: object|null, sections: Array<{id, name}>,
 *   updateFn: (id, fields) => Promise<object>,
 *   onClose: () => void, onSaved: (updated: object) => void,
 * }} props
 */
export default function StudentProfileEditModal({ student, sections, updateFn, onClose, onSaved }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!student) return;
    setName(student.name || '');
    setRollNumber(student.roll_number || '');
    setSectionId(student.section_id || '');
    setError('');
  }, [student]);

  if (!student) return null;

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const updated = await updateFn(student.id, { name: name.trim(), roll_number: rollNumber.trim(), section_id: sectionId });
      showToast('Student updated.', 'success');
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit — ${student.name}`}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Roll number</label>
          <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm">
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}{s.year ? ` · Year ${s.year}` : ''}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-light">Changing section moves this student immediately.</p>
        </div>
        {/* Username, role, and college/department are never editable here —
            only the fields a Faculty/HOD account is actually authorized to
            change (item 3/15's "only edit fields they're authorized for"). */}
        {error && <p className="text-xs font-semibold text-crimson">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ink">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
