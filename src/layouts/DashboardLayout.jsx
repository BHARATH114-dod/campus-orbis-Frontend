import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import NotificationBell from '../components/common/NotificationBell';
import GlobalSearchBar from '../components/common/GlobalSearchBar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { roleLabel } from '../utils/roleLabels';

// Global Search (item 16) is only meaningful for roles that manage other
// people — students only ever see their own data, so they get no search
// bar here at all (matches the backend, which 403s /api/search for them).
// super_admin's destination is the shared admin dashboard, which renders
// SuperAdminDashboard for that role — the actual colleges list/management
// screen (confirmed in AdminDashboard.jsx's role switch) — so a college
// search result has a real place to land, same as every other role here.
const SEARCH_DESTINATION = { faculty: '/faculty/students', hod: '/people', college_admin: '/people', super_admin: '/admin/dashboard' };

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const canSearch = !!SEARCH_DESTINATION[role];

  // Clicking a search result just takes the person to the screen where
  // that record actually lives and manages itself — search is a finder,
  // not a second place to edit things.
  const handleSearchSelect = () => { if (SEARCH_DESTINATION[role]) navigate(SEARCH_DESTINATION[role]); };

  // UPDATED (mobile polish): lock background scroll while the drawer is
  // open, so the page behind it doesn't scroll along with it — standard
  // native-app drawer behavior.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* min-w-0 is load-bearing: without it, a flex item defaults to
          min-width:auto and refuses to shrink below its content's
          intrinsic width. Any wide/unwrapped element anywhere inside
          <Outlet/> on ANY page would then push this whole column wider
          than the viewport, forcing horizontal scroll on the entire
          layout — sidebar included — on narrow screens. This one line is
          the project-wide safety net behind the per-page overflow-x-auto
          fixes on individual tables/modals. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar — hamburger opens the drawer, hidden on desktop since the sidebar is always visible there */}
        <div className="flex items-center gap-3 border-b border-line bg-paper-card px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="icon-btn-glass grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {user?.name} · {roleLabel(role)}
          </div>
          <NotificationBell />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="icon-btn-glass grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="icon-btn-glass rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink"
          >
            Log out
          </button>
        </div>

        {/* Desktop top bar — UPDATED (Module 2 fix): this didn't exist before, which meant
            there was no way to reach theme toggle / notifications / logout on desktop at
            all (they only lived in the md:hidden mobile bar above). */}
        <div className="hidden items-center justify-between gap-3 border-b border-line bg-paper-card px-8 py-3 md:flex">
          {canSearch ? <GlobalSearchBar onSelect={handleSearchSelect} /> : <div />}
          <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="icon-btn-glass grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link
            to="/profile"
            className="icon-btn-glass flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-purple/[0.08]"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-purple text-[11px] font-bold text-white">
              {(user?.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            {user?.name}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="icon-btn-glass rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-purple/[0.08]"
          >
            Log out
          </button>
          </div>
        </div>

        {canSearch && (
          <div className="border-b border-line bg-paper-card px-4 py-2.5 md:hidden">
            <GlobalSearchBar onSelect={handleSearchSelect} />
          </div>
        )}

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
