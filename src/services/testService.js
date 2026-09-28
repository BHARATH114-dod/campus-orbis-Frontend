import api from './api';

/* ---------- Faculty ---------- */

/**
 * POST /api/faculty/tests
 * Body: { title, subject, section_id, duration_minutes, start_time?, end_time?,
 *   questions: [{ type:'mcq'|'theory'|'code', text, marks, options?, correct_index?,
 *     language?, starter_code?, test_cases?: [{ input, expected_output }] }] }
 * Response: { test }
 */
export function createTest(fields) {
  return api.post('/faculty/tests', fields).then((res) => res.data.test);
}

/** GET /api/faculty/tests → { tests: [{ ...test, status, question_count, submission_count, pending_grading_count }] } */
export function fetchMyTests() {
  return api.get('/faculty/tests').then((res) => res.data.tests);
}

/** GET /api/faculty/tests/:id → { test, submissions: [...], code_attempts: [...], activity_log: [...], activity_counts: { [username]: count } } */
export function fetchTestResults(id) {
  return api.get(`/faculty/tests/${id}`).then((res) => res.data);
}

/**
 * DELETE /api/faculty/tests/:id
 * `removePoints` (required, boolean) — the caller's explicit choice from
 * the confirmation dialog: true removes the test AND every point it
 * generated from the point ledger/leaderboard; false removes only the
 * test itself and leaves previously-earned points in place.
 * Response: { ok, points_removed }
 */
export function deleteTest(id, removePoints) {
  return api.delete(`/faculty/tests/${id}`, { data: { remove_points: removePoints } }).then((res) => res.data);
}

/** POST /api/faculty/tests/:id/submissions/:subId/grade — { scores: { [question_id]: number } } */
export function gradeSubmission(testId, submissionId, scores) {
  return api.post(`/faculty/tests/${testId}/submissions/${submissionId}/grade`, { scores }).then((res) => res.data);
}

export const testResultsCsvUrl = (id) => `/api/faculty/tests/${id}/results.csv`;

/* ---------- HOD (read-only, department-wide) ----------
 * Same response shape as GET /api/faculty/tests, but scoped to every test
 * conducted by any faculty member in the HOD's own department rather
 * than tests the caller created. Used to populate the test picker in
 * Test Monitoring for the hod role — see FacultyTestMonitoring.jsx. */
export function fetchDepartmentTests() {
  return api.get('/hod/tests').then((res) => res.data.tests);
}

/** GET /api/hod/tests/:id → { test, submissions } — full detail of any
 * test taught within the HOD's department (title, description, creator,
 * questions, options, correct answers, marks, duration, schedule,
 * assigned section, published status). */
export function fetchDepartmentTestDetail(id) {
  return api.get(`/hod/tests/${id}`).then((res) => res.data);
}

/** POST /api/hod/tests — HOD "Create New Test" / publish after "Use This Test". */
export function createHodTest(fields) {
  return api.post('/hod/tests', fields).then((res) => res.data.test);
}

/** PUT /api/hod/tests/:id — edit a test the HOD themselves created, before its start time. */
export function updateHodTest(id, fields) {
  return api.put(`/hod/tests/${id}`, fields).then((res) => res.data.test);
}

/** DELETE /api/hod/tests/:id — same remove-points decision as deleteTest() above. */
export function deleteHodTest(id, removePoints) {
  return api.delete(`/hod/tests/${id}`, { data: { remove_points: removePoints } }).then((res) => res.data);
}

/* ---------- HOD: Save/Clone faculty tests as reusable templates ----------
 * Mirrors the Faculty Saved Tests API 1:1 below, mounted under /hod so an
 * HOD's saved templates are kept in their own list. */

/** GET /api/hod/saved-tests */
export function fetchHodSavedTests() {
  return api.get('/hod/saved-tests').then((res) => res.data.saved_tests);
}

/** GET /api/hod/saved-tests/:id — full detail, for Edit / "Use This Test" prefill. */
export function fetchHodSavedTest(id) {
  return api.get(`/hod/saved-tests/${id}`).then((res) => res.data.saved_test);
}

/** POST /api/hod/saved-tests — { source_test_id } to clone a faculty test, or
 * { title, subject, description, duration_minutes, questions } from scratch. */
export function saveHodTestTemplate(fields) {
  return api.post('/hod/saved-tests', fields).then((res) => res.data.saved_test);
}

