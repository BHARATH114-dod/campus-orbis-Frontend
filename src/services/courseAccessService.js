import api from './api';

/**
 * Course Access + Payments (spec §6-14) — Super Admin college-wise course
 * access management, global payment settings, College Admin package
 * requests, and the Super Admin verification panel.
 */

// ---- Super Admin: college-wise access ----
export function fetchSuperCourseAccess() {
  return api.get('/super/course-access').then((res) => res.data);
}
export function fetchSuperCourseAccessHistory(collegeId) {
  return api.get(`/super/course-access/${collegeId}/history`).then((res) => res.data);
}
export function unlockCollegeCourseAccess(collegeId, { durationMonths, customExpiry }) {
  return api.post(`/super/course-access/${collegeId}/unlock`, { duration_months: durationMonths, custom_expiry: customExpiry }).then((res) => res.data);
}
export function unlockCollegeCourseAccessFree(collegeId, { durationMonths, customExpiry }) {
  return api.post(`/super/course-access/${collegeId}/unlock-free`, { duration_months: durationMonths, custom_expiry: customExpiry }).then((res) => res.data);
}
export function lockCollegeCourseAccess(collegeId) {
  return api.post(`/super/course-access/${collegeId}/lock`).then((res) => res.data);
}

// ---- Super Admin: payment settings ----
export function fetchSuperPaymentSettings() {
  return api.get('/super/payment-settings').then((res) => res.data);
}
export function saveSuperPaymentSettings(fields, qrFile) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v ?? ''));
  if (qrFile) form.append('qr_image', qrFile);
  return api.put('/super/payment-settings', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

// ---- Super Admin: payment verification ----
export function fetchSuperCourseRequests(status) {
  return api.get('/super/course-requests', { params: status ? { status } : {} }).then((res) => res.data);
}
export function approveCourseRequest(id, { durationMonths, customExpiry }) {
  return api.post(`/super/course-requests/${id}/approve`, { duration_months: durationMonths, custom_expiry: customExpiry }).then((res) => res.data);
}
export function rejectCourseRequest(id, reason) {
  return api.post(`/super/course-requests/${id}/reject`, { reason }).then((res) => res.data);
}

// ---- College Admin: request a package ----
export function fetchCollegeCourseAccess() {
  return api.get('/college/course-access').then((res) => res.data);
}
export function fetchCollegePaymentSettings() {
  return api.get('/college/payment-settings').then((res) => res.data);
}
export function fetchCollegeCourseRequests() {
  return api.get('/college/course-requests').then((res) => res.data);
}
export function submitCollegeCourseRequest({ pkg, transactionId, upiId, notes, screenshot }) {
  const form = new FormData();
  form.append('package', pkg);
  form.append('transaction_id', transactionId);
  form.append('upi_id', upiId || '');
  form.append('notes', notes || '');
  form.append('screenshot', screenshot);
  return api.post('/college/course-requests', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

export const COURSE_PACKAGES = [
  { value: 'basic', label: 'Basic', duration: '1 Month' },
  { value: 'standard', label: 'Standard', duration: '3 Months' },
  { value: 'premium', label: 'Premium', duration: '6 Months' },
  { value: 'pro', label: 'Pro', duration: '1 Year' },
  { value: 'enterprise', label: 'Enterprise', duration: '2 Years' },
];
