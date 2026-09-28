import api from './api';

/**
 * POST /api/faculty/attendance
 * Body: { section_id, date, hour, subject_id, records: [{ student_username, present }] }
 * UPDATED: subject_id is now required — the backend validates this exact
 * section+date(day-of-week)+hour+subject+faculty combination actually
 * exists in the HOD-managed timetable before accepting it (403 if not
 * scheduled, 400 if the subject doesn't match what the timetable says).
 * Once submitted for a given section+date+hour, the backend LOCKS it —
 * resubmitting the same combination returns 409. There is no edit or
 * delete endpoint for attendance, by design.
 * Response: { ok: true }
 */
export function submitAttendance({ sectionId, date, hour, subjectId, records }) {
  return api
    .post('/faculty/attendance', { section_id: sectionId, date, hour, subject_id: subjectId, records })
    .then((res) => res.data);
}

/**
 * GET /api/faculty/attendance/:sectionId
 * Response: { attendance: [{ section_id, college_id, date, hour, subject_id,
 *   subject_name, semester_id, records: [{ student_username, present }],
 *   taken_by, taken_by_name, created_at }] }
 */
export function fetchSectionAttendance(sectionId) {
  return api.get(`/faculty/attendance/${sectionId}`).then((res) => res.data.attendance);
}

/**
 * GET /api/faculty/attendance-calendar/:sectionId?month=YYYY-MM
 * Response: { month, section_id, days: [{ date, status, expected_hours, reason }],
 *   summary: { eligible_working_days, attendance_completed, attendance_pending, holidays } }
 * `status` is one of: 'completed' | 'pending' | 'holiday' | 'future' | 'no_class'.
 */
export function fetchAttendanceCalendar(sectionId, month) {
  return api.get(`/faculty/attendance-calendar/${sectionId}`, { params: month ? { month } : {} }).then((res) => res.data);
}

/**
 * GET /api/student/attendance?semester_id=
 * Response: { history: [{ date, hour, subject_id, subject_name, present }],
 *   present_count, total_count, percentage,
 *   by_subject: [{ subject_id, subject_name, present_count, total_count, percentage }],
 *   semesters: [{ id, name, start_date, end_date }] }
 */
export function fetchMyAttendance(semesterId) {
  return api.get('/student/attendance', { params: semesterId ? { semester_id: semesterId } : {} }).then((res) => res.data);
}

/* ---------- HOD / College Admin reports ---------- */

/**
 * GET /api/hod/attendance/report?semester_id=
 * GET /api/college/attendance/report?department=&semester_id=
 * Response: { report: [{ username, name, department, section_id, roll_number,
 *   present_count, total_count, percentage }] }
 */
export function fetchAttendanceReport(scope, { department, semesterId } = {}) {
  const base = scope === 'college_admin' ? '/college/attendance/report' : '/hod/attendance/report';
  const params = {};
  if (department) params.department = department;
  if (semesterId) params.semester_id = semesterId;
  return api.get(base, { params }).then((res) => res.data.report);
}

export function attendanceReportCsvUrl(scope, { department, semesterId } = {}) {
  const base = scope === 'college_admin' ? '/api/college/attendance/report.csv' : '/api/hod/attendance/report.csv';
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (semesterId) params.set('semester_id', semesterId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * POST /api/hod/attendance/alert-low or /api/college/attendance/alert-low
 * Body: { threshold, department?, semester_id? }
 * Sends an in-app notification (existing Notifications system) to every
 * student below the threshold. Response: { ok, flagged_count, flagged }
 */
export function sendLowAttendanceAlert(scope, { threshold, department, semesterId }) {
  const base = scope === 'college_admin' ? '/college/attendance/alert-low' : '/hod/attendance/alert-low';
  return api
    .post(base, { threshold, department, semester_id: semesterId })
    .then((res) => res.data);
}
