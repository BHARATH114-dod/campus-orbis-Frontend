import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchNotes, createNote, deleteNote, toggleBookmark, fileUrl } from '../services/noteService';
import { canManageContent } from '../utils/permissions';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CAN_CREATE_ROLES = ['college_admin', 'hod', 'faculty'];

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function Notes() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const canCreate = CAN_CREATE_ROLES.includes(role);

  const load = () => {
    setLoading(true);
    fetchNotes()
      .then(setNotes)
      .catch((err) => showToast(err.message || 'Could not load notes.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBookmark = async (id) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, bookmarked: !n.bookmarked } : n)));
    try {
      await toggleBookmark(id);
    } catch (err) {
      showToast(err.message || 'Could not update your bookmark.', 'error');
      load();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this note? This cannot be undone.')) return;
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast('Note removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this note.', 'error');
    }
  };

  const visibleNotes = bookmarkedOnly ? notes.filter((n) => n.bookmarked) : notes;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Notes</h1>
          <p className="text-sm text-ink-light">Study material shared by faculty and admins.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBookmarkedOnly((v) => !v)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              bookmarkedOnly ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ink hover:bg-paper'
            }`}
          >
            🔖 {bookmarkedOnly ? 'Showing bookmarks' : 'My bookmarks'}
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              + Share a note
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading notes…" />
      ) : visibleNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          {bookmarkedOnly ? "You haven't bookmarked any notes yet." : 'No notes shared yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleNotes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-line bg-paper-card p-5 shadow-sm">
              <span className="inline-block rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-bold text-teal">
                {note.subject}
              </span>
              <h3 className="mt-2 text-base font-semibold text-ink">{note.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-ink-light">{note.description}</p>
              <p className="mt-2 text-xs text-ink-light">
                {note.file_name} {note.file_size ? `· ${formatSize(note.file_size)}` : ''}
              </p>

              {/* Business rule: students get BOTH a view and a download option
                  where applicable — not one-or-the-other gated purely by
                  allow_download. View works for anything the browser can
                  render natively (image/pdf); office docs have no in-app
                  preview, so only Download shows for those (when allowed). */}
              <div className="mt-3 flex flex-wrap gap-2">
                {note.file_kind !== 'office' && (
                  <a
                    href={fileUrl(note.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper"
                  >
                    👁 View
                  </a>
                )}
                {note.allow_download && (
                  <a
                    href={fileUrl(note.id)}
                    download={note.file_name}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-paper"
                  >
                    ⬇ Download
                  </a>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-light">{note.author_name}</p>
                  <p className="text-[11px] text-ink-light">{new Date(note.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleBookmark(note.id)}
                    className={`text-lg ${note.bookmarked ? 'text-gold' : 'text-ink-light'}`}
                    aria-label={note.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                  >
                    {note.bookmarked ? '🔖' : '📑'}
                  </button>
                  {canManageContent(user, note) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="text-xs font-semibold text-crimson hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateNoteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(note) => setNotes((prev) => [note, ...prev])}
      />
    </div>
  );
}

function CreateNoteModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [allowDownload, setAllowDownload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setSubject(''); setTitle(''); setDescription(''); setFile(null); setAllowDownload(false); setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim()) {
      setError('Subject and title are required.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const note = await createNote({ subject, title, description, allow_download: allowDownload }, file);
      onCreated(note);
      showToast('Note shared.', 'success');
      reset();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not share this note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share a note">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Subject / Course</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">File</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
          Allow students to download this file
        </label>
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? 'Uploading…' : 'Upload & share'}
        </button>
      </form>
    </Modal>
  );
}