/** PUT /api/hod/saved-tests/:id */
export function updateHodSavedTest(id, fields) {
  return api.put(`/hod/saved-tests/${id}`, fields).then((res) => res.data.saved_test);
}

/** DELETE /api/hod/saved-tests/:id */
export function deleteHodSavedTest(id) {
  return api.delete(`/hod/saved-tests/${id}`).then((res) => res.data);
}

/* ---------- Faculty: Saved Tests (reusable question-paper templates) ----------
 * Independent of the Tests/TestSubmissions collections above — deleting or
 * editing a Saved Test never touches a Conducted Test and vice versa. */

/** GET /api/faculty/saved-tests → { saved_tests: [{ id, title, subject, description,
 *  duration_minutes, questions, question_count, total_marks, created_at, updated_at }] } */
export function fetchSavedTests() {
  return api.get('/faculty/saved-tests').then((res) => res.data.saved_tests);
}

/** GET /api/faculty/saved-tests/:id → { saved_test } — full detail, for Edit / Use Again prefill. */
export function fetchSavedTest(id) {
  return api.get(`/faculty/saved-tests/${id}`).then((res) => res.data.saved_test);
}

/**
 * POST /api/faculty/saved-tests
 * Either { source_test_id } to snapshot an already-conducted test as a new
 * template, or { title, subject, description, duration_minutes, questions }
 * to save straight from the create/edit test form.
 * `client_token` (optional) makes a duplicate click safe: the same token
 * sent twice returns the first-created row instead of a second one.
 */
export function saveTestTemplate(fields) {
  return api.post('/faculty/saved-tests', fields).then((res) => res.data.saved_test);
}

/** PUT /api/faculty/saved-tests/:id — edits the template only; already-conducted tests are unaffected. */
export function updateSavedTest(id, fields) {
  return api.put(`/faculty/saved-tests/${id}`, fields).then((res) => res.data.saved_test);
}

/** DELETE /api/faculty/saved-tests/:id — removes the template only; conducted tests/results are unaffected. */
export function deleteSavedTest(id) {
  return api.delete(`/faculty/saved-tests/${id}`).then((res) => res.data);
}

/* ---------- Student ---------- */

/**
 * GET /api/student/tests
 * Response: { tests: [{ id, title, subject, created_by_name, duration_minutes,
 *   start_time, end_time, question_count, total_marks, has_theory, has_code, status:
 *   'upcoming'|'open'|'closed', submitted, score, fully_graded }] }
 */
export function fetchAvailableTests() {
  return api.get('/student/tests').then((res) => res.data.tests);
}

/**
 * GET /api/student/tests/:id
 * Code questions include { language, starter_code, test_cases: [{ input, expected_output }] }.
 * If already submitted: { test: {...with correct_index}, submission }
 * If not yet attempted and open: { test: {...without correct_index}, submission: null, seconds_left }
 * `seconds_left` is anchored to actual join time (or the test's scheduled
 * start, whichever is later) and stays the same across reloads.
 * 403 if the window isn't open yet.
 */
export function fetchTestToAttempt(id) {
  return api.get(`/student/tests/${id}`).then((res) => res.data);
}

/**
 * POST /api/student/tests/:id/submit
 * Body: { answers: [{ selected_index?, text?, code? }], reason?: 'manual'|'tab_switch' }
 * One answer per question, in question order. Response: { submission, total_marks }.
 * A code question that fails some faculty-fixed test cases is simply
 * graded wrong (0 marks) — it never blocks or rejects the submission.
 *
 * This is the ONLY way a test is ever submitted. `reason` defaults to
 * 'manual' (the student's own Submit Exam → Confirm click). The one other
 * caller is the tab-switch auto-submit in TestAttempt.jsx, which passes
 * reason: 'tab_switch' the instant the Page Visibility API reports the
 * test tab is no longer visible — no other browser/window event (blur,
 * resize, fullscreen change, network drop, etc.) ever calls this.
 */
export function submitTest(id, { answers, reason }) {
  return api.post(`/student/tests/${id}/submit`, { answers, reason: reason || 'manual' }).then((res) => res.data);
}

/**
 * PUT /api/student/tests/:id/progress — Session Persistence autosave.
 * Body: { answers, current_question_index }. Best-effort; failures are
 * swallowed by the caller since the client-side localStorage autosave in
 * TestAttempt.jsx already covers same-browser refreshes on its own.
 */
