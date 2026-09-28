import { useEffect, useState } from 'react';
import { fetchTestLeaderboard } from '../../services/testService';
import { useToast } from '../../context/ToastContext';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const STATUS_LABEL = { graded: 'Submitted', submitted: 'Submitted' };

function formatScore(n) {
  if (n == null) return '0';
  const rounded = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Per-test leaderboard — ranked purely by Final Test Points: 2 points for
 * joining the test, 2 points per correct MCQ/code answer, plus the leftover
 * time on the clock at submission (expressed as MM.SS — e.g. 40 minutes 30
 * seconds left is 40.30 points). Equal Final Test Points share the same
 * rank. Refreshed every time the modal opens (GET /api/tests/:id/leaderboard).
 *
 * @param {{ testId: string|null, testTitle?: string, onClose: () => void }} props
 */
export default function TestLeaderboardModal({ testId, testTitle, onClose }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!testId) { setData(null); return; }
    setLoading(true);
    fetchTestLeaderboard(testId)
      .then(setData)
      .catch((err) => showToast(err.message || 'Could not load the leaderboard.', 'error'))
      .finally(() => setLoading(false));
  }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!testId) return null;

  return (
    <Modal open onClose={onClose} title={testTitle ? `🏆 Leaderboard — ${testTitle}` : '🏆 Leaderboard'}>
      {loading || !data ? (
        <LoadingSpinner label="Loading leaderboard…" />
      ) : data.leaderboard.length === 0 ? (
        <p className="text-sm text-ink-light">No submissions yet — be the first to attempt this test.</p>
      ) : (
        <div className="space-y-2">
          <p className="mb-1 text-xs text-ink-light">
            Ranked by Test Points — 2 for joining, 2 per correct answer, plus your remaining time on the clock.
            {' '}{data.total_students} submission{data.total_students === 1 ? '' : 's'} recorded.
          </p>
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
                    Submitted {new Date(entry.submitted_at).toLocaleString()} · {STATUS_LABEL[entry.status] || 'Submitted'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-teal">{formatScore(entry.test_points)} pts</p>
                  <p className="text-[11px] text-ink-light">{entry.score}/{entry.total_marks} marks</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 pl-13 text-[11px] text-ink-light">
                <span className="font-semibold text-teal">✓ {entry.correct_count} correct</span>
                <span className="font-semibold text-crimson">✕ {entry.wrong_count} wrong</span>
                {entry.time_taken_label && <span>Time taken: {entry.time_taken_label}</span>}
                {entry.remaining_time_label && <span>Remaining: {entry.remaining_time_label}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
