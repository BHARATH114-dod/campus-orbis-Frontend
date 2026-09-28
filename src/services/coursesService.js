import api from './api';

/**
 * Courses (multi-language) — talks to the generalized /api/student/courses/*
 * and /api/faculty/courses/* routes added in server.js. This is additive:
 * pythonCourseService.js and /python-course keep working exactly as before.
 * Coding execution reuses the exact same Judge0-backed engine as everything
 * else in the app (Exam Module, Python Full Course, Practice).
 */

// ---- Student ----
export function fetchStudentCourses() {
  return api.get('/student/courses').then((res) => res.data);
}
export function fetchCourseDashboard(language) {
  return api.get(`/student/courses/${language}`).then((res) => res.data);
}
export function fetchCourseLesson(language, lessonId) {
  return api.get(`/student/courses/${language}/lessons/${lessonId}`).then((res) => res.data);
}
export function runCoursePractice(language, lessonId, code, input = '') {
  return api.post(`/student/courses/${language}/lessons/${lessonId}/practice/run-code`, { code, input }).then((res) => res.data);
}
export function fetchCourseLessonTest(language, lessonId) {
  return api.get(`/student/courses/${language}/lessons/${lessonId}/test`).then((res) => res.data);
}
export function runCourseTestQuestionCode(language, lessonId, questionId, code) {
  return api.post(`/student/courses/${language}/lessons/${lessonId}/test/questions/${questionId}/run-code`, { code }).then((res) => res.data);
}
export function submitCourseLessonTest(language, lessonId, answers) {
  return api.post(`/student/courses/${language}/lessons/${lessonId}/test/submit`, { answers }).then((res) => res.data);
}
// "Updated Course Answers" — Faculty-only (see server.js buildUpdatedCourseAnswersText).
// Streams the live-generated answer-key text file and triggers a normal
// browser download. There is no student-facing route for this at all —
// it's never called from the student side of the app.
export function downloadUpdatedCourseAnswers(language) {
  return api.get(`/faculty/courses/${language}/download`, { responseType: 'blob' }).then((res) => {
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${language}-updated-course-answers.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  });
}

// ---- Faculty ----
export function fetchFacultyCourses() {
  return api.get('/faculty/courses').then((res) => res.data);
}
// Per-language ON/OFF toggles, gated by the college's Super-Admin-managed
// course access (spec §5/§11) — replaces the older single "semester
// unlock" model.
export function fetchFacultyCourseAccess() {
  return api.get('/faculty/courses/access').then((res) => res.data);
}
export function setFacultyLanguageEnabled(language, enabled) {
  return api.post('/faculty/courses/access', { language, enabled }).then((res) => res.data);
}
export function fetchFacultyCourseStudents(language) {
  return api.get(`/faculty/courses/${language}/students`).then((res) => res.data);
}
export function fetchFacultyCourseStudentDetail(language, username) {
  return api.get(`/faculty/courses/${language}/students/${username}`).then((res) => res.data);
}
export function fetchFacultyDailyProgress(language) {
  return api.get(`/faculty/courses/${language}/daily-progress`).then((res) => res.data);
}
// Faculty preview: same read routes as a student, just without the lock
// check (backend allows faculty through requireCourseAccess unconditionally).
export const fetchFacultyCourseDashboard = fetchCourseDashboard;
export const fetchFacultyCourseLesson = fetchCourseLesson;

export const COURSE_LANGUAGES = [
  { value: 'python', label: 'Python', icon: '🐍', ext: '.py' },
  { value: 'c', label: 'C', icon: '🇨', ext: '.c' },
  { value: 'cpp', label: 'C++', icon: '➕', ext: '.cpp' },
  { value: 'java', label: 'Java', icon: '☕', ext: '.java' },
  { value: 'javascript', label: 'JavaScript', icon: '🟨', ext: '.js' },
];