export function saveTestProgress(id, { answers, current_question_index }) {
  return api.put(`/student/tests/${id}/progress`, { answers, current_question_index }).then((res) => res.data);
}

/**
 * POST /api/student/tests/:id/rejoin-requests — Body: { reason }.
 * Response: { rejoin_request, requests_used, requests_max }. 429 once the
 * per-test cap (3) is reached; 409 if a request is already pending.
 */
export function requestTestRejoin(id, reason) {
  return api.post(`/student/tests/${id}/rejoin-requests`, { reason }).then((res) => res.data);
}

/* ---------- Faculty: test editing, assignment, monitoring, rejoin ---------- */

/**
 * PUT /api/faculty/tests/:id — only accepted while the test is 'upcoming'
 * and no student has joined yet (409 otherwise). Body accepts any subset
 * of: title, subject, duration_minutes, start_time, end_time, questions,
 * published, assign_mode: 'all'|'selected', assigned_student_usernames.
 */
export function updateTest(id, fields) {
  return api.put(`/faculty/tests/${id}`, fields).then((res) => res.data.test);
}

/** GET /api/faculty/tests/:id/live-status → { students: [{ student_username, status, seconds_left, joined_at, submitted_at, rejoin_requests }] } */
export function fetchTestLiveStatus(id) {
  return api.get(`/faculty/tests/${id}/live-status`).then((res) => res.data.students);
}
export function fetchDepartmentTestLiveStatus(id) {
  return api.get(`/hod/tests/${id}/live-status`).then((res) => res.data.students);
}

/** GET /api/faculty/tests/:id/rejoin-requests → { rejoin_requests } */
export function fetchRejoinRequests(id) {
  return api.get(`/faculty/tests/${id}/rejoin-requests`).then((res) => res.data.rejoin_requests);
}

/** POST /api/faculty/tests/:id/rejoin-requests/:reqId/decision — { action: 'accept'|'reject' } */
export function decideRejoinRequest(testId, reqId, action) {
  return api.post(`/faculty/tests/${testId}/rejoin-requests/${reqId}/decision`, { action }).then((res) => res.data);
}

/**
 * GET /api/tests/:id/leaderboard — Exam Module leaderboard: ranked purely by
 * Final Test Points (join points + 2 pts per correct answer + remaining-time
 * points). Equal final points share the same rank.
 */
export function fetchTestLeaderboard(id) {
  return api.get(`/tests/${id}/leaderboard`).then((res) => res.data);
}

/**
 * GET /api/tests/all/leaderboard — "All Tests" combined leaderboard: total
 * test points, tests attempted, average score, and time/correct-answer point
 * subtotals per student, aggregated across every test the caller can see.
 */
export function fetchAllTestsLeaderboard() {
  return api.get('/tests/all/leaderboard').then((res) => res.data);
}

/**
 * POST /api/student/tests/:id/questions/:qId/run-code
 * Body: { code }
 * Lets a student try their code against the test cases before final
 * submission. Every run is logged server-side with a timestamp, whether or
 * not it passes. Response: { results: [{ input, expected_output, actual_output, passed, error }], all_passed }
 */
export function runTestCode(testId, questionId, code) {
  return api.post(`/student/tests/${testId}/questions/${questionId}/run-code`, { code }).then((res) => res.data);
}

/**
 * POST /api/student/tests/:id/questions/:qId/run-custom — Body: { code, input }.
 * Compiler Input/Output Display (item 12): runs the student's code against
 * input THEY typed, like a coding-practice "Run" button — never touches the
 * faculty's test cases and is never logged as an attempt.
 * Response: { input, output, error }
 */
export function runTestCodeCustomInput(testId, questionId, code, input) {
  return api.post(`/student/tests/${testId}/questions/${questionId}/run-custom`, { code, input }).then((res) => res.data);
}

/**
 * POST /api/student/tests/:id/activity — Body: { event_type }
 * Reports that the student's browser left the test page (tab switch, page
 * hidden, window blur) while a test is in progress. This ONLY records an
 * observation for the faculty activity log and triggers a faculty
 * notification — it never submits, ends, or otherwise changes the test.
 * Failures are swallowed by the caller; a failed report should never
 * interrupt the student's test.
 */
export function reportTestActivity(testId, eventType = 'tab_switch') {
  return api.post(`/student/tests/${testId}/activity`, { event_type: eventType }).then((res) => res.data);
}
