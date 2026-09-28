import api from './api';

/** GET /api/faculty/sections → { sections: [{ id, college_id, department, name, year, faculty_username, ... }] } */
export function fetchMySections() {
  return api.get('/faculty/sections').then((res) => res.data.sections);
}

/**
 * GET /api/faculty/students → { students: [{ username, name, department,
 *   section_id, roll_number, leaderboard_points, leaderboard_adjustment, ... }] }
 * `leaderboard_points` is the student's full, current Main Leaderboard total
 * (server-computed via the same buildLeaderboard used by GET /api/leaderboard
 * — never a separate calculation, so it can't drift from what the Main
 * Leaderboard shows for the same student). `leaderboard_adjustment` is only
 * the faculty's own manual +/- nudge on top of that (see adjustStudentPoints
 * below) — the two are shown as separate columns for that reason.
 */
export function fetchMyStudents() {
  return api.get('/faculty/students').then((res) => res.data.students);
}

/**
 * POST /api/faculty/students — narrower than the HOD's own student-creation
 * route: sectionId must be one of this faculty member's own assigned
 * sections (server enforces this too, not just the UI).
 */
export function createMyStudent({ name, username, password, rollNumber, sectionId, course, currentYear }) {
  return api.post('/faculty/students', { name, username, password, roll_number: rollNumber, section_id: sectionId, course: course || null, current_year: currentYear || null }).then((res) => res.data.student);
}

/**
 * DELETE /api/faculty/students/:id — same scope restriction as creation:
 * only students in one of this faculty member's own sections (403 if not,
 * enforced server-side).
 */
export function deleteMyStudent(id) {
  return api.delete(`/faculty/students/${id}`).then((res) => res.data);
}

/**
 * POST /api/faculty/students/import/preview — multipart upload, field name
 * "file". Section is NOT required in the sheet — parses + validates only.
 * Returns { total, valid_count, invalid_count, has_section_column, students: [...] }.
 */
export function previewImportMyStudents(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/faculty/students/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/**
 * POST /api/faculty/students/import — same file plus the section picked on
 * screen (section_id, must be one of this faculty member's own assigned
 * sections — server enforces this, same as createMyStudent). Returns
 * { total, created_count, failed_count, section, created, errors, failures }.
 */
export function importMyStudents(file, sectionId) {
  const form = new FormData();
  form.append('file', file);
  if (sectionId) form.append('section_id', sectionId);
  return api.post('/faculty/students/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/** GET /api/students/import/template — downloadable .xlsx starter template (Name/Username/Password/Roll Number). */
export const studentImportTemplateUrl = `${api.defaults.baseURL}/students/import/template`;

/**
 * POST /api/faculty/students/:id/points — Body: { delta } (positive to add,
 * negative to subtract). Only works for a student in one of this faculty
 * member's own assigned sections (403 otherwise, enforced server-side).
 * The adjustment is cumulative and immediately reflected in the leaderboard.
 * Response: { ok, points } — points is the new running total.
 */
export function adjustStudentPoints(id, delta) {
  return api.post(`/faculty/students/${id}/points`, { delta }).then((res) => res.data);
}

/**
 * POST /api/faculty/students/points/reset (item 15) — resets Points to zero.
 * Pass { all: true } for every student in this faculty's sections, or
 * { studentIds: [...] } for specific students (one id also works for the
 * "individual student" case). Response: { ok, reset_count }.
 */
export function resetStudentPoints({ all, studentIds } = {}) {
  return api.post('/faculty/students/points/reset', all ? { all: true } : { student_ids: studentIds }).then((res) => res.data);
}

/**
 * POST /api/faculty/students/bulk-delete — Body: { ids } or { remove_all: true }.
 * Scoped server-side to this faculty member's own sections, same as
 * deleteMyStudent. Response: { ok, removed, usernames }.
 */
export function bulkDeleteMyStudents({ ids, removeAll }) {
  return api.post('/faculty/students/bulk-delete', { ids, remove_all: !!removeAll }).then((res) => res.data);
}

/**
 * PUT /api/faculty/students/:id — Body: any of { name, roll_number, section_id }.
 * section_id must be one of this faculty member's own sections (403 otherwise).
 */
export function updateMyStudent(id, fields) {
  return api.put(`/faculty/students/${id}`, fields).then((res) => res.data.student);
}

/**
 * GET /api/faculty/students/fees (item 16) — fee details for exactly the
 * students in this faculty member's own assigned sections (never any other
 * student in the college; enforced server-side).
 * Response: { students: [{ id, name, username, roll_number, course,
 *   course_label, department, section_id, section_name, year,
 *   fees: { fee_items, total_amount, paid_amount, pending_amount, status } }] }
 */
export function fetchMyStudentsFees() {
  return api.get('/faculty/students/fees').then((res) => res.data.students);
}
