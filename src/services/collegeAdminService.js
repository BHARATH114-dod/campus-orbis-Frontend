import api from './api';

/** GET /api/college/me → { college: { id, name, has_logo, ... } | null } */
export function fetchMyCollege() {
  return api.get('/college/me').then((res) => res.data.college);
}

/** GET /api/college/hods → { hods: [{ username, name, department, ... }] } */
export function fetchHods() {
  return api.get('/college/hods').then((res) => res.data.hods);
}

/** POST /api/college/hods — { name, username, password, department } → { hod } */
export function createHod({ name, username, password, department }) {
  return api.post('/college/hods', { name, username, password, department }).then((res) => res.data.hod);
}

/** DELETE /api/college/hods/:id */
export function deleteHod(id) {
  return api.delete(`/college/hods/${id}`).then((res) => res.data);
}

/** POST /api/college/hods/bulk-delete — { ids } or { remove_all: true } */
export function bulkDeleteHods({ ids, removeAll }) {
  return api.post('/college/hods/bulk-delete', { ids, remove_all: !!removeAll }).then((res) => res.data);
}

/** GET /api/college/aos → { aos: [{ username, name, ... }] } — AO (fee management) accounts, college-wide. */
export function fetchAos() {
  return api.get('/college/aos').then((res) => res.data.aos);
}

/** POST /api/college/aos — { name, username, password } → { ao } */
export function createAo({ name, username, password }) {
  return api.post('/college/aos', { name, username, password }).then((res) => res.data.ao);
}

/** DELETE /api/college/aos/:id */
export function deleteAo(id) {
  return api.delete(`/college/aos/${id}`).then((res) => res.data);
}

/** POST /api/college/aos/bulk-delete — { ids } or { remove_all: true } */
export function bulkDeleteAos({ ids, removeAll }) {
  return api.post('/college/aos/bulk-delete', { ids, remove_all: !!removeAll }).then((res) => res.data);
}

/**
 * GET /api/college/sections — college-wide, every department. This
 * endpoint already existed (built for the Announcements/Notes/Events
 * audience picker) but was never wrapped in its own service function
 * until now.
 */
export function fetchAllSections() {
  return api.get('/college/sections').then((res) => res.data.sections);
}

/**
 * GET /api/college/faculty / GET /api/college/students
 * Read-only, college-wide (every department at once) — College Admin
 * oversight only. Creating faculty/students is HOD's job within their own
 * department; there's no create/delete route for College Admin here on
 * purpose, matching the role hierarchy.
 */
export function fetchAllFaculty() {
  return api.get('/college/faculty').then((res) => res.data.faculty);
}
export function fetchAllStudents() {
  return api.get('/college/students').then((res) => res.data.students);
}

/**
 * GET /api/college/analytics
 * Response: { registrations_by_month, events_by_month, post_status: [{label,count}],
 *   department_participation: [{label,count}], totals: { students, events, open_posts } }
 */
export function fetchCollegeAnalytics() {
  return api.get('/college/analytics').then((res) => res.data);
}
