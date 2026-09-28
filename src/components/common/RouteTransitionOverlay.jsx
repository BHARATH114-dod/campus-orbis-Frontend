import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from './Logo';

// Long enough that the globe's spin is actually noticeable, short enough
// that it doesn't feel like it's blocking navigation.
const MIN_VISIBLE_MS = 550;

/**
 * Shows the centered, spinning-globe splash on first app load AND on every
 * route change afterwards (login, dashboards, everywhere) — held for a
 * minimum duration so the spin is actually visible regardless of how fast
 * the page underneath finishes loading.
 */
export default function RouteTransitionOverlay() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef(null);

  useEffect(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), MIN_VISIBLE_MS);
    return () => clearTimeout(hideTimer.current);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="campus-splash" role="status" aria-live="polite" aria-label="Loading page">
      <span className="campus-splash__inner">
        <Logo size={120} />
      </span>
    </div>
  );
}
