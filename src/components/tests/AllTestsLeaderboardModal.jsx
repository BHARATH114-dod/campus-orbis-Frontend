import { useEffect, useState } from 'react';
import { fetchAllTestsLeaderboard } from '../../services/testService';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatScore(n) {
  if (n == null) return '0';
  const rounded = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * "All Tests" leaderboard (item 5) — combined ranking across every test the
 * caller can see, by total test points. GET /api/tests/all/leaderboard.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function AllTestsLeaderboardModal({ open, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setData(null);
    fetchAllTestsLeaderboard()
      .then((res) => setData(res))
      .catch((err) => {
        // Loading must stop no matter what went wrong (bad/expired test
        // id, empty result, network drop, server error, permission
        // issue) — `error` is tracked separately from `data` so the modal
        // never gets stuck on the spinner: once `loading` is false we
        // always render either the data, the empty state, or this
        // message, never a bare spinner with nothing to show for it.
        const message = err.message || 'Could not load the All Tests leaderboard.';
        setError(message);
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="🏆 All Tests Leaderboard">
      {loading ? (
        <LoadingSpinner label="Loading combined leaderboard…" />
      ) : error ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-crimson">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError('');
              setLoading(true);
              fetchAllTestsLeaderboard()
                .then((res) => setData(res))
                .catch((err) => {
                  const message = err.message || 'Could not load the All Tests leaderboard.';
                  setError(message);
                  showToast(message, 'error');
                })
                .finally(() => setLoading(false));
            }}
            className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold hover:bg-paper"
          >
            Try again
          </button>
        </div>
      ) : !data || data.leaderboard.length === 0 ? (
        <p className="text-sm text-ink-light">No test results yet.</p>
      ) : (
        <div className="space-y-2">
          <p className="mb-1 text-xs text-ink-light">Total points across every test attempted.</p>
          {data.leaderboard.map((entry) => (
            <div key={entry.username} className="rounded-xl border border-line bg-paper-card p-3">
              <div className="flex items-center gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple/10 text-sm font-bold text-purple">
                  {MEDAL[entry.rank] || `#${entry.rank}`}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{entry.name}</p>
                  <p className="truncate text-[11px] text-ink-light">
                    {entry.roll_number ? `Roll ${entry.roll_number} · ` : ''}
                    {entry.tests_attempted} test{entry.tests_attempted === 1 ? '' : 's'} attempted · avg {formatScore(entry.average_score)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-teal">{formatScore(entry.total_test_points)} pts</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 pl-13 text-[11px] text-ink-light">
                <span>Correct-answer points: {formatScore(entry.total_correct_points)}</span>
                <span>Time points: {formatScore(entry.total_time_points)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
