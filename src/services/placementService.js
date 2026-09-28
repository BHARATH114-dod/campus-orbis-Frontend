import api from './api';

/**
 * GET /api/placements
 * Response: { drives: [{ id, company_name, role_title, description,
 *   package_info, eligible_departments, drive_date, apply_by, status,
 *   created_by_name, applicant_count, is_open,
 *   my_application: { status, applied_at } | null,  // students only
 *   eligible: boolean | null                         // students only
 * }] }
 */
export function fetchDrives() {
  return api.get('/placements').then((res) => res.data.drives);
}

/** POST /api/placements — College Admin only. Response: { drive } */
export function createDrive(fields) {
  return api.post('/placements', fields).then((res) => res.data.drive);
}

/** PATCH /api/placements/:id — { status: 'open'|'closed' } */
export function setDriveStatus(id, status) {
  return api.patch(`/placements/${id}`, { status }).then((res) => res.data);
}

/** DELETE /api/placements/:id */
export function deleteDrive(id) {
  return api.delete(`/placements/${id}`).then((res) => res.data);
}

/** POST /api/placements/:id/apply — student only */
export function applyToDrive(id) {
  return api.post(`/placements/${id}/apply`).then((res) => res.data);
}

/** DELETE /api/placements/:id/apply — student only, only while status is 'applied' */
export function withdrawApplication(id) {
  return api.delete(`/placements/${id}/apply`).then((res) => res.data);
}

/** GET /api/placements/my — student's own application history */
export function fetchMyApplications() {
  return api.get('/placements/my').then((res) => res.data.applications);
}

/** GET /api/placements/:id/applications — College Admin (all) / HOD (own department only) */
export function fetchDriveApplications(driveId) {
  return api.get(`/placements/${driveId}/applications`).then((res) => res.data.applications);
}

/** PATCH /api/placements/applications/:id — College Admin only. { status } */
export function updateApplicationStatus(applicationId, status) {
  return api.patch(`/placements/applications/${applicationId}`, { status }).then((res) => res.data);
}

/** GET /api/hod/placements/report or /api/college/placements/report?department= */
export function fetchPlacementReport(scope, { department } = {}) {
  const base = scope === 'college_admin' ? '/college/placements/report' : '/hod/placements/report';
  const params = department ? { department } : {};
  return api.get(base, { params }).then((res) => res.data.report);
}

export function placementReportCsvUrl({ department } = {}) {
  const qs = department ? `?department=${encodeURIComponent(department)}` : '';
  return `/api/college/placements/report.csv${qs}`;
}
