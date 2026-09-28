import api from './api';

/**
 * GET /api/events
 * Response: { events: [{ id, title, description, date, time, venue,
 *   target_department, target_year, target_section_id, author_username,
 *   author_name, author_role, created_at, rsvp_count, rsvped, has_poster }] }
 */
export function fetchEvents() {
  return api.get('/events').then((res) => res.data.events);
}

/**
 * POST /api/events (multipart/form-data — required for the optional poster image)
 * Fields: title, description, date, time, venue, poster? (file),
 *   target_department?, target_year?, target_section_id?
 * Only college_admin / hod / faculty may call this.
 * Response: { event }
 */
export function createEvent(fields, posterFile) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, value);
  });
  if (posterFile) formData.append('poster', posterFile);
  return api
    .post('/events', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data.event);
}

/** DELETE /api/events/:id → { ok: true } */
export function deleteEvent(id) {
  return api.delete(`/events/${id}`).then((res) => res.data);
}

/**
 * POST /api/events/:id/rsvp — toggles RSVP for the signed-in student.
 * Response: { rsvp_count, rsvped }
 */
export function toggleRsvp(id) {
  return api.post(`/events/${id}/rsvp`).then((res) => res.data);
}

// These three are plain authenticated GETs that stream a file — used
// directly as href/src, not called through Axios, since the browser
// sends the session cookie automatically on same-origin requests (the
// Vite dev proxy keeps everything same-origin).
export const posterUrl = (id) => `/api/events/${id}/poster`;
export const rsvpCsvUrl = (id) => `/api/events/${id}/rsvps.csv`;
export const certificateUrl = (id) => `/api/events/${id}/certificate`;

/**
 * GET /api/events/:id/gallery
 * Response: { images: [{ id, year, caption, uploaded_by, uploaded_by_name, created_at }] }
 */
export function fetchEventGallery(eventId) {
  return api.get(`/events/${eventId}/gallery`).then((res) => res.data.images);
}

/** POST /api/events/:id/gallery (multipart) — event managers only. Response: { image } */
export function uploadEventGalleryImage(eventId, file, { year, caption } = {}) {
  const formData = new FormData();
  formData.append('image', file);
  if (year) formData.append('year', year);
  if (caption) formData.append('caption', caption);
  return api
    .post(`/events/${eventId}/gallery`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data.image);
}

/** DELETE /api/events/:id/gallery/:imgId → { ok: true } */
export function deleteEventGalleryImage(eventId, imgId) {
  return api.delete(`/events/${eventId}/gallery/${imgId}`).then((res) => res.data);
}

export const eventGalleryImageUrl = (eventId, imgId) => `/api/events/${eventId}/gallery/${imgId}/file`;
