import api from './api';

/**
 * GET /api/leaderboard?scope=college|department|section&department=&section_id=
 * Response: { leaderboard: [{ username, name, department, section_id, score,
 *   breakdown, badges: [{label,icon}], rank }], hall_of_fame: [...top 5,
 *   college-wide, regardless of the requested scope], me: <entry|null>,
 *   scope, departments: [string], sections: [{ id, name, department }] }
 *
 * `me` is only populated for students (the ranking itself only ever
 * contains students — faculty/HOD/Admin can view it, but never appear in it).
 */
export function fetchLeaderboard({ scope, department, sectionId } = {}) {
  const params = {};
  if (scope) params.scope = scope;
  if (department) params.department = department;
  if (sectionId) params.section_id = sectionId;
  return api.get('/leaderboard', { params }).then((res) => res.data);
}
