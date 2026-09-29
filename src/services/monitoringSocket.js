// Test Monitoring — WebRTC signalling socket.
//
// A thin wrapper around a plain WebSocket connected to the backend's
// `/ws/monitoring` endpoint (see server.js). The student side
// (TestAttempt.jsx) and both viewer sides — faculty and HOD (read-only) —
// in FacultyTestMonitoring.jsx use this to exchange small JSON signalling
// messages (offer/answer/ICE candidates) — never the actual audio/video,
// which goes browser-to-browser over the resulting WebRTC PeerConnection.
//
// Auth is the same httpOnly session cookie the REST API already uses;
// there's nothing extra to attach here — the browser sends it
// automatically on the WebSocket's Upgrade request as long as this runs
// same-origin (see vite.config.js's `/ws` proxy in dev).

function wsBaseUrl() {
  // Mirror api.js's VITE_API_BASE_URL logic, but derive a ws(s):// origin
  // from it instead of an http(s):// path.
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/^http/i, 'ws').replace(/\/api\/?$/, '');
  }
  // When running on Vercel or any remote deployment where the API
  // is proxied to Render, connect directly to the Render WebSocket server:
  if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || !window.location.hostname.includes('localhost'))) {
    return 'wss://campus-orbis-backend-1.onrender.com';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

/**
 * Opens a monitoring signalling socket.
 *
 * @param {{
 *   testId: string,
 *   role: 'student' | 'faculty' | 'hod',
 *   onMessage: (msg: object) => void,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 * }} opts
 * @returns {WebSocket}
 */
export function openMonitoringSocket({ testId, role, onMessage, onOpen, onClose }) {
  const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('campusync-token') || '') : '';
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const url = `${wsBaseUrl()}/ws/monitoring?testId=${encodeURIComponent(testId)}&role=${role}${tokenParam}`;
  const ws = new WebSocket(url);
  ws.addEventListener('open', () => onOpen?.());
  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    onMessage?.(msg);
  });
  ws.addEventListener('close', () => onClose?.());
  return ws;
}

export function sendMonitoringSignal(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

// Public STUN server so peers behind typical home/campus NAT can discover
// their reflexive address. No TURN relay is configured — if faculty and
// student are both behind restrictive/symmetric NATs with no STUN-
// resolvable path, the connection will report "connection-failed"; add a
// TURN server here (with credentials) if that turns out to matter in
// practice.
export const RTC_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];
