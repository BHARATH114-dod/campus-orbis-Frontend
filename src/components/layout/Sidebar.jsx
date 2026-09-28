import { NavLink } from 'react-router-dom';
import { navItemsForRole } from '../../utils/navConfig';
import { roleLabel } from '../../utils/roleLabels';
import Logo from '../common/Logo';

/**
 * @param {{ role: string, open: boolean, onClose: () => void }} props
 * `open`/`onClose` only matter below the md breakpoint — on desktop the
 * sidebar is always visible via the md:translate-x-0 override.
 *
 * UPDATED (fix: sidebar not filling to the bottom on scroll): the outer
 * <aside> now stretches to match the full page height on desktop (default
 * flexbox stretch, no fixed height forced on it) so its background never
 * runs out partway down a tall page. The nav content itself lives in
 * an inner wrapper that's `sticky` within that tall background, so the
 * links stay reachable near the top of the viewport as you scroll, while
 * the background behind them fills the whole page.
 *
 * UPDATED (theme): light glassmorphism panel instead of a solid dark
 * surface — frosted white/lavender tint, soft shadow, navy text, and a
 * blue-to-purple glow on the active nav item.
 */
export default function Sidebar({ role, open, onClose }) {
  const items = navItemsForRole(role);

  return (
    <>
      {/* backdrop — mobile only, closes the drawer on tap */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`sidebar-glass fixed left-0 top-0 z-[200] h-screen w-[82%] max-w-[280px]
          transition-transform duration-300 ease-out
          md:static md:z-0 md:h-auto md:min-h-full md:w-[230px] md:max-w-none md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col p-5 md:sticky md:top-0 md:h-screen">
          <div className="mb-6 flex items-center gap-2 border-b border-line pb-4">
            <Logo size={32} />
            <h1 className="flex-1 text-lg font-bold text-ink">Campus Orbis</h1>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink md:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'sidebar-nav-active' : 'text-ink-light hover:bg-purple/[0.08]'
                  }`
                }
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-line pt-4 text-xs text-ink-light">
            Signed in as {roleLabel(role)}
          </div>
        </div>
      </aside>
    </>
  );
}
