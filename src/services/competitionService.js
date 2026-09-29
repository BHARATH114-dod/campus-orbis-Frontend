import api from './api';

// ---------- Competition (fast-paced club-vs-club live quiz) ----------
// A quiz is not scoped to any one club (spec item 8) — any student who
// already belongs to a club can join with the quiz code, but only one
// representative per club may play in a given quiz (spec item 10). The
// leaderboard ranks clubs, not individual students (spec items 13, 15–17).

/**
 * GET /api/competition-quizzes — every quiz in the college. Everyone can
 * see it exists (title/status/question count); the code and answers stay
 * hidden unless you manage that specific quiz.
 * Response: { quizzes: [{ id, title, description, status, question_count,
 *   created_by_name, created_at, can_manage, quiz_code (only if can_manage) }] }
 */
export function fetchCompetitionQuizzes() {
  return api.get('/competition-quizzes').then((res) => res.data.quizzes);
}

/** GET /api/competition-quizzes/:id → { quiz } */
export function fetchCompetitionQuiz(quizId) {
  return api.get(`/competition-quizzes/${quizId}`).then((res) => res.data.quiz);
}

/**
 * POST /api/competition-quizzes — faculty/hod/college_admin only.
 * questions: [{ text, options: [string,...2-6], correct_index, time_limit_seconds (5-60), max_points }]
 * Response: { quiz } — including quiz_code (creator-only view)
 */
export function createCompetitionQuiz({ title, description, questions, saveAsTest, logo }) {
  return api
    .post('/competition-quizzes', { title, description, questions, save_as_test: !!saveAsTest, logo })
    .then((res) => res.data);
}

/** DELETE /api/competition-quizzes/:id — manager only. Response: { ok: true } */
export function deleteCompetitionQuiz(quizId) {
  return api.delete(`/competition-quizzes/${quizId}`).then((res) => res.data);
}

/**
 * POST /api/competition-quizzes/join — enter a quiz code.
 * Response: { ok, quiz_id, title, club_name, display_name }
 */
export function joinCompetitionQuiz(code, displayName) {
  return api.post('/competition-quizzes/join', { code, display_name: displayName || undefined }).then((res) => res.data);
}

/** PATCH /api/competition-quizzes/:id/my-profile — edit team name, display name, and logo in lobby without exiting */
export function updateQuizParticipantProfile(quizId, { club_name, display_name, logo }) {
  return api.patch(`/competition-quizzes/${quizId}/my-profile`, { club_name, display_name, logo }).then((res) => res.data);
}

/** POST /api/competition-quizzes/:id/kick — host only, kicks participant from lobby */
export function kickQuizParticipant(quizId, username) {
  return api.post(`/competition-quizzes/${quizId}/kick`, { username }).then((res) => res.data);
}

/** POST /api/competition-quizzes/:id/save-as-test — host only, saves an already-created quiz as a reusable template. Response: { saved_test } */
export function saveCompetitionQuizAsTest(quizId) {
  return api.post(`/competition-quizzes/${quizId}/save-as-test`).then((res) => res.data.saved_test);
}

/**
 * GET /api/saved-club-quizzes — faculty/hod/college_admin only. Reusable
 * quiz templates saved via "Save as Test". Response: { saved_tests: [{
 *   id, title, description, question_count, created_by_name, created_at,
 *   times_conducted, can_manage, logo }] }
 */
export function fetchSavedClubQuizzes() {
  return api.get('/saved-club-quizzes').then((res) => res.data.saved_tests);
}

/** GET /api/saved-club-quizzes/:id → { saved_test: { ...with questions including correct_index } } */
export function fetchSavedClubQuiz(id) {
  return api.get(`/saved-club-quizzes/${id}`).then((res) => res.data.saved_test);
}

/** PUT /api/saved-club-quizzes/:id → { saved_test } */
export function updateSavedClubQuiz(id, { title, description, questions, logo }) {
  return api.put(`/saved-club-quizzes/${id}`, { title, description, questions, logo }).then((res) => res.data.saved_test);
}

/** DELETE /api/saved-club-quizzes/:id → { ok: true } */
export function deleteSavedClubQuiz(id) {
  return api.delete(`/saved-club-quizzes/${id}`).then((res) => res.data);
}

/**
 * POST /api/saved-club-quizzes/:id/conduct — creates a brand-new live quiz
 * from the saved template (its own id + join code); the saved template is
 * never modified. Optional { title, description } override the copy's.
 * Response: { quiz }
 */
export function conductSavedClubQuiz(id, { title, description } = {}) {
  return api.post(`/saved-club-quizzes/${id}/conduct`, { title, description }).then((res) => res.data.quiz);
}

/** POST /api/competition-quizzes/:id/start — host only, moves the quiz from lobby into question 1 for everyone at once. Response: { ok: true } */
export function startCompetitionQuiz(quizId) {
  return api.post(`/competition-quizzes/${quizId}/start`).then((res) => res.data);
}

/**
 * GET /api/competition-quizzes/:id/session — poll this (e.g. every 1–1.5s)
 * while a quiz is running. Response shape depends on session.status:
 *  - 'lobby':    { id, title, status, is_host, joined, total_questions, participant_count (host only) }
 *  - 'live':     + { current_index, question: { id, index, text, options,
 *                 time_limit_seconds, max_points }, time_remaining_ms, answered }
 *  - 'between':  + { question_result: { correct_index, ... }, between_remaining_ms,
 *                 leaderboard: { top: [{rank,club_id,club_name,points}], mine } }
 *  - 'finished': + { final_leaderboard: { top: [...], mine } }
 */
export function fetchCompetitionQuizSession(quizId) {
  return api.get(`/competition-quizzes/${quizId}/session`).then((res) => res.data.session);
}

/** POST /api/competition-quizzes/:id/answer — submit the currently-live question's answer, scoring for your whole club. Response: { correct, points, total_score } */
export function submitCompetitionQuizAnswer(quizId, optionIndex) {
  return api.post(`/competition-quizzes/${quizId}/answer`, { option_index: optionIndex }).then((res) => res.data);
}

/** GET /api/competition-quizzes/:id/leaderboard — full club-ranked list for one quiz. Response: { quiz_title, leaderboard: [{rank,club_id,club_name,points}] } */
export function fetchCompetitionQuizLeaderboard(quizId) {
  return api.get(`/competition-quizzes/${quizId}/leaderboard`).then((res) => res.data);
}

/**
 * GET /api/competition-quizzes/:id/participants — who has joined so far.
 * Faculty/host view includes full identity per row; the participant view
 * only sees which clubs are represented and by whom.
 * Response: { participants: [{ name, username (host only), roll_number (host only), club_name, joined, joined_at (host only) }] }
 */
export function fetchCompetitionQuizParticipants(quizId) {
  return api.get(`/competition-quizzes/${quizId}/participants`).then((res) => res.data.participants);
}
