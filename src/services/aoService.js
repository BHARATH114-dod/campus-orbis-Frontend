import api from './api';

/**
 * GET /api/ao/students — college-wide student list + filters. Query params
 * are all optional: department, course, year (section's classroom year),
 * section_id, pending ('true' to show only students missing their academic
 * year), q (search). EAMCET/Management admission categories have been
 * removed entirely — there is no `category` param anymore.
 * Each student comes back with `academic: { course, course_duration_years,
 * current_year, is_final_year, academic_status, pending }` and
 * `fees: { fee_items, total_amount, paid_amount, pending_amount, status }`
 * already computed server-side.
 */
export function fetchAoStudents(params = {}) {
  return api.get('/ao/students', { params }).then((res) => res.data.students);
}

/** GET /api/ao/sections — every section in the college, any department. */
export function fetchAoSections() {
  return api.get('/ao/sections').then((res) => res.data.sections);
}

/** GET /api/ao/students/:id → { student, fees } — full profile for the Student Profile view. */
export function fetchAoStudent(id) {
  return api.get(`/ao/students/${id}`).then((res) => res.data);
}

/**
 * PUT /api/ao/students/:id — { course?, current_year?, academic_status? }.
 * Only ever touches these AO-owned academic fields; name/roll
 * number/section stay HOD's job. course_duration_years is always derived
 * server-side from the selected course — never sent here.
 *   - Setting `course` alone defaults `current_year` to 1 server-side.
 *   - `academic_status: 'completed'` is only accepted once the student is
 *     in their course's final year (server validates this).
 */
export function updateAoStudent(id, fields) {
  return api.put(`/ao/students/${id}`, fields).then((res) => res.data.student);
}

/** PUT /api/ao/students/:id/fees — { fee_items: [{ id?, fee_type, total_amount, paid_amount }] } → { fees } */
export function updateAoStudentFees(id, feeItems) {
  return api.put(`/ao/students/${id}/fees`, { fee_items: feeItems }).then((res) => res.data.fees);
}

/**
 * POST /api/ao/students — Add Student. { name, username, password,
 * roll_number, section_id, course?, current_year? } → { student }.
 * `current_year` is optional even when `course` is set — a student left
 * without a year lands on the Pending list.
 */
export function createAoStudent(fields) {
  return api.post('/ao/students', fields).then((res) => res.data.student);
}

/**
 * NEW: AO bulk-add students from Excel/CSV — same import engine as HOD and
 * Faculty. college-wide, so the section picked after upload can be from
 * any department. Preview parses + validates only (writes nothing);
 * import creates every valid row and assigns it to the chosen section.
 */
export function previewImportAoStudents(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/ao/students/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}
export function importAoStudents(file, sectionId) {
  const form = new FormData();
  form.append('file', file);
  if (sectionId) form.append('section_id', sectionId);
  return api.post('/ao/students/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/** GET /api/students/import/template — downloadable .xlsx starter template (Name/Username/Password/Roll Number). */
export const studentImportTemplateUrl = `${api.defaults.baseURL}/students/import/template`;
