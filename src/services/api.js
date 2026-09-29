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
  // Increased to 30s to comfortably tolerate spotty mobile data, 2G/3G, and cold starts
  timeout: 30000,
});

// Attach Bearer token from localStorage for reliable cross-site authentication (mobile Safari/Chrome)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('campusync-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize error handling & auto-retry transient network glitches for safe GET requests
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const isTransient = status === 504 || status === 503 || status === 502 || error.code === 'ECONNABORTED' || (!error.response && error.message === 'Network Error');

    // Safe, automatic single retry for idempotent GET requests on transient network drops
    if (config && config.method === 'get' && !config.__isRetry && isTransient) {
      config.__isRetry = true;
      await new Promise((res) => setTimeout(res, 1000));
      return api(config);
    }

    const message = error.response?.data?.error
      || (isTransient ? 'The connection is taking a moment to respond.' : null)
      || error.message
      || 'Something went wrong.';
    if (status === 401) {
      window.dispatchEvent(new CustomEvent('campusync:unauthorized'));
    }
    return Promise.reject({ status, message, isTransient, data: error.response?.data });
  }
);

export default api;
