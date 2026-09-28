import { useEffect, useState } from 'react';
import { roleLabel } from '../utils/roleLabels';
import { fetchAvatarCatalog } from '../services/authService';
import Avatar from './common/Avatar';

/**
 * @param {{
 *   user: { name, username, role, gender?, avatar?, department?, section_id?, roll_number? },
 *   editable?: boolean,
 *   onSave?: (fields: { name?: string, gender?: string, avatar?: string }) => Promise<void> | void,
 * }} props
 */
export default function ProfileCard({ user, editable = false, onSave }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [gender, setGender] = useState(user.gender || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [catalog, setCatalog] = useState({ male: [], female: [] });
  const [saving, setSaving] = useState(false);

  // Gender is mandatory going forward (spec §4) — existing accounts
  // without one yet are nudged into edit mode automatically rather than
  // silently left without an avatar.
  const needsGender = !user.gender;

  useEffect(() => {
    if (editable) fetchAvatarCatalog().then(setCatalog).catch(() => {});
  }, [editable]);
  useEffect(() => {
    if (needsGender && editable) setEditing(true);
  }, [needsGender, editable]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (needsGender && !gender) return;
    setSaving(true);
    try {
      const fields = { name: name.trim() };
      if (gender && gender !== user.gender) fields.gender = gender;
      if (avatar && avatar !== user.avatar) fields.avatar = avatar;
      await onSave?.(fields);
      setEditing(false);
    } catch {
      // Stay in edit mode so the user can retry — the caller (e.g. the
      // Profile page) is responsible for surfacing *why* it failed (toast).
    } finally {
      setSaving(false);
    }
  };

  const options = gender === 'female' ? catalog.female : catalog.male;

  return (
    <div className="rounded-2xl border border-line bg-paper-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        {user.avatar ? (
          <Avatar avatarId={user.avatar} size={64} className="shrink-0 rounded-full" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-purple text-xl font-bold text-white">
            {(user.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-base font-semibold text-ink"
            />
          ) : (
            <p className="truncate text-lg font-semibold text-ink">{user.name}</p>
          )}
          <p className="text-sm text-ink-light">{roleLabel(user.role)}</p>
        </div>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
          >
            Edit
          </button>
        )}
      </div>

      {needsGender && !editing && (
        <p className="mt-3 text-xs font-semibold text-gold">Set your gender to get a default profile avatar.</p>
      )}

      <dl className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Row label="Username" value={user.username} />
        {user.department && <Row label="Department" value={user.department} />}
        {user.section_id && <Row label="Section" value={user.section_id} />}
        {user.roll_number && <Row label="Roll number" value={user.roll_number} />}
      </dl>

      {editing && (
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-light">Gender {needsGender && <span className="text-crimson">*</span>}</p>
            <div className="flex gap-2">
              {['male', 'female'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { setGender(g); setAvatar(''); }}
                  className={`rounded-lg border px-4 py-1.5 text-sm font-semibold capitalize ${gender === g ? 'border-teal bg-teal/10 text-ink' : 'border-line text-ink-light'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {gender && options.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-ink-light">Avatar</p>
              <div className="flex gap-2">
                {options.map((id) => (
                  <button key={id} type="button" onClick={() => setAvatar(id)} className={`rounded-full p-0.5 ${avatar === id || (!avatar && user.avatar === id) ? 'ring-2 ring-teal' : ''}`}>
                    <Avatar avatarId={id} size={48} className="rounded-full" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving || (needsGender && !gender)}
              onClick={handleSave}
              className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {!needsGender && (
              <button
                type="button"
                onClick={() => { setEditing(false); setName(user.name); setGender(user.gender || ''); setAvatar(''); }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-line py-1.5 sm:flex-col sm:border-0 sm:py-0">
      <dt className="text-ink-light">{label}</dt>
      <dd className="font-mono text-ink">{value}</dd>
    </div>
  );
}
