import api from './api';

/**
 * GET /api/notes
 * Response: { notes: [{ id, subject, title, description, file_id, file_name,
 *   file_size, file_mime, file_kind ('image'|'pdf'|'office'), allow_download,
 *   target_department, target_year, target_section_id, author_username,
 *   author_name, created_at, bookmarked }] }
 */
export function fetchNotes() {
  return api.get('/notes').then((res) => res.data.notes);
}

/**
 * POST /api/notes (multipart/form-data — file is required)
 * Fields: subject, title, description, file, allow_download ('true'/'false'),
 *   target_department?, target_year?, target_section_id?
 * Only college_admin / hod / faculty may call this.
 * Response: { note }
 */
export function createNote(fields, file) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  });
  formData.append('file', file);
  return api
    .post('/notes', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data.note);
}

/** DELETE /api/notes/:id → { ok: true } */
export function deleteNote(id) {
  return api.delete(`/notes/${id}`).then((res) => res.data);
}

/** POST /api/notes/:id/bookmark → { bookmarked } */
export function toggleBookmark(id) {
  return api.post(`/notes/${id}/bookmark`).then((res) => res.data.bookmarked);
}

// Same "plain authenticated GET, used directly as a URL" pattern as
// eventService's posterUrl/certificateUrl — the browser sends the session
// cookie automatically on this same-origin (proxied) request.
export const fileUrl = (id) => `/api/notes/${id}/file`;
