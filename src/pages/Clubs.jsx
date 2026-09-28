import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchClubs,
  createClub,
  updateClub,
  deleteClub,
  bulkDeleteClubs,
  fetchClub,
  joinClub,
  joinClubByCode,
  leaveClub,
  transferClubLeader,
  fetchLeaderCandidates,
  fetchEligibleStudents,
  addClubMembers,
  removeClubMember,
  previewImportClubs,
  importClubs,
  clubImportTemplateUrl,
} from '../services/clubService';
import { joinCompetitionQuiz } from '../services/competitionService';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import BulkActionBar from '../components/common/BulkActionBar';

const CAN_CREATE_ROLES = ['college_admin', 'hod', 'faculty'];

export default function Clubs() {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [haveCodeOpen, setHaveCodeOpen] = useState(false);
  const [activeClubId, setActiveClubId] = useState(null);
  // NEW (spec item 1): multi-select club removal, mirroring the existing
  // student selection UI (BulkActionBar) — scoped to only the clubs this
  // user can actually manage; students/other data are never touched.
  const [selected, setSelected] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const canCreate = CAN_CREATE_ROLES.includes(role);
  const manageableClubs = clubs.filter((c) => c.can_manage);

  const load = () => {
    setLoading(true);
    fetchClubs()
      .then(setClubs)
      .catch((err) => showToast(err.message || 'Could not load clubs.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickJoin = async (club) => {
    // hod/faculty only — students must use the club join code (server-enforced).
    try {
      await joinClub(club.id);
      setClubs((prev) =>
        prev.map((c) => (c.id === club.id ? { ...c, is_member: true, member_count: c.member_count + 1 } : c))
      );
    } catch (err) {
      showToast(err.message || 'Could not join this club.', 'error');
    }
  };

  const handleLeave = async (club) => {
    try {
      await leaveClub(club.id);
      setClubs((prev) =>
        prev.map((c) => (c.id === club.id ? { ...c, is_member: false, member_count: Math.max(0, c.member_count - 1) } : c))
      );
    } catch (err) {
      showToast(err.message || 'Could not update your membership.', 'error');
    }
  };

  const handleDeleteClub = async (id) => {
    if (!window.confirm('Remove this club? This cannot be undone.')) return;
    try {
      await deleteClub(id);
      setClubs((prev) => prev.filter((c) => c.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      showToast('Club removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this club.', 'error');
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
      const result = await bulkDeleteClubs({ ids: [...selected] });
      showToast(`Removed ${result.removed} club${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      load();
    } catch (err) {
      showToast(err.message || 'Could not remove the selected clubs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };
  const handleBulkRemoveAll = async () => {
    setBulkBusy(true);
    try {
      const result = await bulkDeleteClubs({ removeAll: true });
      showToast(`Removed ${result.removed} club${result.removed === 1 ? '' : 's'}.`, 'success');
      setSelected(new Set());
      load();
    } catch (err) {
      showToast(err.message || 'Could not remove clubs.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Clubs</h1>
          <p className="text-sm text-ink-light">Join a club and see its members. Head to Competition for quizzes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHaveCodeOpen(true)}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
          >
            Have a code?
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
            >
              Import from Excel
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + New club
            </button>
          )}
        </div>
      </div>

      {!loading && canCreate && manageableClubs.length > 0 && (
        <BulkActionBar
          total={manageableClubs.length}
          selectedCount={selected.size}
          onSelectAll={() => setSelected(new Set(manageableClubs.map((c) => c.id)))}
          onDeselectAll={() => setSelected(new Set())}
          onRemoveSelected={handleBulkRemoveSelected}
          onRemoveAll={handleBulkRemoveAll}
          busy={bulkBusy}
        />
      )}

      {loading ? (
        <LoadingSpinner label="Loading clubs…" />
      ) : clubs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No clubs yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <div
              key={club.id}
              className={`relative rounded-2xl border p-5 shadow-sm ${selected.has(club.id) ? 'border-hero-primary bg-hero-primary/5' : 'border-line bg-paper-card'}`}
            >
              {club.can_manage && (
                <input
                  type="checkbox"
                  checked={selected.has(club.id)}
                  onChange={() => toggleSelected(club.id)}
                  aria-label={`Select ${club.name}`}
                  className="absolute right-4 top-4 h-4 w-4"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <span className="inline-block rounded-full bg-purple/10 px-2.5 py-0.5 text-[11px] font-bold text-purple">
                  {club.category}
                </span>
                {club.is_full && (
                  <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-[10px] font-bold text-crimson">Full</span>
                )}
              </div>
              <h3 className="mt-2 text-base font-semibold text-ink">{club.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-ink-light">{club.description}</p>
              <p className="mt-2 text-xs text-ink-light">
                {club.member_count}/{club.max_members} member{club.max_members === 1 ? '' : 's'}
              </p>
              {club.leader_name && (
                <p className="mt-1 text-xs font-semibold text-teal">
                  Club Leader: {club.leader_name}
                  {!club.leader_confirmed && <span className="ml-1 font-normal text-ink-light">(not yet activated)</span>}
                </p>
              )}
              {club.can_see_code && club.join_code && (
                <p className="mt-1 font-mono text-xs font-bold tracking-widest text-hero-primary">Code: {club.join_code}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveClubId(club.id)}
                  className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-paper"
                >
                  View
                </button>
                {club.is_member ? (
                  <button
                    type="button"
                    onClick={() => handleLeave(club)}
                    className="rounded-full border border-teal px-4 py-1.5 text-xs font-semibold text-teal hover:bg-teal/10"
                  >
                    Leave
                  </button>
                ) : (
                  // Spec item 4: the faculty member who created a club manages
                  // it and never sees a Join option for their own club.
                  ['hod', 'faculty'].includes(role) &&
                  club.created_by !== user?.username && (
                    <button
                      type="button"
                      disabled={club.is_full}
                      onClick={() => handleQuickJoin(club)}
                      className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Join
                    </button>
                  )
                )}
                {club.can_manage && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClub(club.id)}
                    className="ml-auto text-xs font-semibold text-crimson hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateClubModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(club) => setClubs((prev) => [club, ...prev])}
      />

      <ImportClubsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />

      <HaveACodeModal
        open={haveCodeOpen}
        onClose={() => setHaveCodeOpen(false)}
        onJoinedClub={(club) => {
          load();
          setActiveClubId(club.id);
        }}
        onJoinedQuiz={(quizId) => navigate('/competition', { state: { autoJoinQuizId: quizId } })}
      />

      <ClubDetailModal clubId={activeClubId} onClose={() => setActiveClubId(null)} onMembershipChange={load} />
    </div>
  );
}

function CreateClubModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [leaderUsername, setLeaderUsername] = useState('');
  const [maxMembers, setMaxMembers] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingCandidates(true);
    fetchLeaderCandidates()
      .then(setCandidates)
      .catch((err) => showToast(err.message || 'Could not load students.', 'error'))
      .finally(() => setLoadingCandidates(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Club name is required.');
      return;
    }
    if (!leaderUsername.trim()) {
      setError('Choose a student to be the Club Leader.');
      return;
    }
    const maxNum = Number(maxMembers);
    if (!Number.isInteger(maxNum) || maxNum < 1) {
      setError('Maximum number of members must be a whole number of at least 1.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const club = await createClub({
        name,
        description,
        category,
        leader_username: leaderUsername.trim(),
        max_members: maxNum,
      });
      onCreated(club);
      showToast("Club created. Give the join code (from the club's Members view) to the Club Leader.", 'success');
      setName('');
      setDescription('');
      setCategory('');
      setLeaderUsername('');
      setMaxMembers('10');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create this club.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New club">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Club name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Technical, Cultural, Sports"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Maximum number of members</label>
          <input
            type="number"
            min={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-ink-light">The Club Leader counts within this limit.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Club Leader</label>
          {loadingCandidates ? (
            <p className="text-xs text-ink-light">Loading students…</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-crimson">No eligible students found for you to pick from.</p>
          ) : (
            <select
              value={leaderUsername}
              onChange={(e) => setLeaderUsername(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            >
              <option value="">Select a student…</option>
              {candidates.map((s) => (
                <option key={s.username} value={s.username}>
                  {s.name}{s.roll_number ? ` — ${s.roll_number}` : ''} ({s.username})
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-[11px] text-ink-light">
            A join code is generated on creation — you'll find it in the club's Members view. Give it to this
            student; they'll enter it to activate the club and become Club Leader.
          </p>
        </div>
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create club'}
        </button>
      </form>
    </Modal>
  );
}

// NEW: multi-club Excel bulk creation (spec PART 6-15). 3 steps:
//   1. Upload — Club Name / Student Roll Number / Club Leader columns.
//   2. Preview — clubs auto-detected & grouped, one row per club, with
//      per-club validation (one leader, one student per club, etc). The
//      user enters the details common to every club (Description,
//      Category, Maximum Members) here — applied to all clubs at once,
//      per spec PART 13 — plus optional per-club overrides for anything
//      that genuinely needs to differ (spec PART 14).
//   3. Result — created / failed clubs, with the exact reason for each
//      failure (spec PART 22).
function ImportClubsModal({ open, onClose, onImported }) {
  const { showToast } = useToast();
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [maxMembers, setMaxMembers] = useState('10');
  const [overrideOpenFor, setOverrideOpenFor] = useState(null);
  const [overrides, setOverrides] = useState({}); // { [clubName]: { description?, category?, max_members? } }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setStep('upload'); setFile(null); setPreview(null);
    setDescription(''); setCategory(''); setMaxMembers('10');
    setOverrideOpenFor(null); setOverrides({}); setResult(null); setError('');
  };
  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Choose an Excel (.xlsx/.xls) or CSV file first.'); return; }
    setBusy(true); setError('');
    try {
      const res = await previewImportClubs(file);
      setPreview(res);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const setOverride = (clubName, field, value) => {
    setOverrides((prev) => ({ ...prev, [clubName]: { ...prev[clubName], [field]: value } }));
  };

  const handleCreate = async () => {
    const maxNum = Number(maxMembers);
    if (!Number.isInteger(maxNum) || maxNum < 1) {
      setError('Maximum number of members must be a whole number of at least 1.');
      return;
    }
    setBusy(true); setError('');
    try {
      // Only send override fields the user actually typed something into,
      // and coerce max_members to a number when present.
      const cleanedOverrides = {};
      for (const [name, o] of Object.entries(overrides)) {
        const entry = {};
        if (o.description !== undefined) entry.description = o.description;
        if (o.category !== undefined && o.category !== '') entry.category = o.category;
        if (o.max_members !== undefined && o.max_members !== '') entry.max_members = Number(o.max_members);
        if (Object.keys(entry).length) cleanedOverrides[name] = entry;
      }
      const res = await importClubs(file, {
        common: { description, category: category || 'General', max_members: maxNum },
        overrides: cleanedOverrides,
      });
      setResult(res);
      setStep('result');
      if (res.created_count) {
        showToast(`${res.created_count} club${res.created_count === 1 ? '' : 's'} created.`, 'success');
        onImported();
      } else {
        showToast('No clubs were created — see the errors below.', 'error');
      }
    } catch (err) {
      setError(err.message || 'Could not create these clubs.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="w-full max-w-2xl rounded-2xl bg-paper-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        {step === 'upload' && (
          <>
            <h2 className="mb-1 text-lg font-semibold text-ink">Create multiple clubs from Excel</h2>
            <p className="mb-4 text-xs text-ink-light">
              Columns: <span className="font-mono">Club Name, Student Roll Number, Club Leader</span> (YES for exactly
              one student per club, NO for the rest). One row per student — repeat the club name for every member.{' '}
              <a href={clubImportTemplateUrl} className="font-semibold text-hero-primary hover:underline">Download a template</a>.
            </p>
            <form onSubmit={handleUpload} className="space-y-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
              {error && <p className="text-xs text-crimson">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={handleClose} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
                  {busy ? 'Reading…' : 'Next'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Clubs detected: {preview.total_clubs}</h2>
            <p className="text-xs text-ink-light">
              <span className="font-semibold text-teal">{preview.valid_count} ready to create</span>
              {preview.invalid_count > 0 && <span className="text-crimson"> · {preview.invalid_count} have issues</span>}
            </p>

            <div className="space-y-2">
              {preview.clubs.map((c) => (
                <div key={c.name} className="rounded-lg border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{c.name}</p>
                      <p className="text-xs text-ink-light">
                        Members: {c.member_count} · Leader: {c.leader ? `${c.leader.name} (${c.leader.roll_number || c.leader.username})` : '—'}
                      </p>
                    </div>
                    {c.valid ? (
                      <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal">Valid</span>
                    ) : (
                      <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-xs font-semibold text-crimson">Has issues</span>
                    )}
                  </div>
                  {c.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-crimson">
                      {c.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                  {c.valid && (
                    <button
                      type="button"
                      onClick={() => setOverrideOpenFor(overrideOpenFor === c.name ? null : c.name)}
                      className="mt-2 text-xs font-semibold text-hero-primary hover:underline"
                    >
                      {overrideOpenFor === c.name ? 'Hide custom details' : 'Use different details for this club'}
                    </button>
                  )}
                  {overrideOpenFor === c.name && (
                    <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-paper p-2 sm:grid-cols-3">
                      <input
                        placeholder="Category (optional)"
                        value={overrides[c.name]?.category ?? ''}
                        onChange={(e) => setOverride(c.name, 'category', e.target.value)}
                        className="rounded-md border border-line bg-paper-card px-2 py-1.5 text-xs"
                      />
                      <input
                        type="number" min={c.member_count} placeholder="Max members (optional)"
                        value={overrides[c.name]?.max_members ?? ''}
                        onChange={(e) => setOverride(c.name, 'max_members', e.target.value)}
                        className="rounded-md border border-line bg-paper-card px-2 py-1.5 text-xs"
                      />
                      <input
                        placeholder="Description (optional)"
                        value={overrides[c.name]?.description ?? ''}
                        onChange={(e) => setOverride(c.name, 'description', e.target.value)}
                        className="rounded-md border border-line bg-paper-card px-2 py-1.5 text-xs sm:col-span-3"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-xs font-semibold text-ink">Common details — applied to every club above (unless overridden)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Category</label>
                  <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Technical" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Maximum members</label>
                  <input type="number" min={1} value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-ink">Description</label>
                  <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-crimson">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={reset} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Back</button>
              <button type="button" onClick={handleCreate} disabled={busy || !preview.valid_count} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white disabled:opacity-60">
                {busy ? 'Creating…' : `Create All Clubs (${preview.valid_count})`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Import complete</h2>
            <p className="text-sm text-ink">
              <span className="font-semibold text-teal">{result.created_count} created</span>
              {result.failed_count > 0 && <span className="text-ink-light"> · {result.failed_count} failed</span>}
            </p>
            {result.failed?.length > 0 && (
              <div className="max-h-56 overflow-y-auto overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-paper text-left uppercase text-ink-light">
                    <tr><th className="px-3 py-2">Club</th><th className="px-3 py-2">Reason</th></tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-3 py-1.5">{f.club}</td>
                        <td className="px-3 py-1.5 text-crimson">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={reset} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink">Import another file</button>
              <button type="button" onClick={handleClose} className="flex-1 rounded-lg bg-hero-primary py-2 text-sm font-bold text-white">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Spec item 6: "Have a Code?" — exactly two choices, Join a Club or Join a
// Quiz, each validated against the matching code type.
function HaveACodeModal({ open, onClose, onJoinedClub, onJoinedQuiz }) {
  const { showToast } = useToast();
  const [mode, setMode] = useState(null); // null | 'club' | 'quiz'
  const [code, setCode] = useState('');
  // NEW (spec item 3): for the quiz path, a second step asks for the
  // display name to show for that quiz — the club path is unaffected.
  const [quizStep, setQuizStep] = useState('code'); // 'code' | 'name'
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setMode(null);
    setCode('');
    setQuizStep('code');
    setDisplayName('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'quiz' && quizStep === 'code') {
      if (!code.trim()) return;
      setQuizStep('name');
      return;
    }
    if (mode === 'club' && !code.trim()) return;
    if (mode === 'quiz' && !displayName.trim()) {
      setError('Enter the name you want displayed for this quiz.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'club') {
        const res = await joinClubByCode(code.trim());
        showToast(
          res.role === 'leader' ? `You're now Club Leader of ${res.club.name}.` : `You joined ${res.club.name}.`,
          'success'
        );
        onJoinedClub(res.club);
      } else {
        const res = await joinCompetitionQuiz(code.trim(), displayName.trim());
        showToast(`Joined "${res.title}" as ${res.display_name} on behalf of ${res.club_name}.`, 'success');
        onJoinedQuiz(res.quiz_id);
      }
      handleClose();
    } catch (err) {
      setError(err.message || 'That code did not work.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Have a code?">
      {!mode ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-light">What kind of code do you have?</p>
          <button
            type="button"
            onClick={() => setMode('club')}
            className="w-full rounded-lg border border-line px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-paper"
          >
            🎭 Join a Club
          </button>
          <button
            type="button"
            onClick={() => setMode('quiz')}
            className="w-full rounded-lg border border-line px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-paper"
          >
            🥇 Join a Quiz
          </button>
        </div>
      ) : mode === 'quiz' && quizStep === 'name' ? (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Name to display for this quiz</label>
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQuizStep('code')}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim()}
              className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'Joining…' : 'Join quiz'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              {mode === 'club' ? 'Club code' : 'Quiz code'}
            </label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB3XQ9KP"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm uppercase tracking-wider"
            />
          </div>
          {error && <p className="text-xs text-crimson">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'Joining…' : mode === 'club' ? 'Join club' : 'Continue'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// Spec item 2: Club View keeps ONLY Members — club name, club leader, club
// members, member details, member count/capacity. Managers additionally
// get the join code, roster tools, and basic settings inline here (no
// separate Posts/Quizzes/Leaderboard/Gallery tabs any more).
function ClubDetailModal({ clubId, onClose, onMembershipChange }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [addingUsername, setAddingUsername] = useState(null);

  const [manageOpen, setManageOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  // NEW (spec item 6): Club Leader's own rename tool — separate from the
  // full "Club settings" form above, which only appears for club.can_manage.
  const [renameOpen, setRenameOpen] = useState(false);
  const [leaderNewName, setLeaderNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = () => {
    if (!clubId) return;
    setLoading(true);
    fetchClub(clubId)
      .then((clubData) => {
        setData(clubData);
        setEditName(clubData.club.name);
        setEditDescription(clubData.club.description);
        setEditCategory(clubData.club.category);
        setEditMaxMembers(String(clubData.club.max_members));
        setLeaderNewName(clubData.club.name);
      })
      .catch((err) => showToast(err.message || 'Could not load this club.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!clubId) {
      setData(null);
      setStudentSearch('');
      setEligibleStudents([]);
      setManageOpen(false);
      setRenameOpen(false);
      return;
    }
    load();
  }, [clubId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!manageOpen || !clubId || !data?.club?.can_add_members) return;
    setSearchingStudents(true);
    const t = setTimeout(() => {
      fetchEligibleStudents(clubId, studentSearch)
        .then(setEligibleStudents)
        .catch((err) => showToast(err.message || 'Could not load students.', 'error'))
        .finally(() => setSearchingStudents(false));
    }, 250);
    return () => clearTimeout(t);
  }, [manageOpen, clubId, studentSearch, data?.club?.can_add_members]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clubId) return null;

  const club = data?.club;

  const handleAddStudent = async (username) => {
    setAddingUsername(username);
    try {
      const res = await addClubMembers(clubId, [username]);
      if (res.added?.includes(username)) {
        showToast('Student added.', 'success');
      } else if (res.skipped?.some((s) => s.username === username)) {
        const skip = res.skipped.find((s) => s.username === username);
        showToast(`${skip.name} is already a member of ${skip.existing_club}.`, 'error');
      }
      setEligibleStudents((prev) => prev.filter((s) => s.username !== username));
      load();
    } catch (err) {
      showToast(err.message || 'Could not add this student.', 'error');
    } finally {
      setAddingUsername(null);
    }
  };

  const handleRemoveMember = async (username) => {
    if (!window.confirm('Remove this member from the club?')) return;
    try {
      await removeClubMember(clubId, username);
      showToast('Member removed.', 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not remove this member.', 'error');
    }
  };

  // Post-activation: hand the active leadership to another existing member.
  const handleTransferLeader = async (username) => {
    if (!window.confirm('Transfer Club Leader to this member?')) return;
    try {
      await transferClubLeader(clubId, username);
      showToast('Leadership transferred.', 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Could not transfer leadership.', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast('Club name is required.', 'error');
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await updateClub(clubId, {
        name: editName,
        description: editDescription,
        category: editCategory,
        max_members: Number(editMaxMembers),
      });
      setData((d) => ({ ...d, club: { ...d.club, ...updated } }));
      showToast('Club details updated.', 'success');
      onMembershipChange();
    } catch (err) {
      showToast(err.message || 'Could not save changes.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // NEW (spec item 6): Club Leader renames their own club. Uses the same
  // PATCH endpoint as full "Club settings" above — the backend enforces
  // that a leader who isn't otherwise a manager can only ever send `name`.
  const handleSaveLeaderName = async (e) => {
    e.preventDefault();
    if (!leaderNewName.trim()) {
      showToast('Club name is required.', 'error');
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateClub(clubId, { name: leaderNewName });
      setData((d) => ({ ...d, club: { ...d.club, ...updated } }));
      showToast('Club name updated.', 'success');
      setRenameOpen(false);
      onMembershipChange();
    } catch (err) {
      showToast(err.message || 'Could not rename this club.', 'error');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Modal open onClose={() => { onClose(); onMembershipChange(); }} title={club?.name}>
      {loading || !club ? (
        <LoadingSpinner label="Loading club…" />
      ) : (
        <div className="space-y-4">
          <div>
            {club.leader_name && (
              <p className="text-xs font-semibold text-teal">
                Club Leader: {club.leader_name}
                {!club.leader_confirmed && <span className="ml-1 font-normal text-ink-light">(not yet activated)</span>}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-light">
              {club.member_count}/{club.max_members} members{club.is_full ? ' · Club is full' : ''}
            </p>
          </div>

          {/* NEW (spec item 6): Club Leader — Change Club Name. Only shown to
              the confirmed leader, and only when they aren't already a full
              manager (who gets the same field inside "Club settings" below). */}
          {club.is_leader && !club.can_manage && (
            <div className="rounded-lg border border-dashed border-line p-3">
              {!renameOpen ? (
                <button type="button" onClick={() => setRenameOpen(true)} className="text-xs font-semibold text-hero-primary hover:underline">
                  Change club name
                </button>
              ) : (
                <form onSubmit={handleSaveLeaderName} className="space-y-2">
                  <label className="mb-1 block text-[11px] font-semibold text-ink">Club name</label>
                  <input
                    value={leaderNewName}
                    onChange={(e) => setLeaderNewName(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingName} className="rounded-lg bg-hero-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                      {savingName ? 'Saving…' : 'Save name'}
                    </button>
                    <button type="button" onClick={() => { setRenameOpen(false); setLeaderNewName(club.name); }} className="rounded-lg border border-line px-4 py-1.5 text-xs font-semibold text-ink hover:bg-paper">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {club.can_see_code && club.join_code && (
            <div className="rounded-lg border border-dashed border-hero-primary bg-hero-primary/5 p-3">
              <p className="text-xs font-semibold text-ink">Club join code</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-widest text-hero-primary">{club.join_code}</p>
              <p className="mt-1 text-[11px] text-ink-light">
                {club.leader_confirmed
                  ? 'Share this with students so they can join — the limit is enforced automatically.'
                  : `Give this to ${club.leader_name || 'the designated Club Leader'} — entering it activates the club.`}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">Members</p>
            <ul className="space-y-2">
              {data.members.length === 0 ? (
                <p className="text-sm text-ink-light">No members yet.</p>
              ) : (
                data.members.map((m) => (
                  <li key={m.username} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <div>
                      <span>{m.name}</span>
                      {m.roll_number && <span className="ml-2 text-xs text-ink-light">{m.roll_number}</span>}
                      {club.leader_username === m.username && club.leader_confirmed && (
                        <span className="ml-2 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-bold text-teal">Leader</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-light">{m.role}</span>
                      {(club.can_manage || club.is_leader) && m.role === 'student' && club.leader_username !== m.username && (
                        <button type="button" onClick={() => handleTransferLeader(m.username)} className="text-xs font-semibold text-teal hover:underline">
                          Make leader
                        </button>
                      )}
                      {club.can_manage && (
                        <button type="button" onClick={() => handleRemoveMember(m.username)} className="text-xs font-semibold text-crimson hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {(club.can_manage || club.can_add_members) && (
            <div className="border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setManageOpen((v) => !v)}
                className="text-xs font-semibold text-hero-primary hover:underline"
              >
                {manageOpen ? '▾ Hide club management' : '▸ Manage this club'}
              </button>

              {manageOpen && (
                <div className="mt-3 space-y-4">
                  {club.can_add_members && (
                    <div className="rounded-lg border border-dashed border-line p-3">
                      <p className="mb-2 text-xs font-semibold text-ink">Add students to this club</p>
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search by name, username, or roll number…"
                        className="mb-2 w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                      />
                      {searchingStudents ? (
                        <p className="text-xs text-ink-light">Searching…</p>
                      ) : eligibleStudents.length === 0 ? (
                        <p className="text-xs text-ink-light">No matching students.</p>
                      ) : (
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {eligibleStudents.map((s) => (
                            <li key={s.username} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-paper">
                              <span>
                                {s.name} <span className="text-ink-light">· {s.department}{s.roll_number ? ` · ${s.roll_number}` : ''}</span>
                              </span>
                              <button
                                type="button"
                                disabled={addingUsername === s.username || club.is_full}
                                onClick={() => handleAddStudent(s.username)}
                                className="rounded-full bg-gold px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                              >
                                Add
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {club.can_manage && (
                    <form onSubmit={handleSaveSettings} className="space-y-3 rounded-lg border border-dashed border-line p-3">
                      <p className="text-xs font-semibold text-ink">Club settings</p>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink">Club name</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink">Category</label>
                        <input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink">Maximum number of members</label>
                        <input
                          type="number"
                          min={1}
                          value={editMaxMembers}
                          onChange={(e) => setEditMaxMembers(e.target.value)}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-ink">Description</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="rounded-lg bg-hero-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingSettings ? 'Saving…' : 'Save changes'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
