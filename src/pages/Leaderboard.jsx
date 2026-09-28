import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchLeaderboard } from '../services/leaderboardService';
import { subscribeRealtime } from '../services/realtime';
import LeaderboardCard from '../components/LeaderboardCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Same clean-decimal formatting as the Exam Leaderboard and LeaderboardCard.
function formatScore(n) {
  if (n == null) return '0';
  const rounded = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

const SCOPES = [
  { value: 'college', label: 'Campus' },
  { value: 'department', label: 'Department' },
  { value: 'section', label: 'Section' },
];

// ---------------------------------------------------------------------------
// Rank Movement Animation (item 4). Rather than a discrete "3rd -> 2nd ->
// 1st" step-through (which reads as janky at real frame rates), this uses
// the FLIP technique: every row keeps its DOM identity across a refresh
// (keyed by username), and when its rank changes we measure how far its new
// position is from its old one and slide it there with a CSS transform
// transition. The row visually glides PAST every rank in between on its way
// to the new spot — a student moving 3rd -> 1st visibly passes 2nd — so it
// satisfies the "animate through every intermediate rank" requirement while
// looking like one smooth, professional motion instead of a series of
// jump-cuts. Every rank change (up or down) goes through the same code path.
// ---------------------------------------------------------------------------
function useRankFlipAnimation(rows) {
  const rowRefs = useRef(new Map()); // username -> element
  const prevTops = useRef(new Map()); // username -> previous top offset (px)
  const [movedUsernames, setMovedUsernames] = useState(new Set());

  const setRowRef = (username) => (el) => {
    if (el) rowRefs.current.set(username, el);
    else rowRefs.current.delete(username);
  };

  useLayoutEffect(() => {
    const moved = new Set();
    // 1. Compare each row's new top offset against the one we recorded
    //    last render, and immediately counter-translate it back to where it
    //    used to be (no transition yet — this happens in the same paint).
    rowRefs.current.forEach((el, username) => {
      const newTop = el.getBoundingClientRect().top;
      const oldTop = prevTops.current.get(username);
      if (oldTop != null && Math.abs(oldTop - newTop) > 1) {
        const delta = oldTop - newTop;
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        moved.add(username);
      }
    });
    // 2. On the next frame, animate every moved row from that offset back
    //    to translateY(0) — this is the actual slide, gliding through
    //    every rank position in between.
    if (moved.size) {
      requestAnimationFrame(() => {
        moved.forEach((username) => {
          const el = rowRefs.current.get(username);
          if (!el) return;
          el.style.transition = 'transform 550ms cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translateY(0)';
        });
        setMovedUsernames(moved);
        setTimeout(() => setMovedUsernames(new Set()), 600);
      });
    }
    // 3. Record positions for next time.
    const nextTops = new Map();
    rowRefs.current.forEach((el, username) => { nextTops.set(username, el.getBoundingClientRect().top); });
    prevTops.current = nextTops;
  }, [rows]);

  return { setRowRef, movedUsernames };
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [scope, setScope] = useState('college');
  const [department, setDepartment] = useState(user?.department || '');
  const [sectionId, setSectionId] = useState(user?.section_id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard({
      scope,
      department: scope === 'department' ? department : undefined,
      sectionId: scope === 'section' ? sectionId : undefined,
    })
      .then(setData)
      .catch((err) => showToast(err.message || 'Could not load the leaderboard.', 'error'))
      .finally(() => setLoading(false));
  }, [scope, department, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time push (WebSocket): a submission/attendance/adjustment
  // anywhere in this college broadcasts to `leaderboard:college:<id>`
  // (see broadcastToRoom calls in server.js) and this refetches
  // immediately on that signal.
  //
  // The 15s poll below is intentionally KEPT as a fallback, not removed —
  // a WebSocket can silently fail to connect on a restrictive network
  // (corporate proxy, some mobile carriers) with nothing visibly wrong to
  // the user, so the poll guarantees this screen is never more than 15s
  // stale even if the socket never connects at all. On a working
  // connection the socket makes updates feel instant; the poll is the
  // safety net, not the primary mechanism.
  useEffect(() => {
    if (!user?.college_id) return undefined;
    const refetch = () => fetchLeaderboard({
      scope,
      department: scope === 'department' ? department : undefined,
      sectionId: scope === 'section' ? sectionId : undefined,
    }).then(setData).catch(() => {});
    return subscribeRealtime(`leaderboard:college:${user.college_id}`, refetch);
  }, [scope, department, sectionId, user?.college_id]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchLeaderboard({
        scope,
        department: scope === 'department' ? department : undefined,
        sectionId: scope === 'section' ? sectionId : undefined,
      }).then(setData).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [scope, department, sectionId]);

  const sectionsForDept = data?.sections?.filter((s) => !department || s.department === department) || [];
  const { setRowRef, movedUsernames } = useRankFlipAnimation(data?.leaderboard);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-ink">Leaderboard</h1>
      <p className="mb-5 text-sm text-ink-light">
        Points from event participation, attendance, marks, club membership, and test results.
      </p>

      {/* Hall of Fame — always college-wide top 5, regardless of the scope selected below */}
      {data?.hall_of_fame?.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-light">🌟 Hall of Fame</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.hall_of_fame.map((entry) => (
              <div key={entry.username} className="w-40 shrink-0 rounded-xl border border-gold/40 bg-gold/5 p-3 text-center">
                <p className="text-lg">{{ 1: '🥇', 2: '🥈', 3: '🥉' }[entry.rank] || `#${entry.rank}`}</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{entry.name}</p>
                <p className="truncate text-xs text-ink-light">{entry.department}</p>
                <p className="mt-1 text-sm font-bold text-teal">{formatScore(entry.score)} pts</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setScope(s.value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              scope === s.value ? 'border-teal bg-teal text-white' : 'border-line text-ink hover:bg-paper'
            }`}
          >
            {s.label}
          </button>
        ))}

        {scope === 'department' && data?.departments?.length > 0 && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs">
            {data.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {scope === 'section' && sectionsForDept.length > 0 && (
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs">
            {sectionsForDept.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading leaderboard…" />
      ) : !data || data.leaderboard.length === 0 ? (
        <p className="text-sm text-ink-light">No students to rank in this scope yet.</p>
      ) : (
        <div className="space-y-2">
          {data.leaderboard.map((entry) => (
            <div key={entry.username} ref={setRowRef(entry.username)}>
              <LeaderboardCard entry={entry} highlight={entry.username === user?.username} animateRank={movedUsernames.has(entry.username)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
