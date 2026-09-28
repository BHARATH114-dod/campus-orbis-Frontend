import api from './api';

/* ---------- Semesters (HOD) ---------- */
export function fetchSemesters() {
  return api.get('/hod/semesters').then((res) => res.data.semesters);
}
export function createSemester({ name, startDate, endDate }) {
  return api
    .post('/hod/semesters', { name, start_date: startDate, end_date: endDate })
    .then((res) => res.data.semester);
}
export function deleteSemester(id) {
  return api.delete(`/hod/semesters/${id}`).then((res) => res.data);
}

/* ---------- Subjects (HOD manages their own department; College Admin
   manages any department in their college — see `department` below) ---------- */
/**
 * @param {string} [department] Only meaningful for College Admin — filters
 * the list to one department. HOD always gets their own department
 * server-side regardless of this param.
 */
export function fetchSubjects(department) {
  return api.get('/hod/subjects', { params: department ? { department } : {} }).then((res) => res.data.subjects);
}
/**
 * @param {{ name: string, code?: string, department?: string }} args
 * `department` is required for College Admin (they aren't scoped to a
 * single department) and ignored for HOD (their own department is always
 * used server-side).
 */
export function createSubject({ name, code, department }) {
  return api.post('/hod/subjects', { name, code, department }).then((res) => res.data.subject);
}
export function deleteSubject(id) {
  return api.delete(`/hod/subjects/${id}`).then((res) => res.data);
}

/* ---------- Class schedule (internal to Attendance only — this is NOT a
   user-facing "Time Table" module. HOD builds the section/day/hour/subject
   grid from the Attendance > Timetable tab, and Faculty's Attendance page
   reads it to know what they're scheduled to teach today. There is no
   standalone Time Table page, publish flow, or student/HOD read-only view
   any more — those were removed. Keep this file/functions exactly as-is;
   Attendance depends on them.) ---------- */
/** GET /api/hod/timetable/:sectionId → { timetable: [{ id, section_id, day_of_week, hour, subject_id, faculty_username, assignee_role, status }] } */
export function fetchSectionTimetable(sectionId) {
  return api.get(`/hod/timetable/${sectionId}`).then((res) => res.data.timetable);
}

/**
 * POST /api/hod/timetable — upserts a single (section, day, hour) cell.
 * item 5: assigneeRole is 'faculty' (default) or 'hod'. `facultyUsername`
 * is kept as an accepted alias for `assigneeUsername` so the existing
 * embedded editor in HodAttendance.jsx (which only ever passes
 * facultyUsername) keeps working completely unmodified.
 */
export function upsertTimetableSlot({ sectionId, dayOfWeek, hour, subjectId, facultyUsername, assigneeUsername, assigneeRole }) {
  return api
    .post('/hod/timetable', {
      section_id: sectionId, day_of_week: dayOfWeek, hour, subject_id: subjectId,
      assignee_username: assigneeUsername || facultyUsername, assignee_role: assigneeRole || 'faculty',
    })
    .then((res) => res.data.slot);
}

export function deleteTimetableSlot(id) {
  return api.delete(`/hod/timetable/${id}`).then((res) => res.data);
}

/**
 * GET /api/faculty/timetable?date=YYYY-MM-DD (defaults to today)
 * Response: { date, day_of_week, slots: [{ id, section_id, section_name, hour,
 *   subject_id, subject_name, faculty_username, already_taken }] }
 * This is what drives the "only your scheduled hour, per the timetable" rule
 * on the faculty Attendance page.
 */
export function fetchMyTimetableForDate(date) {
  return api.get('/faculty/timetable', { params: date ? { date } : {} }).then((res) => res.data);
}

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * GET /api/hod/peer-hods (item 11) — every HOD in the same college
 * (any department), for the "assign an HOD to this slot" option.
 */
export function fetchPeerHods() {
  return api.get('/hod/peer-hods').then((res) => res.data.hods);
}

/**
 * GET /api/faculty/timetable/full (items 12/13) — the complete weekly
 * timetable for every section this faculty member is assigned to, with
 * `is_mine` marking exactly their own hours for highlighting. View-only.
 * Response: { sections: [{id,name,year}], slots: [{id, section_id,
 *   day_of_week, hour, subject_name, assignee_username, assignee_role,
 *   assignee_name, is_mine}] }
 */
export function fetchMyFullTimetable() {
  return api.get('/faculty/timetable/full').then((res) => res.data);
}

/**
 * GET /api/student/timetable (item 14) — the student's own section's
 * complete weekly timetable. Section is always the signed-in student's own
 * (enforced server-side; no section_id can be passed).
 * Response: { section: {id,name,year} | null, slots: [{id, day_of_week,
 *   hour, subject_name, assignee_role, assignee_name}] }
 */
export function fetchMyStudentTimetable() {
  return api.get('/student/timetable').then((res) => res.data);
}

/* ---------- Academic Calendar ----------
 * HOD owns it (their own department); College Admin gets read-only access
 * across departments. A calendar entry with `year: null` applies to the
 * whole department; a year-specific entry overrides it for that year only.
 */

/** GET /api/hod/academic-calendar?year=&from=&to= → entries for the HOD's own department */
export function fetchHodAcademicCalendar({ year, from, to } = {}) {
  const params = {};
  if (year) params.year = year;
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/hod/academic-calendar', { params }).then((res) => res.data.calendar);
}

/** POST /api/hod/academic-calendar — add or edit the entry for one date (upsert) */
export function upsertAcademicCalendarEntry({ date, status, reason, year }) {
  return api.post('/hod/academic-calendar', { date, status, reason: reason || null, year: year || null }).then((res) => res.data.calendar);
}

/** PUT /api/hod/academic-calendar/:id — edit an existing entry directly */
export function updateAcademicCalendarEntry(id, { status, reason }) {
  return api.put(`/hod/academic-calendar/${id}`, { status, reason }).then((res) => res.data.calendar);
}

/** DELETE /api/hod/academic-calendar/:id — remove an incorrectly added entry */
export function deleteAcademicCalendarEntry(id) {
  return api.delete(`/hod/academic-calendar/${id}`).then((res) => res.data);
}

/** GET /api/college/academic-calendar?department=&year=&from=&to= — read-only, College Admin */
export function fetchCollegeAcademicCalendar({ department, year, from, to } = {}) {
  const params = { department };
  if (year) params.year = year;
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/college/academic-calendar', { params }).then((res) => res.data.calendar);
}

/** GET /api/student/academic-calendar?from=&to= — read-only, auto-scoped to the student's own college/branch/year server-side */
export function fetchStudentAcademicCalendar({ from, to } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/student/academic-calendar', { params }).then((res) => res.data.calendar);
}

/** GET /api/faculty/academic-calendar?from=&to= — read-only, auto-scoped to the faculty member's own college/department server-side */
export function fetchFacultyAcademicCalendar({ from, to } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return api.get('/faculty/academic-calendar', { params }).then((res) => res.data.calendar);
}
