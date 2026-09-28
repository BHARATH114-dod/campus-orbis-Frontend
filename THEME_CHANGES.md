# Campus Orbis — White Glassmorphism Theme

Files changed (all inside `campus-orbis-react-frontend/`):

1. **`src/styles/index.css`** — the main change.
   - New light-theme CSS variables: off-white `--paper`, translucent
     `--paper-card`, dark-navy `--ink`, blue/lavender `--line`, and `--purple`
     remapped from its old green to a royal-blue/indigo (it's the app's
     brand-accent variable — used for buttons, avatars, active states).
   - `--teal` / `--gold` / `--crimson` were **left untouched** — they carry
     semantic meaning (success / warning / danger) in ~300 places, so
     recoloring them risked breaking status meaning across the app.
   - `.bg-paper-card` (the one card class already used by 48+ components)
     now gets `backdrop-filter: blur()`, a soft shadow, and the translucent
     fill — so every dashboard/course/test/notice/modal card becomes frosted
     glass automatically, with no per-component edits needed.
   - New `.bg-logo-watermark`, `.bg-orbit-ring`, updated `.bg-glow` /
     `.sprinkle` rules — the soft blue/lavender ambient background, big
     faded logo watermark, and slow orbit rings described in the brief.
   - New `.sidebar-glass` / `.sidebar-nav-active` / `.icon-btn-glass` for the
     sidebar and header icon buttons.
   - Globe rotation, reduced-motion handling, and the splash screen were
     already implemented in the original file and are unchanged.

2. **`src/components/common/BackgroundLayer.jsx`** — now also renders the
   large Campus Orbis logo (globe still spinning) as a background watermark,
   plus two slow-drifting orbit rings, alongside the existing ambient glow
   and sprinkles. Everything is `aria-hidden` + `pointer-events: none`.

3. **`src/components/layout/Sidebar.jsx`** — rewritten from a solid dark
   panel (`bg-surface-dark text-white`) to a light glass panel
   (`.sidebar-glass`), with navy text and a blue→purple glow on the active
   nav item.

4. **`src/layouts/DashboardLayout.jsx`** and
   **`src/components/common/NotificationBell.jsx`** — header icon buttons
   (menu, theme toggle, notifications, logout, profile) now use the
   `.icon-btn-glass` class so the header reads as one consistent glass
   system.

Nothing else was touched — no routes, auth, roles, APIs, compiler,
coding-practice, camera/recording, or business logic changed. This is a
CSS/theme-layer change only, riding on the app's existing design-token
system (`--paper-card`, `--line`, `--ink`, etc.) which is why it only took
a handful of files to redo the whole app's look.

To apply: copy this `campus-orbis-react-frontend` folder over your existing
one (or just copy the 4 changed files listed above), then `npm run dev` /
`npm run build` as usual — no new dependencies were added.
