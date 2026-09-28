import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  fetchDrives, createDrive, setDriveStatus, deleteDrive,
  fetchDriveApplications, updateApplicationStatus,
  fetchPlacementReport, placementReportCsvUrl,
} from '../../services/placementService';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';

const TABS = ['Drives', 'Report'];

export default function CollegeAdminPlacements() {
  const [tab, setTab] = useState('Drives');
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-ink">Placements</h1>
      <p className="mb-5 text-sm text-ink-light">Post drives, review applicants, and track outcomes college-wide.</p>

      <div className="mb-6 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-teal text-teal' : 'text-ink-light'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Drives' ? <DrivesTab /> : <ReportTab />}
    </div>
  );
}

function DrivesTab() {
  const { showToast } = useToast();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [applicantsDriveId, setApplicantsDriveId] = useState(null);

  const load = () => {
    setLoading(true);
    fetchDrives().then(setDrives).catch((err) => showToast(err.message || 'Could not load drives.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleStatus = async (drive) => {
    try {
      await setDriveStatus(drive.id, drive.status === 'open' ? 'closed' : 'open');
      load();
    } catch (err) {
      showToast(err.message || 'Could not update status.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this drive and all its applications? This cannot be undone.')) return;
    try {
      await deleteDrive(id);
      setDrives((prev) => prev.filter((d) => d.id !== id));
      showToast('Drive removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this drive.', 'error');
    }
  };

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button type="button" onClick={() => setCreateOpen(true)} className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
          + New drive
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading drives…" />
      ) : drives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No drives posted yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {drives.map((d) => (
            <div key={d.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-ink">{d.company_name}</h3>
                  <p className="text-sm text-ink-light">{d.role_title}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${d.status === 'open' ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>
                  {d.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
                <span>📅 {d.drive_date}</span>
                <span>⏰ Apply by {d.apply_by}</span>
                <span>{d.applicant_count} applicant{d.applicant_count === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setApplicantsDriveId(d.id)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">
                  View applicants
                </button>
                <button type="button" onClick={() => handleToggleStatus(d)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper">
                  {d.status === 'open' ? 'Close' : 'Reopen'}
                </button>
                <button type="button" onClick={() => handleDelete(d.id)} className="ml-auto text-xs font-semibold text-crimson hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateDriveModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(d) => setDrives((prev) => [d, ...prev])} />
      <ApplicantsModal driveId={applicantsDriveId} onClose={() => setApplicantsDriveId(null)} />
    </div>
  );
}

function CreateDriveModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ company_name: '', role_title: '', description: '', package_info: '', drive_date: '', apply_by: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.role_title.trim() || !form.drive_date || !form.apply_by) {
      setError('Company, role, drive date, and apply-by date are all required.');
      return;
    }
    if (form.apply_by > form.drive_date) {
      setError('Apply-by date must be on or before the drive date.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const drive = await createDrive(form);
      onCreated(drive);
      showToast('Drive posted.', 'success');
      setForm({ company_name: '', role_title: '', description: '', package_info: '', drive_date: '', apply_by: '' });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create this drive.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New placement drive">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Company name" value={form.company_name} onChange={(v) => setForm((f) => ({ ...f, company_name: v }))} />
        <Field label="Role title" value={form.role_title} onChange={(v) => setForm((f) => ({ ...f, role_title: v }))} />
        <Field label="Package (optional)" placeholder="e.g. 6-10 LPA" value={form.package_info} onChange={(v) => setForm((f) => ({ ...f, package_info: v }))} />
        <TextArea label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Drive date" type="date" value={form.drive_date} onChange={(v) => setForm((f) => ({ ...f, drive_date: v }))} />
          <Field label="Apply by" type="date" value={form.apply_by} onChange={(v) => setForm((f) => ({ ...f, apply_by: v }))} />
        </div>
        <p className="text-xs text-ink-light">Leaving departments unrestricted opens this to every department — a per-department picker can be added if you need it.</p>
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post drive'}
        </button>
      </form>
    </Modal>
  );
}

const STATUS_OPTIONS = ['applied', 'shortlisted', 'selected', 'rejected'];
const STATUS_STYLE = {
  applied: 'bg-line/50 text-ink-light', shortlisted: 'bg-gold/10 text-gold',
  selected: 'bg-teal/10 text-teal', rejected: 'bg-crimson/10 text-crimson',
};

function ApplicantsModal({ driveId, onClose }) {
  const { showToast } = useToast();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driveId) return;
    setLoading(true);
    fetchDriveApplications(driveId).then(setApplicants).catch((err) => showToast(err.message || 'Could not load applicants.', 'error')).finally(() => setLoading(false));
  }, [driveId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!driveId) return null;

  const handleStatusChange = async (applicationId, status) => {
    setApplicants((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)));
    try {
      await updateApplicationStatus(applicationId, status);
    } catch (err) {
      showToast(err.message || 'Could not update status.', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title="Applicants">
      {loading ? (
        <LoadingSpinner label="Loading…" />
      ) : applicants.length === 0 ? (
        <p className="text-sm text-ink-light">No applications yet.</p>
      ) : (
        <div className="space-y-2">
          {applicants.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">{a.student_name}</p>
                <p className="text-xs text-ink-light">{a.department}</p>
              </div>
              <select
                value={a.status}
                onChange={(e) => handleStatusChange(a.id, e.target.value)}
                className={`rounded-full border-0 px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[a.status]}`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ReportTab() {
  const { showToast } = useToast();
  const [department, setDepartment] = useState('');
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPlacementReport('college_admin', { department: department || undefined })
      .then(setReport)
      .catch((err) => showToast(err.message || 'Could not load the report.', 'error'))
      .finally(() => setLoading(false));
  }, [department]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Department (optional)" placeholder="e.g. Computer Science" value={department} onChange={setDepartment} />
        <a href={placementReportCsvUrl({ department: department || undefined })} download className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-paper">
          ⬇ Export CSV
        </a>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading report…" />
      ) : report.length === 0 ? (
        <p className="text-sm text-ink-light">No placement drives posted yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-ink-light">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Applied</th>
                <th className="px-4 py-2 text-right">Shortlisted</th>
                <th className="px-4 py-2 text-right">Selected</th>
                <th className="px-4 py-2 text-right">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.drive_id} className="border-t border-line bg-paper-card">
                  <td className="px-4 py-2">{r.company_name}</td>
                  <td className="px-4 py-2 text-ink-light">{r.role_title}</td>
                  <td className="px-4 py-2 text-right">{r.applied}</td>
                  <td className="px-4 py-2 text-right">{r.shortlisted}</td>
                  <td className="px-4 py-2 text-right font-semibold text-teal">{r.selected}</td>
                  <td className="px-4 py-2 text-right text-crimson">{r.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    </div>
  );
}
function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
    </div>
  );
}
