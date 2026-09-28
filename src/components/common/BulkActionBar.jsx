/**
 * Reusable bulk-selection toolbar (item 14): shows selected count, Select
 * all / Deselect all, and a Remove Selected / Remove All action, with a
 * native confirm() dialog before anything destructive fires — the actual
 * authorization check always happens server-side (see bulkDeleteUsers in
 * server.js), this is only ever a UX convenience.
 *
 * @param {{
 *   total: number, selectedCount: number,
 *   onSelectAll: () => void, onDeselectAll: () => void,
 *   onRemoveSelected: () => void, onRemoveAll: () => void,
 *   busy?: boolean, itemLabel?: string,
 * }} props
 */
export default function BulkActionBar({ total, selectedCount, onSelectAll, onDeselectAll, onRemoveSelected, onRemoveAll, busy, itemLabel = 'user' }) {
  if (total === 0) return null;

  const handleRemoveSelected = () => {
    if (!selectedCount) return;
    if (!window.confirm(`Remove ${selectedCount} selected ${itemLabel}${selectedCount === 1 ? '' : 's'}? This cannot be undone.`)) return;
    onRemoveSelected();
  };
  const handleRemoveAll = () => {
    if (!window.confirm(`Remove ALL ${total} ${itemLabel}${total === 1 ? '' : 's'} in this list? This affects every one shown here and cannot be undone.`)) return;
    onRemoveAll();
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-card px-4 py-2.5">
      <span className="text-xs font-semibold text-ink">
        {selectedCount > 0 ? `${selectedCount} selected` : `Select ${itemLabel}s to act on them`}
      </span>
      <button type="button" onClick={onSelectAll} className="text-xs font-semibold text-teal hover:underline">Select all</button>
      <button type="button" onClick={onDeselectAll} disabled={!selectedCount} className="text-xs font-semibold text-ink-light hover:underline disabled:opacity-40">Deselect all</button>
      <div className="ml-auto flex gap-2">
        <button
          type="button" onClick={handleRemoveSelected} disabled={!selectedCount || busy}
          className="rounded-full border border-crimson px-3 py-1.5 text-xs font-bold text-crimson hover:bg-crimson/10 disabled:opacity-40"
        >
          Remove Selected
        </button>
        <button
          type="button" onClick={handleRemoveAll} disabled={busy}
          className="rounded-full bg-crimson px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          Remove All
        </button>
      </div>
    </div>
  );
}
