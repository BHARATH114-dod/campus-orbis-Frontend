import api from './api';

/**
 * GET /api/notifications
 * Response: { notifications: [{ id, user_username, college_id, tab, type,
 *              title, message, related_id, read, created_at }], unread_count }
 */
export function fetchNotifications() {
  return api.get('/notifications').then((res) => res.data);
}

/** POST /api/notifications/:id/read → { ok: true } */
export function markNotificationRead(id) {
  return api.post(`/notifications/${id}/read`).then((res) => res.data);
}

/** POST /api/notifications/read-tab/:tab → { ok: true } — marks a whole sidebar module's notifications read at once */
export function markTabRead(tab) {
  return api.post(`/notifications/read-tab/${tab}`).then((res) => res.data);
}

/** POST /api/notifications/read-all → { ok: true } */
export function markAllRead() {
  return api.post('/notifications/read-all').then((res) => res.data);
}

/** DELETE /api/notifications/:id → { ok: true } — swipe-to-dismiss one notification */
export function dismissNotification(id) {
  return api.delete(`/notifications/${id}`).then((res) => res.data);
}

/** DELETE /api/notifications → { ok: true } — Clear All */
export function clearAllNotifications() {
  return api.delete('/notifications').then((res) => res.data);
}
