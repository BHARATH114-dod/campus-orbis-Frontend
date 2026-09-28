import api from './api';

/**
 * GET /api/search?q=... — Global Search (item 16). Role-scoped entirely
 * server-side (a query never returns a record outside the caller's own
 * college/department/section, same as every other list endpoint in this
 * app) — never filter an unscoped list on the frontend instead of calling
 * this. Not available to students.
 * Response: { students, faculty, hods, colleges } — arrays are empty for
 * categories the caller's role doesn't see (e.g. faculty only ever gets
 * `students` populated).
 */
export function globalSearch(q) {
  const query = String(q || '').trim();
  if (!query) return Promise.resolve({ students: [], faculty: [], hods: [], colleges: [] });
  return api.get('/search', { params: { q: query } }).then((res) => res.data);
}
