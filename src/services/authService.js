import api from './api';

/**
 * POST /api/auth/login
 * Request body: { username, password, role, college_id? }
 *   - college_id is required for every role except 'super_admin'
 * Response: { user: { username, name, role, college_id, department?, section_id?, ... } }
 * Errors: 400 (missing role/college), 401 (bad credentials / wrong college), 403 (college disabled)
 */
export function login({ username, password, role, collegeId }) {
  return api
    .post('/auth/login', { username, password, role, college_id: collegeId })
    .then((res) => {
      if (res.data?.token) {
        localStorage.setItem('campusync-token', res.data.token);
      }
      return res.data.user;
    });
}

/**
 * POST /api/auth/logout
 * Response: { ok: true }
 */
export function logout() {
  localStorage.removeItem('campusync-token');
  return api.post('/auth/logout').then((res) => res.data);
}

/**
 * GET /api/me
 * Response: { user } — same shape as login's user object.
 * Used on app load to restore a session from the existing cookie, if any.
 */
export function fetchCurrentUser() {
  return api.get('/me').then((res) => res.data.user);
}

/**
 * GET /api/public/colleges
 * Response: { colleges: [{ id, name, has_logo }] }
 * No auth required — used by the college-select step before login.
 */
export function fetchColleges() {
  return api.get('/public/colleges').then((res) => res.data.colleges);
}

/**
 * GET /api/public/stats
 * Response: { colleges: number, users: number }
 * No auth required — powers the home page's "colleges on the platform" /
 * "people using Campus Orbis" stats.
 */
export function fetchPublicStats() {
  return api.get('/public/stats').then((res) => res.data);
}

/**
 * GET /api/super/colleges/:id/logo — no auth required despite the path
 * (confirmed public on the backend), used directly as an <img src>.
 */
export const collegeLogoUrl = (id) => `/api/super/colleges/${id}/logo`;

/**
 * POST /api/account/profile
 * Request body: { name?, gender?, avatar?, course?, current_year? }
 * `course`/`current_year` are student-only (item 5: a student may set or
 * change their own Course + Year, e.g. to resolve their own Pending status)
 * and are rejected server-side once the student's academic record is
 * marked Completed.
 * Response: { user }
 */
export function updateProfile({ name, gender, avatar, course, current_year }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (gender !== undefined) body.gender = gender;
  if (avatar !== undefined) body.avatar = avatar;
  if (course !== undefined) body.course = course;
  if (current_year !== undefined) body.current_year = current_year;
  return api.post('/account/profile', body).then((res) => res.data.user);
}
export function fetchAvatarCatalog() {
  return api.get('/account/avatar-catalog').then((res) => res.data);
}

/**
 * POST /api/account/password
 * Request body: { current_password, new_password }
 * Response: { ok: true }
 */
/**
 * GET /api/push/vapid-public-key
 * Response: { enabled: false } if the backend has no VAPID keys configured,
 * or { enabled: true, publicKey } otherwise. Used by usePushNotifications
 * to know whether/how to call PushManager.subscribe().
 */
export function fetchPushPublicKey() {
  return api.get('/push/vapid-public-key').then((res) => res.data);
}

/**
 * POST /api/push/subscribe
 * Request body: { subscription } — the PushSubscription object from
 * registration.pushManager.subscribe(), as returned by its .toJSON().
 * Registers (or re-registers) this browser/device to receive real OS-level
 * push notifications for the signed-in user.
 */
export function registerPushSubscription(subscription) {
  return api.post('/push/subscribe', { subscription }).then((res) => res.data);
}

/**
 * POST /api/push/unsubscribe — called on logout so a shared/borrowed
 * device stops receiving push notifications meant for the person who just
 * signed out.
 */
export function unregisterPushSubscription(endpoint) {
  return api.post('/push/unsubscribe', { endpoint }).then((res) => res.data);
}

export function changePassword({ currentPassword, newPassword }) {
  return api
    .post('/account/password', { current_password: currentPassword, new_password: newPassword })
    .then((res) => res.data);
}
