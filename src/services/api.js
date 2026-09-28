import axios from 'axios';

// ARCHITECTURE NOTE (Module 1):
// The existing Express backend (server.js) authenticates with an httpOnly
// session cookie set by POST /api/auth/login — there is no JWT or Firebase
// on the backend today. Rewriting that auth system was out of scope for a
// frontend migration (it would mean re-deriving every role-permission check
// already built and tested in server.js), so this app talks to the real,
// working backend as-is: `withCredentials: true` sends the session cookie
// on every request.
//
// This file is still "JWT-ready" in the sense the brief asked for: every
// call in the app goes through this one Axios instance, so if the backend
// grows a token-based auth mode later, only the two commented lines below
// change — no page or component needs to know how auth is implemented.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Root-cause fix (repeated 504 toasts on Live Quiz): previously
  // unset, so a stuck request would hang in the browser indefinitely —
  // meaning a polling loop's "in-flight" request could never time out on
  // its own, and kept the loop waiting instead of freeing it up to back
  // off and retry sanely. 15s comfortably covers a slow-but-alive backend
  // while still failing fast enough for a poll loop to recover cleanly.
  timeout: 15000,
});

// Attach Bearer token from localStorage for reliable cross-site authentication (mobile Safari/Chrome)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('campusync-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize error handling: every failed call rejects with a plain object
// { status, message } so components never need to touch Axios's response shape.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Root-cause fix: surface a clear, human message for a 504/503/timeout
    // instead of a raw axios/network string — callers (e.g. the Live Quiz
    // poll loop) key off `isTransient` to decide whether it's safe/sane to
    // quietly retry on the next tick rather than treat it as a hard failure.
    const isTransient = status === 504 || status === 503 || status === 502 || error.code === 'ECONNABORTED' || (!error.response && error.message === 'Network Error');
    const message = error.response?.data?.error
      || (isTransient ? 'The server is taking a moment to respond.' : null)
      || error.message
      || 'Something went wrong.';
    if (status === 401) {
      // Session expired or was never valid — let AuthContext react to this
      // via a custom event rather than importing it here (would create a
      // circular import between api.js and AuthContext.jsx).
      window.dispatchEvent(new CustomEvent('campusync:unauthorized'));
    }
    return Promise.reject({ status, message, isTransient, data: error.response?.data });
  }
);

export default api;
