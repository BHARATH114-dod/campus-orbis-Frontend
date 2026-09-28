import api from './api';

/* ---------- Student: face registration ---------- */

/**
 * GET /api/student/face/status
 * Response: { registered, registered_at, update_request: { id, status, requested_at, reason } | null }
 */
export function fetchMyFaceStatus() {
  return api.get('/student/face/status').then((res) => res.data);
}

/**
 * POST /api/student/face/register
 * Body: { descriptor: number[128] } — computed client-side, never a raw image.
 */
export function registerFace(descriptor) {
  return api.post('/student/face/register', { descriptor }).then((res) => res.data);
}

/**
 * POST /api/student/face/update-request
 * Body: { reason }
 */
export function requestFaceUpdate(reason) {
  return api.post('/student/face/update-request', { reason }).then((res) => res.data);
}

/* ---------- Faculty: face update requests ---------- */

/**
 * GET /api/faculty/face/update-requests
 * Response: { requests: [{ id, status, reason, requested_at, decided_at,
 *   student_name, student_username, roll_number, branch, section_name, year,
 *   current_face_status }] }
 */
export function fetchFaceUpdateRequests() {
  return api.get('/faculty/face/update-requests').then((res) => res.data.requests);
}

export function decideFaceUpdateRequest(id, decision) {
  // decision: 'approve' | 'reject'
  return api.post(`/faculty/face/update-requests/${id}/${decision}`).then((res) => res.data);
}

/* ---------- Faculty: face recognition attendance sessions ---------- */

/**
 * POST /api/faculty/attendance/face/session/start
 * Body: { section_id, date, hour, subject_id }
 * Response: { session, roster: [{ username, name, roll_number, face_registered }] }
 */
export function startFaceSession({ sectionId, date, hour, subjectId }) {
  return api
    .post('/faculty/attendance/face/session/start', { section_id: sectionId, date, hour, subject_id: subjectId })
    .then((res) => res.data);
}

/**
 * POST /api/faculty/attendance/face/session/:id/detect
 * Body: { faces: [{ descriptor: number[128] }], target_username? }
 * Response: { detected_this_frame, present_count, unknown_count, present: [...],
 *   not_detected_count, total_registered, total_students, target_result }
 * targetUsername (optional): switches this call into single-student
 * verification mode — only that student's registered face is compared
 * against, and the backend independently re-verifies they belong to this
 * session before matching anything.
 */
export function detectFaces(sessionId, faces, targetUsername = null) {
  const body = targetUsername ? { faces, target_username: targetUsername } : { faces };
  return api.post(`/faculty/attendance/face/session/${sessionId}/detect`, body).then((res) => res.data);
}

export function confirmFaceSession(sessionId) {
  return api.post(`/faculty/attendance/face/session/${sessionId}/confirm`).then((res) => res.data);
}

export function cancelFaceSession(sessionId) {
  return api.post(`/faculty/attendance/face/session/${sessionId}/cancel`).then((res) => res.data);
}
