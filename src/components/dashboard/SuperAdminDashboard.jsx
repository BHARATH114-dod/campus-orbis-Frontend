import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchColleges, createCollege, setCollegeStatus, deleteCollege, collegeLogoUrl,
  fetchCollegeAdmins, createCollegeAdmin, updateCollegeAdmin, deleteCollegeAdmin,
} from '../../services/superAdminService';
import LoadingSpinner from '../common/LoadingSpinner';
import PasswordField from '../common/PasswordField';

// The Super Admin's platform-level dashboard. Deliberately narrow in
// scope: this role only ever does two things — bring a new college onto
// the platform (with its first College Admin), and manage the College
// Admin accounts of a college that's already here. Everything else
// (events, clubs, notes, attendance, leaderboards, the board...) is
// tenant-scoped content that belongs to a college, and a Super Admin has
// no college of their own — so none of it belongs in this view.
export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [manageCollege, setManageCollege] = useState(null); // the college whose admins are being managed, or null

  const loadColleges = () => {
    setLoading(true);
    fetchColleges()
      .then(setColleges)
      .catch((err) => showToast(err.message || 'Could not load colleges.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(loadColleges, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleStatus = async (college) => {
    const nextStatus = college.status === 'active' ? 'disabled' : 'active';
    try {
      await setCollegeStatus(college.id, nextStatus);
      showToast(`${college.name} is now ${nextStatus}.`, 'success');
      loadColleges();
    } catch (err) {
      showToast(err.message || 'Could not update this college.', 'error');
    }
  };

  const handleDelete = async (college) => {
    if (!window.confirm(`Permanently delete ${college.name}? This removes every user, section, event, note, and post that belongs to it. This cannot be undone.`)) return;
    try {
      await deleteCollege(college.id);
      showToast(`${college.name} was deleted.`, 'success');
      loadColleges();
    } catch (err) {
      showToast(err.message || 'Could not delete this college.', 'error');
    }
  };

  const totalUsers = (c) => c.counts.admins + c.counts.hods + c.counts.faculty + c.counts.students;

  if (loading) return <LoadingSpinner fullPage label="Loading colleges…" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Platform overview</h1>
          <p className="text-sm text-ink-light">Welcome back, {user.name.split(' ')[0]}. Add colleges and manage their College Admins here.</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white hover:opacity-90"
        >
          + Add College
        </button>
      </div>

      {colleges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No colleges on the platform yet. Add the first one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colleges.map((c) => (
            <div key={c.id} className="rounded-2xl border border-line bg-paper-card p-5">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setManageCollege(c)}
                  title="Manage College Admins"
                  className="shrink-0 rounded-xl border border-line bg-paper p-1 transition-transform hover:scale-105"
                >
                  {c.has_logo ? (
                    <img
                      src={collegeLogoUrl(c.id)}
                      alt={`${c.name} logo`}
                      className="h-12 w-12 rounded-lg object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal/10 text-lg font-bold text-teal">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-crimson/10 text-crimson'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManageCollege(c)}
                className="mt-4 block w-full rounded-xl border border-line bg-paper px-3 py-2 text-center text-xs font-semibold text-ink-light hover:bg-line/40"
              >
                Manage College Admins ({c.counts.admins})
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-ink-light">
                <div className="rounded-lg bg-paper px-2 py-2">
                  <p className="text-base font-extrabold text-ink">{totalUsers(c)}</p>
                  <p>Total users</p>
                </div>
                <div className="rounded-lg bg-paper px-2 py-2">
                  <p className="text-base font-extrabold text-ink">{c.counts.students}</p>
                  <p>Students</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(c)}
                  className="flex-1 rounded-lg border border-line py-2 text-xs font-semibold text-ink hover:bg-paper"
                >
                  {c.status === 'active' ? 'Disable' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  className="flex-1 rounded-lg border border-crimson/30 py-2 text-xs font-semibold text-crimson hover:bg-crimson/5"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddCollegeModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={loadColleges} />
      <ManageAdminsModal college={manageCollege} onClose={() => setManageCollege(null)} onChanged={loadColleges} />
    </div>
  );
}

function AddCollegeModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const reset = () => {
    setName(''); setAdminName(''); setAdminUsername(''); setAdminPassword(''); setLogoFile(null); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !adminName.trim() || !adminUsername.trim() || !adminPassword) {
      setError('College name and the College Admin\'s name, username, and password are all required.');
      return;
    }
    if (adminPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createCollege({ name, adminName, adminUsername, adminPassword }, logoFile);
      showToast('College added.', 'success');
      onCreated();
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not add this college.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-paper-card p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add College</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="College name" value={name} onChange={setName} placeholder="e.g. Green Valley Institute of Technology" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Logo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            />
          </div>

          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-light">First College Admin</p>
            <div className="space-y-3">
              <Field label="Name" value={adminName} onChange={setAdminName} />
              <Field label="Username" value={adminUsername} onChange={setAdminUsername} />
              <Field label="Password" type="password" value={adminPassword} onChange={setAdminPassword} />
            </div>
          </div>

          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? 'Adding…' : 'Add College'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Opened by clicking a college's logo. Lets the Super Admin see who
// currently administers that college, add another College Admin, reset
// one's password, rename their account, or remove one — the backend
// keeps at least one College Admin per college at all times, so the last
// remaining admin's Remove button is disabled here to match.
function ManageAdminsModal({ college, onClose, onChanged }) {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  useEffect(() => {
    if (!college) return;
    setLoading(true);
    fetchCollegeAdmins(college.id)
      .then(setAdmins)
      .catch((err) => showToast(err.message || 'Could not load College Admins.', 'error'))
      .finally(() => setLoading(false));
  }, [college]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!college) return null;

  const reload = () => {
    fetchCollegeAdmins(college.id).then(setAdmins).catch(() => {});
    onChanged();
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Remove ${admin.name} as a College Admin of ${college.name}?`)) return;
    try {
      await deleteCollegeAdmin(college.id, admin.id);
      showToast('College Admin removed.', 'success');
      reload();
    } catch (err) {
      showToast(err.message || 'Could not remove this College Admin.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-paper-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">College Admins</h2>
            <p className="text-xs text-ink-light">{college.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-line px-2 py-1 text-sm text-ink-light hover:bg-line/40">✕</button>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading…" />
        ) : admins.length === 0 ? (
          <p className="text-sm text-ink-light">No College Admins found.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{a.name}</p>
                  <p className="truncate font-mono text-xs text-ink-light">{a.username}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button type="button" onClick={() => setEditingAdmin(a)} className="text-xs font-semibold text-teal hover:underline">Edit</button>
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    disabled={admins.length <= 1}
                    title={admins.length <= 1 ? 'A college must keep at least one College Admin.' : undefined}
                    className="text-xs font-semibold text-crimson hover:underline disabled:cursor-not-allowed disabled:text-ink-light disabled:no-underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-4 w-full rounded-lg border border-dashed border-line py-2.5 text-sm font-semibold text-ink-light hover:bg-paper"
        >
          + Add another College Admin
        </button>

        <AddAdminModal college={college} open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
        <EditAdminModal college={college} admin={editingAdmin} onClose={() => setEditingAdmin(null)} onSaved={reload} />
      </div>
    </div>
  );
}

function AddAdminModal({ college, open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const reset = () => { setName(''); setUsername(''); setPassword(''); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) { setError('Name, username, and password are all required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createCollegeAdmin(college.id, { name, username, password });
      showToast('College Admin added.', 'success');
      onCreated();
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not add this College Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h3 className="mb-4 text-base font-semibold text-ink">Add College Admin</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Username" value={username} onChange={setUsername} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAdminModal({ college, admin, onClose, onSaved }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (admin) { setName(admin.name); setUsername(admin.username); setPassword(''); setError(''); }
  }, [admin]);

  if (!admin) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) { setError('Name and username cannot be empty.'); return; }
    if (password && password.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const fields = { name, username };
      if (password) fields.password = password;
      await updateCollegeAdmin(college.id, admin.id, fields);
      showToast('College Admin updated.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update this College Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h3 className="mb-4 text-base font-semibold text-ink">Edit College Admin</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Username" value={username} onChange={setUsername} />
          <Field label="New password (optional)" type="password" value={password} onChange={setPassword} placeholder="Leave blank to keep current password" />
          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  // Spec item 18: password fields get the show/hide eye icon everywhere,
  // including here — every other field type is unaffected.
  const InputComponent = type === 'password' ? PasswordField : 'input';
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <InputComponent
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
    </div>
  );
}
