const LABELS = {
  student: 'Student',
  faculty: 'Faculty',
  hod: 'HOD',
  college_admin: 'College Admin',
  super_admin: 'Super Admin',
  ao: 'AO (Fee Management)',
};

export function roleLabel(role) {
  return LABELS[role] || role;
}

// Where "Login" should send each role after a successful sign-in.
const DASHBOARD_PATHS = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  hod: '/admin/dashboard',
  college_admin: '/admin/dashboard',
  super_admin: '/admin/dashboard',
  ao: '/ao/dashboard',
};

export function dashboardPathForRole(role) {
  return DASHBOARD_PATHS[role] || '/';
}
