// Same clean-decimal formatting as the Exam Leaderboard (see
// TestLeaderboardModal's formatScore) so a total of 39.9 rolled into this
// card shows as "39.9" here too, never rounded/truncated to 40 or 39, and a
// whole number like 50.0 shows as a clean "50".
function formatScore(n) {
  if (n == null) return '0';
  const rounded = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * @param {{
 *   entry: { rank, username, name, department, section_id, score,
 *            sources?: [{ source, label, points }],
 *            badges: [{ label, icon }] },
 *   highlight?: boolean, // true when this row is the signed-in user
 *   animateRank?: boolean, // true while this row's rank is mid-animation (item 4)
 * }} props
 */
export default function LeaderboardCard({ entry, highlight = false, animateRank = false }) {
  const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[entry.rank];
  // Only the point sources that actually contributed anything are shown,
  // so a student with no Competition points yet doesn't clutter their row
  // with a string of "0"s (item 3: "keep the UI clean").
  const sources = (entry.sources || []).filter((s) => s.points);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors duration-300 ${
        highlight ? 'border-gold bg-gold/10' : 'border-line bg-paper-card'
      } ${animateRank ? 'ring-2 ring-teal/40' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple/10 text-sm font-bold text-purple transition-transform duration-300 ${
            animateRank ? 'scale-110' : ''
          }`}
        >
          {medal || `#${entry.rank}`}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{entry.name}</p>
          <p className="truncate text-xs text-ink-light">{entry.department}</p>
        </div>

        {/* Badges from the real API are { label, icon } objects. */}
        {!!entry.badges?.length && (
          <div className="hidden gap-1 sm:flex">
            {entry.badges.slice(0, 3).map((b) => (
              <span key={b.label} title={b.label} className="text-base">{b.icon}</span>
            ))}
          </div>
        )}

        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-teal">{formatScore(entry.score)}</p>
          <p className="text-[11px] text-ink-light">total points</p>
        </div>
      </div>

      {/* Point-source breakdown (item 3/21) — short, clean category labels;
          the total is already prominent above. New modules that write to
          the point ledger with a new source key appear here automatically
          (see sourceLabel/extraSourceKeys in buildLeaderboard, server.js)
          without any change to this component. */}
      {!!sources.length && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line/60 pt-2 text-[11px] text-ink-light">
          {sources.map((s) => (
            <span key={s.source}>
              <span className="font-semibold text-ink">{s.label}</span> {formatScore(s.points)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
