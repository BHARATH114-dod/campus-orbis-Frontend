import api from './api';

/**
 * GET /api/posts
 * Response: { posts: [{ id, type:'complaint'|'opinion'|'lost_found', title,
 *   body, roll_number, status:'open'|'resolved', author_username, author_name,
 *   author_role, created_at, reply_count }] }
 * `roll_number` is only visible to staff or the post's own author — the
 * server already redacts it for everyone else, this isn't a client-side rule.
 */
export function fetchPosts() {
  return api.get('/posts').then((res) => res.data.posts);
}

/** GET /api/posts/:id → { post, replies: [{ id, body, author_name, author_role, created_at }] } */
export function fetchPost(id) {
  return api.get(`/posts/${id}`).then((res) => res.data);
}

/**
 * POST /api/posts — hod/faculty/student only (College Admin can moderate
 * but not post, per the backend's own rule — mirrored in the UI, not
 * re-invented here).
 * Body: { type, title, body } — roll_number is filled in server-side from
 * the student's own profile, never sent by the client.
 */
export function createPost({ type, title, body }) {
  return api.post('/posts', { type, title, body }).then((res) => res.data.post);
}

/** PATCH /api/posts/:id/status — toggles open/resolved. Response: { post } */
export function togglePostStatus(id) {
  return api.patch(`/posts/${id}/status`).then((res) => res.data.post);
}

/** DELETE /api/posts/:id */
export function deletePost(id) {
  return api.delete(`/posts/${id}`).then((res) => res.data);
}

/** POST /api/posts/:id/replies — { body } → { reply } */
export function addReply(postId, body) {
  return api.post(`/posts/${postId}/replies`, { body }).then((res) => res.data.reply);
}

/** DELETE /api/posts/:id/replies/:replyId */
export function deleteReply(postId, replyId) {
  return api.delete(`/posts/${postId}/replies/${replyId}`).then((res) => res.data);
}
