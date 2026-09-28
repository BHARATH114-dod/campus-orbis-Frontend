import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Which page (if any) a notification's `tab` should deep-link to. Tabs that
// don't have a corresponding page yet (announcements, board, forum, network,
// tests, mymarks) fall through to `null` — those notifications still show
// and can still be marked read, they just aren't clickable-through yet.
const TAB_ROUTES = {
  events: '/events',
  notes: '/notes',
  clubs: '/clubs',
  myattendance: '/attendance',
  placements: '/placements',
  messages: '/messages',
};

const TYPE_ICON = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  alert: '🚨',
};

// How far (in px) a notification must be dragged before releasing it
// counts as a dismiss rather than snapping back. Also the point past
// which any horizontal drag is treated as a swipe rather than a tap, so
// a swipe never also fires the row's click-through navigation.
const SWIPE_DISMISS_PX = 88;
const SWIPE_INTENT_PX = 10;

// One notification row with swipe-to-dismiss. Wraps the existing
// clickable content (a Link or a mark-read button) rather than
// replacing it — a horizontal drag past SWIPE_DISMISS_PX removes just
// this notification; a plain tap still behaves exactly as before. The
// underlying click is suppressed for the drag that triggered a swipe so
// a swipe-to-dismiss never also navigates or marks-as-read.
function SwipeableNotification({ notification, onDismiss, children }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef(null);
  const swipedRef = useRef(false); // true once this drag has moved far enough to count as a swipe, not a tap
  const axisRef = useRef(null); // 'x' | 'y' | null — locked in once the drag direction is clear

  const reset = () => {
    setDragX(0);
    setDragging(false);
    axisRef.current = null;
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    startRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
    axisRef.current = null;
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (!axisRef.current) {
      if (Math.abs(dx) < SWIPE_INTENT_PX && Math.abs(dy) < SWIPE_INTENT_PX) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axisRef.current === 'x') {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* unsupported — swipe still works without capture */ }
      }
    }
    if (axisRef.current !== 'x') return; // a vertical/scroll gesture — don't hijack it

    e.preventDefault();
    swipedRef.current = Math.abs(dx) > SWIPE_INTENT_PX;
    setDragX(dx);
  };

  const finishDrag = (e) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    if (axisRef.current === 'x' && Math.abs(dragX) >= SWIPE_DISMISS_PX) {
      const direction = dragX > 0 ? 1 : -1;
      setLeaving(true);
      setDragX(direction * 600);
      setTimeout(() => onDismiss(notification.id), 180);
      return;
    }
    reset();
  };

  // Swallow the click that a browser fires right after a pointerup which
  // ended a real swipe, so releasing past the threshold never also
  // triggers the row's own onClick (mark-as-read / navigation).
  const handleClickCapture = (e) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
    }
  };

  const revealSide = dragX > 0 ? 'left' : 'right';
  const revealOpacity = Math.min(Math.abs(dragX) / SWIPE_DISMISS_PX, 1);

  return (
    <li className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 flex items-center rounded-xl bg-crimson/90 px-4 text-xs font-bold text-white ${
          revealSide === 'left' ? 'justify-start' : 'justify-end'
        }`}
        style={{ opacity: dragX === 0 ? 0 : revealOpacity }}
      >
        Dismiss
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : leaving ? 'transform 180ms ease-in, opacity 180ms ease-in' : 'transform 200ms ease-out',
          opacity: leaving ? 0 : 1,
          touchAction: 'pan-y',
        }}
        className="relative bg-paper"
      >
        {children}
      </div>
    </li>
  );
}

export default function Notifications() {
  const { notifications, unreadCount, loading, markRead, markAllRead, dismiss, clearAll } = useNotifications();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Notifications</h1>
          <p className="text-sm text-ink-light">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You\u2019re all caught up'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-teal hover:underline"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-ink-light hover:text-crimson hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loading && notifications.length === 0 ? (
        <LoadingSpinner label="Loading notifications…" />
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          Nothing here yet — you'll see updates on events, notes, clubs, and attendance as they happen.
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-ink-light sm:hidden">Swipe a notification to dismiss it.</p>
          <ul className="space-y-2">
            {notifications.map((n) => {
              const route = TAB_ROUTES[n.tab];
              // Note: the visible "✕" dismiss control is rendered OUTSIDE
              // the row's own Link/button below (as a sibling), never
              // nested inside it — a <button> nested inside an <a> or
              // another <button> is invalid HTML and unreliable to click.
              const body = (
                <div
                  className={`flex gap-3 rounded-xl border p-4 transition-colors ${
                    n.read ? 'border-line bg-paper-card' : 'border-teal/40 bg-teal/5'
                  } ${route ? 'hover:bg-paper' : ''}`}
                >
                  <span className="text-lg leading-none">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    {n.message && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-light">{n.message}</p>}
                    <p className="mt-1 text-[11px] text-ink-light">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal" />}
                </div>
              );

              return (
                <SwipeableNotification key={n.id} notification={n} onDismiss={dismiss}>
                  <div className="flex items-stretch gap-1">
                    <div className="min-w-0 flex-1">
                      {route ? (
                        <Link to={route} onClick={() => !n.read && markRead(n.id)}>
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => !n.read && markRead(n.id)}
                          className="block w-full text-left"
                        >
                          {body}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      aria-label={`Dismiss notification: ${n.title}`}
                      title="Dismiss"
                      className="shrink-0 self-start rounded-full px-1.5 py-1 text-xs text-ink-light hover:bg-line/60 hover:text-crimson"
                    >
                      ✕
                    </button>
                  </div>
                </SwipeableNotification>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
