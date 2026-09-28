import api from './api';

/**
 * GET /api/messaging/contacts?type=hod|faculty&q=search
 * `type` omitted returns everything the caller is authorized to message
 * (for HOD: other HODs + their own department's faculty; for Faculty:
 * only their own department's HOD).
 * Response: { contacts: [{ username, name, role, department, college_name,
 *   status: 'online'|'offline', conversation_id, last_message_preview,
 *   last_message_at }] }
 */
export function fetchContacts({ type, q } = {}) {
  return api.get('/messaging/contacts', { params: { type, q: q || undefined } }).then((res) => res.data.contacts);
}

/** GET /api/messaging/conversations → { conversations: [{ id, other_username, other_name, other_role, other_department, other_status, last_message_preview, last_message_at, unread_count }] } */
export function fetchConversations() {
  return api.get('/messaging/conversations').then((res) => res.data.conversations);
}

/** POST /api/messaging/conversations — { with_username } → { conversation } (get-or-create, authorization re-checked server-side) */
export function openConversation(withUsername) {
  return api.post('/messaging/conversations', { with_username: withUsername }).then((res) => res.data.conversation);
}

/** GET /api/messaging/conversations/:id/messages → { conversation, messages: [{ id, sender_username, sender_name, body, created_at }] } */
export function fetchMessages(conversationId) {
  return api.get(`/messaging/conversations/${conversationId}/messages`).then((res) => res.data);
}

/** POST /api/messaging/conversations/:id/messages — { body } → { message } */
export function sendMessage(conversationId, body) {
  return api.post(`/messaging/conversations/${conversationId}/messages`, { body }).then((res) => res.data.message);
}

/** POST /api/messaging/conversations/:id/read — marks everything read up to now for the caller */
export function markConversationRead(conversationId) {
  return api.post(`/messaging/conversations/${conversationId}/read`).then((res) => res.data);
}
