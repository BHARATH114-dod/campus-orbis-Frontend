import { useEffect, useRef, useState } from 'react';
import { globalSearch } from '../../services/searchService';

/**
 * Debounced global search bar wired to GET /api/search (item 16). Renders
 * its own results dropdown (students/faculty/hods/colleges, whichever the
 * caller's role returns) and calls onSelect(record, category) when a
 * result is clicked, so the parent page decides what "open" means (e.g.
 * scroll to / open the profile edit modal for that user).
 *
 * @param {{ placeholder?: string, onSelect: (record, category) => void }} props
 */
export default function GlobalSearchBar({ placeholder = 'Search by name, username, or roll number…', onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      globalSearch(query)
        .then((data) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const categories = results
    ? [
        ['students', 'Students'],
        ['faculty', 'Faculty'],
        ['hods', 'HODs'],
        ['colleges', 'Colleges'],
      ].filter(([key]) => (results[key] || []).length > 0)
    : [];
  const hasAnyResults = categories.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-full border border-line bg-paper-card px-4 py-2 text-sm text-ink outline-none focus:border-hero-primary"
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(''); setResults(null); setOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-light hover:text-ink"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}

      {open && query.trim() && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-line bg-paper-card shadow-lg">
          {loading ? (
            <p className="px-4 py-3 text-xs text-ink-light">Searching…</p>
          ) : !hasAnyResults ? (
            <p className="px-4 py-3 text-xs text-ink-light">No matches for "{query}".</p>
          ) : (
            categories.map(([key, label]) => (
              <div key={key} className="border-b border-line last:border-0">
                <p className="px-4 pt-2 text-[10px] font-bold uppercase tracking-wide text-ink-light">{label}</p>
                {results[key].map((r) => (
                  <button
                    key={r.id || r.username}
                    type="button"
                    onClick={() => { onSelect?.(r, key); setOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-paper"
                  >
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="text-[11px] text-ink-light">{r.roll_number || r.username || r.code}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
