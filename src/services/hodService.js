import api from './api';

/** GET /api/hod/sections → { sections: [{ id, name, year, department, faculty_username, ... }] } */
export function fetchDeptSections() {
  return api.get('/hod/sections').then((res) => res.data.sections);
}

/** POST /api/hod/sections — { name, year? } → { section } */
export function createSection({ name, year }) {
  return api.post('/hod/sections', { name, year }).then((res) => res.data.section);
}

/** PATCH /api/hod/sections/:id/assign-faculty — { faculty_username } (null to unassign) */
export function assignSectionFaculty(sectionId, facultyUsername) {
  return api.patch(`/hod/sections/${sectionId}/assign-faculty`, { faculty_username: facultyUsername || null }).then((res) => res.data);
}

/** DELETE /api/hod/sections/:id — 400s if the section still has students in it */
export function deleteSection(id) {
  return api.delete(`/hod/sections/${id}`).then((res) => res.data);
}

/** GET /api/hod/faculty → { faculty: [{ username, name, department, section_ids, ... }] } */
export function fetchDeptFaculty() {
  return api.get('/hod/faculty').then((res) => res.data.faculty);
}

/** POST /api/hod/faculty — { name, username, password } → { faculty } */
export function createFaculty({ name, username, password }) {
  return api.post('/hod/faculty', { name, username, password }).then((res) => res.data.faculty);
}

/** DELETE /api/hod/faculty/:id */
export function deleteFaculty(id) {
  return api.delete(`/hod/faculty/${id}`).then((res) => res.data);
}

/** GET /api/hod/students → { students: [...] } */
export function fetchDeptStudents() {
  return api.get('/hod/students').then((res) => res.data.students);
}

/** POST /api/hod/students — { name, username, password, roll_number?, section_id, course?, current_year? } → { student } */
export function createStudent({ name, username, password, rollNumber, sectionId, course, currentYear }) {
  return api.post('/hod/students', { name, username, password, roll_number: rollNumber, section_id: sectionId, course: course || null, current_year: currentYear || null }).then((res) => res.data.student);
}

/** DELETE /api/hod/students/:id */
export function deleteStudent(id) {
  return api.delete(`/hod/students/${id}`).then((res) => res.data);
}

/** POST /api/hod/students/bulk-delete — { ids } or { remove_all: true } */
export function bulkDeleteStudents({ ids, removeAll }) {
  return api.post('/hod/students/bulk-delete', { ids, remove_all: !!removeAll }).then((res) => res.data);
}

/** POST /api/hod/faculty/bulk-delete — { ids } or { remove_all: true } */
export function bulkDeleteFaculty({ ids, removeAll }) {
  return api.post('/hod/faculty/bulk-delete', { ids, remove_all: !!removeAll }).then((res) => res.data);
}

/** PUT /api/hod/students/:id — any of { name, roll_number, section_id } (any section in this HOD's own department) */
export function updateHodStudent(id, fields) {
  return api.put(`/hod/students/${id}`, fields).then((res) => res.data.student);
}

/**
 * POST /api/hod/students/import/preview — multipart upload, field name
 * "file". Excel (.xlsx/.xls) or CSV with columns Name / Username /
 * Password / Roll Number. Section is NOT required in the file — it is
 * chosen afterward and applied to every row. Parses + validates only,
 * writes nothing. Returns { total, valid_count, invalid_count,
 * has_section_column, students: [{ row, name, roll_number, username,
 * status, errors }] }.
 */
export function previewImportStudents(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/hod/students/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/**
 * POST /api/hod/students/import — same file plus the section picked on
 * screen (section_id, must be one of this HOD's department sections) —
 * every valid row is created and assigned to that section. Re-validates
 * from scratch server-side. Returns { total, created_count, failed_count,
 * section, created: [...], errors: [{ row, error }], failures: [{ row,
 * roll_number, username, status, reason }] }.
 */
export function importStudents(file, sectionId) {
  const form = new FormData();
  form.append('file', file);
  if (sectionId) form.append('section_id', sectionId);
  return api.post('/hod/students/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/** GET /api/students/import/template — downloadable .xlsx starter template (Name/Username/Password/Roll Number). */
export const studentImportTemplateUrl = `${api.defaults.baseURL}/students/import/template`;

/**
 * GET /api/hod/analytics
 * Response: { students_by_section, attendance_by_section, marks_by_section:
 *   [{ label, count }], totals: { students, sections } }
 */
export function fetchHodAnalytics() {
  return api.get('/hod/analytics').then((res) => res.data);
}

/** GET /api/hod/branch-catalog → { course_types: [{value,label}], branches_by_course_type: { [course_type]: string[] } } */
export function fetchHodBranchCatalog() {
  return api.get('/hod/branch-catalog').then((res) => res.data);
}

/** GET /api/hod/profile → { course_type, course_label, branch } — the signed-in HOD's own Course Type + Branch (spec items 2-4). */
export function fetchHodProfile() {
  return api.get('/hod/profile').then((res) => res.data);
}

/** PUT /api/hod/profile — { course_type, branch } → { course_type, course_label, branch } */
export function updateHodProfile({ course_type, branch }) {
  return api.put('/hod/profile', { course_type, branch }).then((res) => res.data);
}

/**
 * POST /api/hod/students/points/reset (item 15) — resets Points to zero for
 * every student in this HOD's own department. Pass { all: true } or
 * { studentIds: [...] }. Response: { ok, reset_count }.
 */
export function resetHodStudentPoints({ all, studentIds } = {}) {
  return api.post('/hod/students/points/reset', all ? { all: true } : { student_ids: studentIds }).then((res) => res.data);
}
