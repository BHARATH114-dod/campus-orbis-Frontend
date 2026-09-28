// Single source of truth for what each role sees in the sidebar. Kept
// separate from the Sidebar component so later modules can extend it
// without touching layout code.
//
// Tests: faculty create/grade their own; students take them. HOD also has
// a Tests surface (view every test in their department, save/clone any of
// them as a reusable template, reuse a saved template or start from
// scratch to publish their own tests) — see HodTests.jsx / the
// /api/hod/tests and /api/hod/saved-tests routes in server.js. College
// Admin still has no Tests surface: the backend has no admin-level test
// ownership or scoping, so it's deliberately absent from that role's nav.
// Test Monitoring: faculty monitor only tests they themselves created.
// HOD also gets Test Monitoring — read-only, department-wide (every test
// run by faculty in their department) — which is why HOD now has its own
// explicit nav array below instead of aliasing straight to College Admin's.
// College Admin still has no Tests/Test Monitoring surface: the backend
// scopes read-only monitoring to HOD (department) and faculty (own tests)
// only, so it's deliberately absent from College Admin's nav rather than
// linking to a page with nothing to show.
// Board (Public Board): postable by hod/faculty/student; College Admin can
// moderate (resolve/delete) but never compose — mirrors the backend's own
// requireRole('hod','faculty','student') on POST /api/posts exactly.
// Subjects: College Admin's "Add Subject" surface — manages subjects across
// every department in the college, unlike HOD's Subjects tab (inside
// Attendance) which is scoped to their own department. Backend enforces
// requireRole('hod', 'college_admin') on /api/hod/subjects regardless of
// this nav entry, so Faculty/Student never reach it even by URL.

export const NAV_CONFIG = {
  student: [
    { label: 'Dashboard', path: '/student/dashboard', icon: '🏠' },
    { label: 'Courses', path: '/courses', icon: '🎓' },
    { label: 'Practice', path: '/practice', icon: '🧑‍💻' },
    { label: 'Events', path: '/events', icon: '📅' },
    { label: 'Clubs', path: '/clubs', icon: '🎭' },
    { label: 'Competition', path: '/competition', icon: '🥇' },
    { label: 'Notes', path: '/notes', icon: '📝' },
    { label: 'Attendance', path: '/attendance', icon: '✅' },
    { label: 'Timetable', path: '/student/timetable', icon: '🗓️' },
    { label: 'Tests', path: '/tests', icon: '🧪' },
    { label: 'Placements', path: '/placements', icon: '💼' },
    { label: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
    { label: 'Board', path: '/board', icon: '📌' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
  faculty: [
    { label: 'Dashboard', path: '/faculty/dashboard', icon: '🏠' },
    { label: 'Students', path: '/faculty/students', icon: '🧑‍🎓' },
    { label: 'Fee Details', path: '/faculty/fees', icon: '💳' },
    { label: 'Courses', path: '/courses', icon: '🎓' },
    { label: 'Practice', path: '/practice', icon: '🧑‍💻' },
    { label: 'Events', path: '/events', icon: '📅' },
    { label: 'Clubs', path: '/clubs', icon: '🎭' },
    { label: 'Competition', path: '/competition', icon: '🥇' },
    { label: 'Notes', path: '/notes', icon: '📝' },
    { label: 'Attendance', path: '/attendance', icon: '✅' },
    { label: 'Timetable', path: '/faculty/timetable', icon: '🗓️' },
    { label: 'Tests', path: '/tests', icon: '🧪' },
    { label: 'Test Monitoring', path: '/test-monitoring', icon: '🎥' },
    { label: 'Messages', path: '/messages', icon: '💬' },
    { label: 'Placements', path: '/placements', icon: '💼' },
    { label: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
    { label: 'Board', path: '/board', icon: '📌' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
  college_admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '🏠' },
    { label: 'People', path: '/people', icon: '🧑‍🤝‍🧑' },
    { label: 'Subjects', path: '/college/subjects', icon: '📚' },
    { label: 'Request Course', path: '/college/request-course', icon: '🎓' },
    { label: 'Events', path: '/events', icon: '📅' },
    { label: 'Clubs', path: '/clubs', icon: '🎭' },
    { label: 'Competition', path: '/competition', icon: '🥇' },
    { label: 'Notes', path: '/notes', icon: '📝' },
    { label: 'Attendance', path: '/attendance', icon: '✅' },
    { label: 'Placements', path: '/placements', icon: '💼' },
    { label: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
    { label: 'Board', path: '/board', icon: '📌' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
  // HOD — same tenant-scoped items as College Admin, plus a read-only
  // Test Monitoring surface (department-wide) that College Admin doesn't
  // get. Kept as its own explicit array (rather than an alias onto
  // college_admin) precisely because the two are no longer identical.
  hod: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '🏠' },
    { label: 'People', path: '/people', icon: '🧑‍🤝‍🧑' },
    { label: 'Events', path: '/events', icon: '📅' },
    { label: 'Clubs', path: '/clubs', icon: '🎭' },
    { label: 'Competition', path: '/competition', icon: '🥇' },
    { label: 'Notes', path: '/notes', icon: '📝' },
    { label: 'Attendance', path: '/attendance', icon: '✅' },
    { label: 'Tests', path: '/tests', icon: '🧪' },
    { label: 'Test Monitoring', path: '/test-monitoring', icon: '🎥' },
    { label: 'Messages', path: '/messages', icon: '💬' },
    { label: 'Placements', path: '/placements', icon: '💼' },
    { label: 'Leaderboard', path: '/leaderboard', icon: '🏆' },
    { label: 'Board', path: '/board', icon: '📌' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
  // AO (Administrative Officer / Fee Management) — deliberately minimal,
  // per the requirement that this role never gets access to marks, exams,
  // faculty confidential data, or any other academic module: just its own
  // Fee Management dashboard plus the account basics every role gets.
  ao: [
    { label: 'Fee Dashboard', path: '/ao/dashboard', icon: '💰' },
    { label: 'Notifications', path: '/notifications', icon: '🔔' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
  // Super Admin owns the platform, not a college — so its nav is
  // deliberately just the colleges/College-Admins dashboard plus the
  // account basics. It never gets People/Events/Clubs/Notes/Attendance/
  // Placements/Leaderboard/Board: those are all tenant-scoped to a single
  // college, which a Super Admin doesn't have. (Previously this role was
  // aliased straight to the College Admin nav, which linked to pages the
  // backend either blocked or returned empty for — that dead end is now
  // gone in favor of a real dashboard built for this role.)
  super_admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '🏠' },
    { label: 'Course Access', path: '/super/course-access', icon: '🎓' },
    { label: 'Payment Settings', path: '/super/payment-settings', icon: '💳' },
    { label: 'Payment Verification', path: '/super/payment-verification', icon: '🧾' },
    { label: 'Profile', path: '/profile', icon: '👤' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ],
};

// hod still has no dashboard *page* of its own — /admin/dashboard branches
// internally by role (see AdminDashboard.jsx), so both hod and
// college_admin link to the same path above. This alias is now empty
// (hod has its own NAV_CONFIG entry, above) but kept as the documented
// extension point for any future role that genuinely wants to borrow
// another role's nav wholesale.
export const ROLE_DASHBOARD_ALIAS = {};

export function navItemsForRole(role) {
  const key = ROLE_DASHBOARD_ALIAS[role] || role;
  return NAV_CONFIG[key] || [];
}
