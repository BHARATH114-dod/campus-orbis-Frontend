import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';

import Home from '../pages/Home';
import Login from '../pages/Login';
import NotFound from '../pages/NotFound';
import StudentDashboard from '../pages/StudentDashboard';
import FacultyDashboard from '../pages/FacultyDashboard';
import FacultyStudents from '../pages/FacultyStudents';
import FacultyStudentFees from '../pages/FacultyStudentFees';
import FacultyTimetable from '../pages/FacultyTimetable';
import StudentTimetable from '../pages/StudentTimetable';
import AdminDashboard from '../pages/AdminDashboard';
import AODashboard from '../pages/AODashboard';
import Events from '../pages/Events';
import Clubs from '../pages/Clubs';
import Competition from '../pages/Competition';
import Notes from '../pages/Notes';
import Attendance from '../pages/Attendance';
import Placements from '../pages/Placements';
import People from '../pages/People';
import Leaderboard from '../pages/Leaderboard';
import Tests from '../pages/Tests';
import TestMonitoring from '../pages/TestMonitoring';
import Messages from '../pages/Messages';
import CollegeAdminSubjects from '../pages/CollegeAdminSubjects';
import Board from '../pages/Board';
import Courses from '../pages/Courses';
import CourseDashboard from '../pages/CourseDashboard';
import CourseLesson from '../pages/CourseLesson';
import CourseLessonTest from '../pages/CourseLessonTest';
import CourseFacultyStudents from '../pages/CourseFacultyStudents';
import Practice from '../pages/Practice';
import SuperCourseAccess from '../pages/SuperCourseAccess';
import SuperPaymentSettings from '../pages/SuperPaymentSettings';
import SuperPaymentVerification from '../pages/SuperPaymentVerification';
import CollegeRequestCourse from '../pages/CollegeRequestCourse';
import Profile from '../pages/Profile';
import Notifications from '../pages/Notifications';
import Settings from '../pages/Settings';

import TermsAndConditions from '../pages/legal/TermsAndConditions';
import PrivacyPolicy from '../pages/legal/PrivacyPolicy';
import CookiePolicy from '../pages/legal/CookiePolicy';
import CopyrightPolicy from '../pages/legal/CopyrightPolicy';
import Disclaimer from '../pages/legal/Disclaimer';
import ContactSupport from '../pages/legal/ContactSupport';
import CommunityGuidelines from '../pages/legal/CommunityGuidelines';
import AccessibilityStatement from '../pages/legal/AccessibilityStatement';
import SecurityInformation from '../pages/legal/SecurityInformation';

export default function AppRoutes() {
  return (
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
  );
}
