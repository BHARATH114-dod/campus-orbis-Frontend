# Campus Orbis — React Frontend (Module 1: Foundation)

This is a from-scratch React (Vite) rebuild of the Campus Orbis frontend. It
talks to your **existing, unmodified Express backend** (`server.js`) —
nothing on the backend changed.

## Setup

```bash
npm install          # not run yet in this environment — no network access here
npm run dev           # starts Vite on http://localhost:5173
```

In a separate terminal, your existing Express server needs to be running too:

```bash
cd ../campus-orbis-backend        # your existing Express project
npm start               # http://localhost:3000
```

Vite's dev server proxies `/api/*` to `http://localhost:3000` (see
`vite.config.js`), so the browser sees everything as same-origin — your
existing session cookie just works, no CORS setup needed.

## Why cookie-session auth, not JWT/Firebase

Your backend (`server.js`) authenticates with an httpOnly session cookie set
by `POST /api/auth/login` — there's no JWT or Firebase there today. Rebuilding
that auth system was out of scope for a *frontend* migration: it would mean
re-deriving every role-permission check already built and tested in
`server.js` (the Super Admin → College Admin → HOD → Faculty → Student
hierarchy, college data isolation, etc.), which is a backend project of its
own, not a byproduct of a UI rewrite.

So this app calls your real, working backend as-is. Every request goes
through the one Axios instance in `src/services/api.js`
(`withCredentials: true`), which is deliberately the **only** place that
knows how auth is transported — there's a commented-out `Authorization:
Bearer` interceptor sitting right there, ready to switch on later if the
backend ever grows real token auth. No page or component would need to
change.

**Update:** Firebase *is* now part of this project — see the next section
below and `PUSH_NOTIFICATIONS_SETUP.md` — but only for Cloud Messaging
(push notifications), not authentication. The reasoning above still holds:
login/session handling is still your original cookie-based `server.js`
code, completely untouched by this.

## Push notifications (Firebase Cloud Messaging)

New announcements now trigger a real device push notification, scoped to
the same audience the announcement already targets (college-wide/department/
section), sent to students specifically. Full setup instructions — where
to get Firebase credentials, exactly which files to edit — are in
[`PUSH_NOTIFICATIONS_SETUP.md`](./PUSH_NOTIFICATIONS_SETUP.md) in this
folder. Skippable: the app runs completely normally without doing this setup.

## ⚠️ Backend gap found: Placements

`server.js` has no `/api/placements/*` routes at all — this wasn't
something I removed, it never existed. `src/pages/Placements.jsx` says so
plainly instead of quietly shipping a page that calls endpoints that 404.
Let me know how you want to scope it (new backend routes needed first).

## Folder structure

```
src/
  components/       Reusable, presentational — no page owns these
    common/           LoadingSpinner, Modal, ToastContainer, ComingSoon, BackgroundLayer
    layout/           Navbar, Sidebar, Footer
    EventCard.jsx, NoticeCard.jsx, LeaderboardCard.jsx, ProfileCard.jsx, HeroSection.jsx
  pages/            One file per route (15, per the brief)
  layouts/          PublicLayout (Navbar+Footer), DashboardLayout (Sidebar+content)
  context/          AuthContext, ThemeContext, ToastContext
  hooks/            (reserved — useAuth/useToast currently live as named
                     exports from their context files; split out here if a
                     hook grows real logic beyond "read the context")
  services/         api.js (Axios instance), authService.js
  routes/           AppRoutes.jsx (route table), ProtectedRoute.jsx (auth/role guard)
  utils/            navConfig.js (sidebar items per role), roleLabels.js
  styles/           index.css (Tailwind + brand CSS variables + ambient background)
  assets/           (reserved — logo/hero-bg currently live in /public since
                     they're referenced by raw URL, e.g. CSS background-image)
```

## ⚠️ First backend change in this project

Everything up to this point ran on your unmodified `server.js`. This
feature genuinely couldn't — your backend had no concept of subjects or
timetables, and attendance was just `section_id + date + hour` with no
subject attached. Full list of backend changes, all additive (nothing
existing was removed or renamed):

**3 new collections:** `Subjects`, `Timetable`, `Semesters` (all HOD-managed, scoped to their own department).

**New endpoints:**
- `GET/POST /api/hod/semesters`, `DELETE /api/hod/semesters/:id`
- `GET/POST /api/hod/subjects`, `DELETE /api/hod/subjects/:id`
- `GET/POST /api/hod/timetable/:sectionId` (POST is on `/api/hod/timetable`, upserts one weekly cell), `DELETE /api/hod/timetable/:id`
- `GET /api/faculty/timetable?date=` — a faculty member's exact scheduled slots for that day, each flagged `already_taken`
- `GET/POST/GET.csv /api/hod/attendance/report[.csv]`, `POST /api/hod/attendance/alert-low`
- Same three, college-wide, under `/api/college/attendance/...` (College Admin)

**Changed endpoints (backward-compatible additions, not breaking changes):**
- `POST /api/faculty/attendance` now requires `subject_id`, and **validates the submission against the timetable** — 403 if the faculty member isn't scheduled to teach that section at that hour that day, 400 if the subject doesn't match. This is the actual mechanism behind "faculty can only take attendance according to the timetable."
- `GET /api/student/attendance` now returns `by_subject` (per-subject percentage) and accepts `?semester_id=` to filter by an HOD-defined semester.

**Known limitation, stated plainly:** attendance records created *before* this change have no `subject_id`/`semester_id` — there's no migration step, they just won't appear in subject-wise or semester-filtered views. Given this project has no real production data yet, I didn't build a backfill; say so if that's wrong and I'll add one.

## ⚠️ Second backend change: Placements

**3 new collections:** `PlacementDrives`, `PlacementApplications`.

**New endpoints:**
- `GET /api/placements` (all roles), `POST/PATCH/DELETE /api/placements/:id` (College Admin only)
- `POST/DELETE /api/placements/:id/apply` (student apply/withdraw)
- `GET /api/placements/my` (student's own application history)
- `GET /api/placements/:id/applications` (College Admin sees all; HOD sees their department only — enforced server-side, not a UI filter)
- `PATCH /api/placements/applications/:id` (College Admin sets applied/shortlisted/selected/rejected — fires a real in-app notification to the student via the existing Notifications system)
- `GET/GET.csv /api/hod/placements/report`, `GET/GET.csv /api/college/placements/report[.csv]`

**Design calls made, stated plainly:** drives are College Admin-only to create (placement drives are normally run by one centralized T&P cell, not per-department) and eligibility is department-only — there's no CGPA field anywhere in this app's user model, so a CGPA cutoff isn't something this can honestly enforce. Package info is a free-text field (e.g. "6-10 LPA"), not a number, so there's no "average package" statistic — averaging free text isn't meaningful.

## Also added: Tests and Public Board (existing backend features, no frontend before now)

These weren't in the original 15-page spec, but the backend already had
full, working implementations — building UI for them was a frontend-only
task, zero new backend code:

- **Tests** (`/tests`, Faculty + Student only — no HOD/College Admin surface
  exists on the backend, tests are owned solely by their creating faculty
  member) — Faculty write MCQ and/or theory questions, assign to a section,
  grade theory answers, export results as CSV. Students get a genuine
  **full-page, fullscreen-locked timed attempt** — same mechanism the
  original vanilla-JS app used: the real browser Fullscreen API, a
  countdown timer, and an automatic force-submit the instant the student
  leaves fullscreen for any reason, flagged on the result (`⚠ exited
  fullscreen`). Stated in the UI itself: this is a deterrent, not a
  proctoring tool.
- **Public Board** (`/board`, all four roles) — complaints, opinions, and
  lost & found posts with replies. Composing is restricted to
  hod/faculty/student, **not** College Admin — this isn't a UI choice, it's
  mirroring `requireRole('hod','faculty','student')` on the backend's own
  `POST /api/posts` exactly; College Admin can still moderate (resolve/
  delete any post or reply) but never compose one, same as the server
  enforces.

## What's real vs. placeholder right now

**Everything from the original 15-page spec is now real — nothing left as
a placeholder.** Plus two backend-existing features (Tests, Public Board)
that had no frontend before this pass. Full list: Home, Login, 404, the
full nav/auth/layout shell, Profile, Notifications, Settings, Events,
Clubs, Notes, the timetable-driven Attendance overhaul, Leaderboard,
Placements, Tests, Board, and Student/Faculty/Admin Dashboards.

- **College Admin Dashboard** (`/admin/dashboard`) — college name, stat
  cards (students/HODs/events/open board posts), a department-participation
  bar chart, and the HOD roster. From `GET /api/college/analytics` +
  `/api/college/hods`, both pre-existing.
- **HOD Dashboard** (same route, branches by role) — stat cards
  (students/sections/faculty/avg. attendance), three bar charts: students
  by section, attendance % by section, avg. marks by section. From
  `GET /api/hod/analytics`, also pre-existing.
- **Student Dashboard** (`/student/dashboard`) — attendance %, leaderboard
  rank, bookmarked notes, upcoming events as stat cards, plus the actual
  lists. Built entirely from services already written in earlier modules.
- New shared `<BarList>` component for the analytics rows — plain CSS
  bars, no charting library.
- `super_admin` hits `/admin/dashboard` too (per the route's
  `allowedRoles`) but gets an honest "not built yet" message — the Super
  Admin platform-level dashboard (colleges, network-wide stats) is a
  different surface, out of scope here.

## People management — Sections / Faculty / Students / HODs (`/people`)

Replicates the original vanilla-JS app's management screens, role-branched
to match the hierarchy exactly (not just copied as-is):

- **HOD** (`/people`) — full create/remove for Sections, Faculty, and
  Students within their own department. Assigning a faculty in-charge to a
  section is a live dropdown, same as the original.
- **College Admin** (`/people`) — **4 tabs now.** HODs is fully CRUD-
  enabled (College Admin adds/removes HODs directly — this already existed
  on the backend, `/people` just needed the UI for it). Sections/Faculty/
  Students stay **read-only and college-wide** (every department at once,
  with a department filter) — creating those stays HOD's job within their
  own department, on purpose. Required 2 new backend routes
  (`GET /api/college/faculty`, `GET /api/college/students` — both
  read-only) since nothing college-wide existed for this before.
- **Faculty Dashboard** — gained **both** add and remove for students,
  scoped narrower than HOD's version on purpose: a faculty member can only
  add/remove a student in one of their *own* assigned sections, enforced
  server-side (403 otherwise) — not just hidden in the UI. Two backend
  routes: `POST /api/faculty/students` (add) and
  `DELETE /api/faculty/students/:id` (remove), both with the same
  section-ownership check. The add-student form/modal is shared with the
  HOD's Students tab (`AddStudentModal`, exported from
  `components/people/HodPeople.jsx`) — same UI, different backend call
  depending on who's using it.

## Roadmap — what's left

Everything originally scoped is done. What remains is genuinely optional,
not "unfinished":

- **Polish pass** — dark-mode audit across every page, form validation
  sweep, error boundaries, loading-state consistency, and (now standard
  practice after finding two real gaps this way) a nav-vs-routes audit
  before calling any module done, not after a screenshot catches it
- **Super Admin platform dashboard** — a genuinely different surface
  (colleges, network-wide stats), never in scope until now
- **CGPA-based placement eligibility** — would need a CGPA field added to
  the student user model first (a real backend/data-model decision, not
  a quick add)

## A note on testing

I don't have network access in this environment, so `npm install` hasn't
been run and I can't launch a real browser here. What I *did* verify:
every `.jsx`/`.js` file parses correctly (81 files now) and the full
import graph resolves with no missing files (checked with `esbuild`, not
guessed), and the backend has zero duplicate route registrations. Please
run `npm install && npm run dev` locally as the real test — and let me
know what you see.
