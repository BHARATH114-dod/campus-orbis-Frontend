import api from './api';

/**
 * GET /api/clubs
 * Response: { clubs: [{ id, name, description, category, college_id,
 *   created_by, created_by_name, created_at, max_members, leader_username,
 *   leader_name, leader_confirmed, join_code (only if can_see_code),
 *   can_see_code, member_count, is_member, is_leader, is_full, can_manage,
 *   can_add_members }] }
 */
export function fetchClubs() {
  return api.get('/clubs').then((res) => res.data.clubs);
}

/** POST /api/clubs — college_admin/hod/faculty only. max_members and leader_username are required. Response: { club } */
export function createClub({ name, description, category, leader_username, max_members }) {
  return api.post('/clubs', { name, description, category, leader_username, max_members }).then((res) => res.data.club);
}

/**
 * GET /api/clubs/leader-candidates — students eligible to be picked as
 * Club Leader. Faculty see only students assigned to them; hod/college_admin
 * see the whole college roster. Response: { students: [{ name, username, roll_number, department, section_id }] }
 */
export function fetchLeaderCandidates() {
  return api.get('/clubs/leader-candidates').then((res) => res.data.students);
}

/** PATCH /api/clubs/:id — manager only. Edit details and/or max_members; leader_username only allowed before activation. Response: { club } */
export function updateClub(id, { name, description, category, leader_username, max_members }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (category !== undefined) body.category = category;
  if (leader_username !== undefined) body.leader_username = leader_username;
  if (max_members !== undefined) body.max_members = max_members;
  return api.patch(`/clubs/${id}`, body).then((res) => res.data.club);
}

/**
 * POST /api/clubs/:id/join — hod/faculty only (no code needed). Students
 * must use joinClubByCode above. Response: { ok: true }
 */
export function joinClub(id) {
  return api.post(`/clubs/${id}/join`).then((res) => res.data);
}

/**
 * POST /api/clubs/join-by-code — student/hod/faculty enter a club's join
 * code. If the club isn't activated yet, only the designated Club Leader's
 * entry is accepted and it activates the club; otherwise it's a regular
 * member join, subject to the Maximum Members cap.
 * Response: { ok, role: 'leader' | 'member', club }
 */
export function joinClubByCode(code) {
  return api.post('/clubs/join-by-code', { code }).then((res) => res.data);
}

/** POST /api/clubs/:id/transfer-leader — current leader or a manager hands the role to another existing member. Response: { club } */
export function transferClubLeader(clubId, username) {
  return api.post(`/clubs/${clubId}/transfer-leader`, { username }).then((res) => res.data.club);
}

/** DELETE /api/clubs/:id → { ok: true } */
export function deleteClub(id) {
  return api.delete(`/clubs/${id}`).then((res) => res.data);
}

/**
 * POST /api/clubs/bulk-delete — { ids } to remove specific clubs, or
 * { removeAll: true } for every club the caller can manage. Response:
 * { ok, removed, skipped }. Mirrors the student/faculty bulk-delete pattern.
 */
export function bulkDeleteClubs({ ids, removeAll } = {}) {
  const body = removeAll ? { remove_all: true } : { ids };
  return api.post('/clubs/bulk-delete', body).then((res) => res.data);
}

/**
 * GET /api/clubs/:id
 * Response: { club, members: [{ name, username, role }], posts: [{ id, body, author_username, author_name, created_at }] }
 */
export function fetchClub(id) {
  return api.get(`/clubs/${id}`).then((res) => res.data);
}

/** POST /api/clubs/:id/leave → { ok: true } */
export function leaveClub(id) {
  return api.post(`/clubs/${id}/leave`).then((res) => res.data);
}

/**
 * GET /api/clubs/:id/eligible-students?search= — students not yet on the
 * roster, for the "add student" picker. Response: { students: [{ name, username, department, section_id, roll_number }] }
 */
export function fetchEligibleStudents(clubId, search = '') {
  return api.get(`/clubs/${clubId}/eligible-students`, { params: { search } }).then((res) => res.data.students);
}

/** POST /api/clubs/:id/members — add one or more students directly. Response: { ok, added: [username] } */
export function addClubMembers(clubId, usernames) {
  return api.post(`/clubs/${clubId}/members`, { usernames }).then((res) => res.data);
}

