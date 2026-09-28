import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Global scroll-restoration handler, mounted once at the app root (see
 * App.jsx) alongside RouteTransitionOverlay.
 *
 * Fixes: clicking a footer link (Privacy Policy, Terms & Conditions, etc.)
 * navigated to the new route via React Router's client-side routing, but
 * the browser kept whatever scroll position the PREVIOUS page was at —
 * so a user who was scrolled down on the homepage landed on, say,
 * /legal/privacy already scrolled past its heading and had to manually
 * scroll up to see the content. Same issue for any other in-app link
 * (sidebar, "Assigned Students →", etc.) — it's a generic SPA gap, not
 * specific to the footer.
 *
 * Behavior:
 *  - PUSH/REPLACE navigation (a normal link click) with no hash: jump to
 *    the very top of the new page, so its heading/content is immediately
 *    visible without any manual scrolling.
 *  - PUSH/REPLACE navigation with a hash (e.g. "/#about" while already on
 *    "/"): scroll the matching element into view instead of the page top.
 *  - POP navigation (browser Back/Forward): deliberately left alone.
 *    Modern browsers already restore each history entry's own scroll
 *    position automatically (history.scrollRestoration defaults to
 *    'auto' and tracks pushState entries too) — re-forcing a scroll here
 *    would fight that and make Back/Forward feel broken instead of fixing
 *    anything.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType(); // 'PUSH' | 'REPLACE' | 'POP'

  useEffect(() => {
    if (navigationType === 'POP') return;

    if (hash) {
      // Wait a frame so the destination page has actually rendered before
      // we try to measure/find the target element.
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          window.scrollTo(0, 0);
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}
