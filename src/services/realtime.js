// Client for the backend's /ws/live real-time layer (see "Real-time layer"
// in server.js). One shared socket per browser tab, reconnected with
// backoff on drop, re-subscribing to every room a caller asked for so a
// reconnect after a network blip or laptop sleep is transparent to the
// screens using it.
//
// Design mirrors the backend: messages received here carry only
// { room, type, ...minimal fields } — never the actual data — so a
// listener's job is always just "call the REST fetch again", the same
// fetch each screen's polling fallback already calls. That's why every
// caller passes a plain refetch callback rather than expecting typed
// payloads back.
//
// Polling is intentionally NOT removed anywhere this is used — a socket
// can silently fail to connect (corporate proxy, strict network policy)
// with no error surfaced to the user, so every screen keeps its existing
// interval poll as a slow, always-correct fallback; this client just makes
// the common case near-instant instead of waiting for the next tick.

let socket = null;
let connecting = false;
let reconnectAttempt = 0;
const pendingRooms = new Map(); // room -> Set<callback>
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

function wsUrl() {
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('campusync-token') || '') : '';
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || !window.location.hostname.includes('localhost'))) {
    return `wss://campus-orbis-backend-1.onrender.com/ws/live${tokenParam}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/live${tokenParam}`;
}

function scheduleReconnect() {
  if (pendingRooms.size === 0) return; // nobody's listening anymore — don't keep retrying
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  reconnectAttempt += 1;
  setTimeout(connect, delay);
}

function resubscribeAll() {
  for (const room of pendingRooms.keys()) {
    socket.send(JSON.stringify({ type: 'subscribe', room }));
  }
}

function connect() {
  if (connecting || (socket && socket.readyState === WebSocket.OPEN)) return;
  connecting = true;
  try {
    socket = new WebSocket(wsUrl());
  } catch {
    connecting = false;
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    connecting = false;
    reconnectAttempt = 0;
    resubscribeAll();
  };
  socket.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const callbacks = pendingRooms.get(msg.room);
    if (callbacks) callbacks.forEach((cb) => cb(msg));
  };
  socket.onclose = () => {
    connecting = false;
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => {
    // onclose fires right after in browsers — no separate handling needed,
    // this just prevents an unhandled-error console spam.
  };
}

/**
 * Subscribe to a real-time room. Returns an unsubscribe function — call it
 * on unmount so a closed screen doesn't keep receiving (harmless, but
 * wasteful) messages or holding the socket open on the server's room map.
 *
 * @param {string} room - e.g. `leaderboard:college:<id>`, `test_live:<testId>`
 * @param {(msg: {room: string, type: string}) => void} onMessage
 */
export function subscribeRealtime(room, onMessage) {
  if (!pendingRooms.has(room)) pendingRooms.set(room, new Set());
  pendingRooms.get(room).add(onMessage);
  connect();
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'subscribe', room }));
  }
  return () => {
    const set = pendingRooms.get(room);
    if (!set) return;
    set.delete(onMessage);
    if (set.size === 0) {
      pendingRooms.delete(room);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'unsubscribe', room }));
      }
    }
  };
}
