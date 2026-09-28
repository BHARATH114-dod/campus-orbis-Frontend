import api from './api';

/**
 * GET /api/super/colleges
 * Response: { colleges: [{ id, name, has_logo, status, created_at,
 *   counts: { admins, hods, faculty, students, sections } }] }
 */
export function fetchColleges() {
  return api.get('/super/colleges').then((res) => res.data.colleges);
}

/**
 * POST /api/super/colleges (multipart/form-data — logo is optional)
 * Fields: name, admin_name, admin_username, admin_password, logo? (file)
 * Response: { college, admin }
 */
export function createCollege({ name, adminName, adminUsername, adminPassword }, logoFile) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('admin_name', adminName);
  formData.append('admin_username', adminUsername);
  formData.append('admin_password', adminPassword);
  if (logoFile) formData.append('logo', logoFile);
  return api
    .post('/super/colleges', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data);
}

/** PATCH /api/super/colleges/:id/status — { status: 'active' | 'disabled' } */
export function setCollegeStatus(id, status) {
  return api.patch(`/super/colleges/${id}/status`, { status }).then((res) => res.data);
}

/** DELETE /api/super/colleges/:id — removes the college and everything in it */
export function deleteCollege(id) {
  return api.delete(`/super/colleges/${id}`).then((res) => res.data);
}

/** GET /api/super/colleges/:id/logo — used directly as an <img src>, no auth header needed */
export const collegeLogoUrl = (id) => `/api/super/colleges/${id}/logo`;

/** GET /api/super/colleges/:id/admins → { admins: [{ id, name, username, created_at }] } */
export function fetchCollegeAdmins(collegeId) {
  return api.get(`/super/colleges/${collegeId}/admins`).then((res) => res.data.admins);
}

/** POST /api/super/colleges/:id/admins — { name, username, password } → { admin } */
export function createCollegeAdmin(collegeId, { name, username, password }) {
  return api.post(`/super/colleges/${collegeId}/admins`, { name, username, password }).then((res) => res.data.admin);
}

/**
 * PATCH /api/super/colleges/:id/admins/:adminId — any of { name, username, password }.
 * Omit password to leave it unchanged.
 */
export function updateCollegeAdmin(collegeId, adminId, fields) {
  return api.patch(`/super/colleges/${collegeId}/admins/${adminId}`, fields).then((res) => res.data.admin);
}

/** DELETE /api/super/colleges/:id/admins/:adminId */
export function deleteCollegeAdmin(collegeId, adminId) {
  return api.delete(`/super/colleges/${collegeId}/admins/${adminId}`).then((res) => res.data);
}
