import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import LoadingSpinner from '../components/common/LoadingSpinner';

import Home from '../pages/Home';
import Login from '../pages/Login';
import NotFound from '../pages/NotFound';

const StudentDashboard = lazy(() => import('../pages/StudentDashboard'));
const FacultyDashboard = lazy(() => import('../pages/FacultyDashboard'));
const FacultyStudents = lazy(() => import('../pages/FacultyStudents'));
const FacultyStudentFees = lazy(() => import('../pages/FacultyStudentFees'));
const FacultyTimetable = lazy(() => import('../pages/FacultyTimetable'));
const StudentTimetable = lazy(() => import('../pages/StudentTimetable'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const AODashboard = lazy(() => import('../pages/AODashboard'));
const Events = lazy(() => import('../pages/Events'));
const Clubs = lazy(() => import('../pages/Clubs'));
const Competition = lazy(() => import('../pages/Competition'));
const Notes = lazy(() => import('../pages/Notes'));
const Attendance = lazy(() => import('../pages/Attendance'));
const Placements = lazy(() => import('../pages/Placements'));
const People = lazy(() => import('../pages/People'));
const Leaderboard = lazy(() => import('../pages/Leaderboard'));
const Tests = lazy(() => import('../pages/Tests'));
const TestMonitoring = lazy(() => import('../pages/TestMonitoring'));
const Messages = lazy(() => import('../pages/Messages'));
const CollegeAdminSubjects = lazy(() => import('../pages/CollegeAdminSubjects'));
const Board = lazy(() => import('../pages/Board'));
const Courses = lazy(() => import('../pages/Courses'));
const CourseDashboard = lazy(() => import('../pages/CourseDashboard'));
const CourseLesson = lazy(() => import('../pages/CourseLesson'));
const CourseLessonTest = lazy(() => import('../pages/CourseLessonTest'));
const CourseFacultyStudents = lazy(() => import('../pages/CourseFacultyStudents'));
const Practice = lazy(() => import('../pages/Practice'));
const SuperCourseAccess = lazy(() => import('../pages/SuperCourseAccess'));
const SuperPaymentSettings = lazy(() => import('../pages/SuperPaymentSettings'));
const SuperPaymentVerification = lazy(() => import('../pages/SuperPaymentVerification'));
const CollegeRequestCourse = lazy(() => import('../pages/CollegeRequestCourse'));
const Profile = lazy(() => import('../pages/Profile'));
const Notifications = lazy(() => import('../pages/Notifications'));
const Settings = lazy(() => import('../pages/Settings'));

const TermsAndConditions = lazy(() => import('../pages/legal/TermsAndConditions'));
const PrivacyPolicy = lazy(() => import('../pages/legal/PrivacyPolicy'));
const CookiePolicy = lazy(() => import('../pages/legal/CookiePolicy'));
const CopyrightPolicy = lazy(() => import('../pages/legal/CopyrightPolicy'));
const Disclaimer = lazy(() => import('../pages/legal/Disclaimer'));
const ContactSupport = lazy(() => import('../pages/legal/ContactSupport'));
const CommunityGuidelines = lazy(() => import('../pages/legal/CommunityGuidelines'));
const AccessibilityStatement = lazy(() => import('../pages/legal/AccessibilityStatement'));
const SecurityInformation = lazy(() => import('../pages/legal/SecurityInformation'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage label="Loading…" />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />

        {/* Legal & Policies — public so they're readable without logging in,
            and linked from the footer on every page that uses it. */}
        <Route path="/legal/terms" element={<TermsAndConditions />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/cookies" element={<CookiePolicy />} />
        <Route path="/legal/copyright" element={<CopyrightPolicy />} />
        <Route path="/legal/disclaimer" element={<Disclaimer />} />
        <Route path="/legal/contact" element={<ContactSupport />} />
        <Route path="/legal/community-guidelines" element={<CommunityGuidelines />} />
        <Route path="/legal/accessibility" element={<AccessibilityStatement />} />
        <Route path="/legal/security" element={<SecurityInformation />} />
      </Route>

      {/* Login is deliberately standalone — no Navbar/Footer. The page
          itself has its own "Go to Home" link since there's no header to
          provide that navigation here. */}
      <Route path="/login" element={<Login />} />

      {/* Authenticated — tenant-scoped pages, every role except Super
          Admin. Super Admin has no college of its own, and the backend
          either blocks these outright or hands back empty data for that
          role (e.g. clubs/board/leaderboard all short-circuit to nothing
          for super_admin) — excluding it here turns that dead end into a
          clean redirect instead of a page that loads to show nothing. */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'college_admin', 'hod']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/events" element={<Events />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/competition" element={<Competition />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/placements" element={<Placements />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/board" element={<Board />} />
      </Route>

      {/* Authenticated — account pages, any role including Super Admin */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Authenticated — role-restricted dashboards */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
      </Route>

      <Route
        path="/faculty/dashboard"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FacultyDashboard />} />
      </Route>

      <Route
        path="/faculty/students"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FacultyStudents />} />
      </Route>

      {/* item 16: Faculty fee details, view-only, scoped to their own
          assigned sections (see /api/faculty/students/fees). */}
      <Route
        path="/faculty/fees"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FacultyStudentFees />} />
      </Route>

      {/* items 12/13: Faculty's read-only, full-section timetable with
          their own hours highlighted. */}
      <Route
        path="/faculty/timetable"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FacultyTimetable />} />
      </Route>

      {/* item 14: a student's own exact section timetable, read-only. */}
      <Route
        path="/student/timetable"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentTimetable />} />
      </Route>

      {/* Test Monitoring — faculty (their own tests) and HOD (read-only,
          department-wide). College Admin still has no tests of their own
          (see Tests.jsx / navConfig.js) so it's excluded here exactly as
          before; the read-only vs. full-control split between hod and
          faculty is enforced inside TestMonitoring.jsx/the page's child
          components and on the backend, not by this route guard. */}
      <Route
        path="/test-monitoring"
        element={
          <ProtectedRoute allowedRoles={['faculty', 'hod']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TestMonitoring />} />
      </Route>

      {/* Staff Messaging (items 3/4) — HOD<->HOD and HOD<->Faculty. Not
          available to students, college_admin, or any other role: the
          backend's requireRole('hod','faculty') on every /api/messaging
          route enforces this too, this is just the matching route guard. */}
      <Route
        path="/messages"
        element={
          <ProtectedRoute allowedRoles={['faculty', 'hod']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Messages />} />
      </Route>

      {/* College Admin's "Add Subject" surface — College Admin isn't
          scoped to a single department the way HOD is, so this manages
          subjects across every department, rather than the per-section
          Timetable editor HOD gets above. The backend
          (POST/GET/DELETE /api/hod/subjects) enforces hod/college_admin
          only regardless of this route guard. */}
      <Route
        path="/college/subjects"
        element={
          <ProtectedRoute allowedRoles={['college_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CollegeAdminSubjects />} />
      </Route>

      {/* Python Full Course page removed per spec ("Do not create another
          Python page anywhere" / merge all courses into one module) — the
          backend engine it used (/api/student/python-course/*) is untouched
          and is exactly what coursesData.js's `python` entry now reuses
          inside the unified /courses module, so no content or progress is
          lost. Old links redirect straight into the merged module. */}
      <Route path="/python-course/*" element={<Navigate to="/courses/python" replace />} />

      {/* Courses (multi-language) — student + faculty, per spec §2. Backend
          (/api/student/courses/*, /api/faculty/courses/*) enforces the
          semester lock and faculty-sees-all rule; this route just needs to
          admit both roles and let the page components branch by role. */}
      <Route
        path="/courses"
        element={
          <ProtectedRoute allowedRoles={['student', 'faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Courses />} />
        <Route path=":language" element={<CourseDashboard />} />
        <Route path=":language/lessons/:lessonId" element={<CourseLesson />} />
        <Route path=":language/lessons/:lessonId/test" element={<CourseLessonTest />} />
        <Route path=":language/students" element={<CourseFacultyStudents />} />
      </Route>

      {/* Practice — student + faculty, per spec §15. */}
      <Route
        path="/practice"
        element={
          <ProtectedRoute allowedRoles={['student', 'faculty']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Practice />} />
      </Route>

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['college_admin', 'hod', 'super_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
      </Route>

      {/* AO (Administrative Officer) — Fee Management, its own dashboard,
          not folded into /admin/dashboard: AO is a fee-records-only role
          with no academic/oversight surface, so it gets a dedicated route
          and page instead of another branch inside AdminDashboard.jsx. */}
      <Route
        path="/ao/dashboard"
        element={
          <ProtectedRoute allowedRoles={['ao']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AODashboard />} />
      </Route>

      {/* Super Admin — course access hierarchy + payments (spec §6/§8/§9). */}
      <Route
        path="/super/course-access"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperCourseAccess />} />
      </Route>
      <Route
        path="/super/payment-settings"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperPaymentSettings />} />
      </Route>
      <Route
        path="/super/payment-verification"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperPaymentVerification />} />
      </Route>

      {/* College Admin — request a course package (spec §7). */}
      <Route
        path="/college/request-course"
        element={
          <ProtectedRoute allowedRoles={['college_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CollegeRequestCourse />} />
      </Route>

      <Route
        path="/people"
        element={
          <ProtectedRoute allowedRoles={['college_admin', 'hod']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<People />} />
      </Route>

      {/* 404 — kept outside PublicLayout's Navbar/Footer wrapper on purpose,
          so it reads as a standalone error state rather than a normal page. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
  );
}
