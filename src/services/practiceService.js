import api from './api';

/**
 * Practice workspace — talks to /api/practice/*. Reuses the exact same
 * compiler engine as Courses/Exam Module (no second compiler). Files are
 * saved per-user; language + filename together identify a saved file.
 */
export function runPracticeCode(language, code, input = '') {
  return api.post('/practice/run', { language, code, input }).then((res) => res.data);
}
export function fetchPracticeFiles() {
  return api.get('/practice/files').then((res) => res.data);
}
export function fetchPracticeFile(id) {
  return api.get(`/practice/files/${id}`).then((res) => res.data);
}
export function savePracticeFile(name, language, code) {
  return api.post('/practice/files', { name, language, code }).then((res) => res.data);
}
export function deletePracticeFile(id) {
  return api.delete(`/practice/files/${id}`).then((res) => res.data);
}
