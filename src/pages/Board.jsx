import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchPosts, createPost, togglePostStatus, deletePost, fetchPost, addReply, deleteReply } from '../services/boardService';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const TYPE_LABEL = { complaint: 'Complaint', opinion: 'Opinion', lost_found: 'Lost & Found' };
const TYPE_STYLE = { complaint: 'bg-crimson/10 text-crimson', opinion: 'bg-purple/10 text-purple', lost_found: 'bg-gold/10 text-gold' };
// UPDATED: mirrors the backend's own rule (POST /api/posts requires role
// hod/faculty/student) — College Admin can moderate here but never compose,
// same as the server enforces.
const CAN_POST_ROLES = ['hod', 'faculty', 'student'];

export default function Board() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [activePostId, setActivePostId] = useState(null);

  const canPost = CAN_POST_ROLES.includes(role);

  const load = () => {
    setLoading(true);
    fetchPosts().then(setPosts).catch((err) => showToast(err.message || 'Could not load the board.', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canManage = (post) => post.author_username === user.username || ['college_admin', 'hod', 'faculty'].includes(role);

  const handleToggleStatus = async (id) => {
    try {
      const updated = await togglePostStatus(id);
      setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      showToast(err.message || 'Could not update status.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this post? This cannot be undone.')) return;
    try {
      await deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      showToast('Post removed.', 'success');
      setActivePostId(null);
    } catch (err) {
      showToast(err.message || 'Could not remove this post.', 'error');
    }
  };

  const visible = posts.filter((p) => (typeFilter === 'all' || p.type === typeFilter) && (statusFilter === 'all' || p.status === statusFilter));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Public Board</h1>
          <p className="text-sm text-ink-light">Complaints, opinions, and lost &amp; found.</p>
        </div>
        {canPost && (
          <button type="button" onClick={() => setComposeOpen(true)} className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            + New post
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {['all', 'complaint', 'opinion', 'lost_found'].map((t) => (
          <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} label={t === 'all' ? 'All types' : TYPE_LABEL[t]} />
        ))}
        <span className="mx-1 text-line">|</span>
        {['all', 'open', 'resolved'].map((s) => (
          <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={s === 'all' ? 'All statuses' : s} />
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading posts…" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">No posts match these filters.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((p) => (
            <button key={p.id} type="button" onClick={() => setActivePostId(p.id)} className="block w-full rounded-xl border border-line bg-paper-card p-4 text-left hover:bg-paper">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_STYLE[p.type]}`}>{TYPE_LABEL[p.type]}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${p.status === 'open' ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>{p.status}</span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-ink">{p.title}</p>
                  <p className="text-xs text-ink-light">{p.author_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-light">{p.reply_count} repl{p.reply_count === 1 ? 'y' : 'ies'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onCreated={(p) => setPosts((prev) => [p, ...prev])} />
      <PostDetailModal
        postId={activePostId}
        onClose={() => setActivePostId(null)}
        canManage={canManage}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${active ? 'border-teal bg-teal text-white' : 'border-line text-ink hover:bg-paper'}`}>
      {label}
    </button>
  );
}

function ComposeModal({ open, onClose, onCreated }) {
  const { showToast } = useToast();
  const [type, setType] = useState('complaint');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('Title and details are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const post = await createPost({ type, title, body });
      onCreated(post);
      showToast('Post published.', 'success');
      setTitle(''); setBody('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not publish this post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New post">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setType(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${type === value ? 'border-teal bg-teal text-white' : 'border-line text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink">Details</label>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
        </div>
        {error && <p className="text-xs text-crimson">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </form>
    </Modal>
  );
}

function PostDetailModal({ postId, onClose, canManage, onToggleStatus, onDelete }) {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (!postId) { setData(null); return; }
    setLoading(true);
    fetchPost(postId).then(setData).catch((err) => showToast(err.message || 'Could not load this post.', 'error')).finally(() => setLoading(false));
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!postId) return null;

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setReplying(true);
    try {
      const reply = await addReply(postId, replyBody.trim());
      setData((d) => ({ ...d, replies: [...d.replies, reply] }));
      setReplyBody('');
    } catch (err) {
      showToast(err.message || 'Could not post your reply.', 'error');
    } finally {
      setReplying(false);
    }
  };

  const handleDeleteReply = async (replyId) => {
    try {
      await deleteReply(postId, replyId);
      setData((d) => ({ ...d, replies: d.replies.filter((r) => r.id !== replyId) }));
    } catch (err) {
      showToast(err.message || 'Could not remove this reply.', 'error');
    }
  };

  const canPostReply = ['hod', 'faculty', 'student'].includes(role);

  return (
    <Modal open onClose={onClose} title={data?.post?.title}>
      {loading || !data ? (
        <LoadingSpinner label="Loading…" />
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TYPE_STYLE[data.post.type]}`}>{TYPE_LABEL[data.post.type]}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${data.post.status === 'open' ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>{data.post.status}</span>
            {data.post.roll_number && <span className="font-mono text-[11px] text-ink-light">Roll: {data.post.roll_number}</span>}
          </div>
          <p className="text-sm text-ink">{data.post.body}</p>
          <p className="mt-2 text-xs text-ink-light">{data.post.author_name} · {new Date(data.post.created_at).toLocaleString()}</p>

          {canManage(data.post) && (
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => onToggleStatus(postId)} className="text-xs font-semibold text-teal hover:underline">
                Mark as {data.post.status === 'open' ? 'resolved' : 'open'}
              </button>
              <button type="button" onClick={() => onDelete(postId)} className="text-xs font-semibold text-crimson hover:underline">Remove</button>
            </div>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-light">Replies</h3>
            {data.replies.length === 0 ? (
              <p className="text-sm text-ink-light">No replies yet.</p>
            ) : (
              <div className="space-y-2">
                {data.replies.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line p-3">
                    <p className="text-sm text-ink">{r.body}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
                      <span>{r.author_name} · {new Date(r.created_at).toLocaleDateString()}</span>
                      {(r.author_username === user.username || ['college_admin', 'hod', 'faculty'].includes(role)) && (
                        <button type="button" onClick={() => handleDeleteReply(r.id)} className="text-crimson hover:underline">Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canPostReply && (
              <form onSubmit={handleReply} className="mt-3 flex gap-2">
                <input value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply…" className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
                <button type="submit" disabled={replying} className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Reply</button>
              </form>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