/** DELETE /api/clubs/:id/members/:username — manager removes a member → { ok: true } */
export function removeClubMember(clubId, username) {
  return api.delete(`/clubs/${clubId}/members/${username}`).then((res) => res.data);
}

/** POST /api/clubs/:id/posts — members only. Response: { post } */
export function addClubPost(id, body) {
  return api.post(`/clubs/${id}/posts`, { body }).then((res) => res.data.post);
}

/** DELETE /api/clubs/:id/posts/:postId → { ok: true } */
export function deleteClubPost(clubId, postId) {
  return api.delete(`/clubs/${clubId}/posts/${postId}`).then((res) => res.data);
}

/**
 * GET /api/clubs/:id/gallery
 * Response: { images: [{ id, caption, uploaded_by, uploaded_by_name, created_at }] }
 */
export function fetchGallery(clubId) {
  return api.get(`/clubs/${clubId}/gallery`).then((res) => res.data.images);
}

/** POST /api/clubs/:id/gallery (multipart) — members only. Response: { image } */
export function uploadGalleryImage(clubId, file, caption) {
  const formData = new FormData();
  formData.append('image', file);
  if (caption) formData.append('caption', caption);
  return api
    .post(`/clubs/${clubId}/gallery`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data.image);
}

/** DELETE /api/clubs/:id/gallery/:imgId → { ok: true } */
export function deleteGalleryImage(clubId, imgId) {
  return api.delete(`/clubs/${clubId}/gallery/${imgId}`).then((res) => res.data);
}

// Same pattern as eventService's file URLs — plain authenticated GET, used
// directly as an <img src>, relying on the same-origin session cookie.
export const galleryImageUrl = (clubId, imgId) => `/api/clubs/${clubId}/gallery/${imgId}/file`;

/**
 * GET /api/clubs/:id/quiz-leaderboard — this club's own aggregated
 * Competition points across every quiz it has represented itself in.
 * Completely separate from the normal academic Campus Orbis leaderboard.
 * Response: { club_name, points, quizzes_played }
 */
export function fetchClubLeaderboard(clubId) {
  return api.get(`/clubs/${clubId}/quiz-leaderboard`).then((res) => res.data);
}

// Competition (quiz) functions now live in services/competitionService.js —
// Clubs and Competition are separate main sections (see spec item 3).

// ---------------------------------------------------------------------------
// NEW: multi-club Excel bulk creation. One row per student; rows are
// grouped by "Club Name" and each group becomes one club, with exactly one
// Club Leader per club (Club Leader = YES on that student's row). Flow:
// upload → previewImportClubs (parse + validate, nothing written) → user
// enters common details, optionally overrides a few per club → importClubs
// (re-validates from scratch, then creates every club that still passes).
// ---------------------------------------------------------------------------

/**
 * POST /api/clubs/import/preview — multipart upload, field name "file".
 * Columns: Club Name, Student Roll Number, Club Leader (YES/NO). Returns
 * { total_clubs, valid_count, invalid_count, clubs: [{ name, member_count,
 * leader, members: [{ row, roll_number, name, is_leader }], valid, errors }],
 * row_errors }.
 */
export function previewImportClubs(file) {
  const form = new FormData();
  form.append('file', file);
  return api.post('/clubs/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/**
 * POST /api/clubs/import — same file, plus `common` ({ description?,
 * category?, max_members }, applied to every detected club) and optional
 * `overrides` (an object keyed by club name, same shape as `common`, only
 * for the clubs that need a different value). Returns { total_clubs,
 * created_count, failed_count, created: [{ id, name, member_count }],
 * failed: [{ club, reason, reasons }], row_errors }.
 */
export function importClubs(file, { common, overrides } = {}) {
  const form = new FormData();
  form.append('file', file);
  form.append('common', JSON.stringify(common || {}));
  if (overrides) form.append('overrides', JSON.stringify(overrides));
  return api.post('/clubs/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
}

/** GET /api/clubs/import/template — downloadable .xlsx starter template (Club Name/Student Roll Number/Club Leader). */
export const clubImportTemplateUrl = `${api.defaults.baseURL}/clubs/import/template`;
