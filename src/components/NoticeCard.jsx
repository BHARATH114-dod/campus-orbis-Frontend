/**
 * @param {{ notice: { id, title, body, priority, author_name, created_at }, onDelete?: (id) => void, canManage?: boolean }} props
 */
export default function NoticeCard({ notice, onDelete, canManage = false }) {
  const isUrgent = notice.priority === 'urgent';

  return (
    <div className={`rounded-2xl border bg-paper-card p-5 shadow-sm ${isUrgent ? 'border-crimson/40' : 'border-line'}`}>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          isUrgent ? 'bg-crimson/10 text-crimson' : 'bg-teal/10 text-teal'
        }`}
      >
        {isUrgent ? 'Urgent' : 'Notice'}
      </span>

      <h3 className="mt-2 text-base font-semibold text-ink">{notice.title}</h3>
      <p className="mt-1 text-sm text-ink-light line-clamp-3">{notice.body}</p>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-light">
        <span>{notice.author_name}</span>
        <span>{notice.created_at ? new Date(notice.created_at).toLocaleDateString() : ''}</span>
      </div>

      {canManage && (
        <button
          type="button"
          onClick={() => onDelete?.(notice.id)}
          className="mt-3 text-xs font-semibold text-crimson hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  );
}
