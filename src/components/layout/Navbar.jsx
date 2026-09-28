import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Logo from '../common/Logo';

const NAV_LINKS = [
  { href: '/#home', label: 'Home' },
  { href: '/#about', label: 'About' },
  { href: '/#features', label: 'Features' },
  { href: '/#events', label: 'Events' },
  { href: '/#contact', label: 'Contact' },
];

/**
 * Public-site navbar (Home / 404 / etc). For the authenticated dashboard
 * shell, see DashboardLayout, which uses its own compact top bar + Sidebar
 * hamburger instead of this one.
 *
 * UPDATED (mobile fix): this previously had no nav links at all — Module 1
 * only ported the theme toggle and Login button, not the actual Home/About/
 * Features/Events/Contact links the original site's nav had. That also
 * meant there was nothing to collapse into a mobile menu. Both are restored
 * here, with a proper hamburger toggle on mobile.
 */
export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-purple text-white">
      {/*
        Header alignment: the logo/name sits at the far LEFT edge of the
        viewport and Login + dark-mode toggle sit at the far RIGHT edge,
        with just consistent edge padding (px-4/6/8 by breakpoint) — not
        centered inside a max-width column, so there's no leftover gap
        between the logo and the actual left corner of the page on wide
        screens. `justify-between` plus `shrink-0` on both end groups
        keeps this true at every viewport size without overlap.
      */}
      <nav className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-bold text-lg">
          <Logo size={32} />
          <span className="truncate">Campus Orbis</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden min-w-0 items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-white/85 hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/30 hover:bg-white/10"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {isAuthenticated ? (
            <>
              <span className="hidden sm:inline text-sm text-white/85">Hi, {user.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 sm:inline-block"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-full bg-gold px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:inline-block"
            >
              Login
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/30 md:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-purple px-4 py-4 sm:px-6 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-white/90 hover:text-white">
                {l.label}
              </a>
            ))}
            <div className="mt-2 border-t border-white/10 pt-3">
              {isAuthenticated ? (
                <button type="button" onClick={handleLogout} className="w-full rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
                  Log out
                </button>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full rounded-full bg-gold px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90">
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
