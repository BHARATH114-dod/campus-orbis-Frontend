import { useMemo } from 'react';
import Logo from './Logo';

const SPRINKLE_COUNT = 20;

/**
 * Site-wide ambient background: corner glow, a large faded Campus Orbis
 * logo watermark (globe still spinning inside it), two slow orbit rings,
 * and slow-drifting sprinkles. Rendered once near the root of the app (see
 * App.jsx) so it sits behind every route without each page needing to
 * think about it.
 *
 * Everything here is `aria-hidden` and `pointer-events: none` — purely
 * decorative, never intercepts clicks/scrolling/text selection.
 */
export default function BackgroundLayer() {
  const sprinkles = useMemo(
    () =>
      Array.from({ length: SPRINKLE_COUNT }, () => ({
        left: (Math.random() * 95 + 2).toFixed(1),
        size: [6, 7, 8, 8, 9, 10, 10, 11, 12, 13][Math.floor(Math.random() * 10)],
        duration: (Math.random() * 11 + 15).toFixed(1),
        delay: -(Math.random() * 20).toFixed(1),
      })),
    []
  );

  return (
    <>
      <div className="bg-glow" aria-hidden="true" />

      <div className="bg-orbit-ring bg-orbit-ring--outer" aria-hidden="true" />
      <div className="bg-orbit-ring bg-orbit-ring--inner" aria-hidden="true" />

      <div className="bg-logo-watermark" aria-hidden="true">
        <Logo size={640} spin />
      </div>

      <div className="bg-sprinkles" aria-hidden="true">
        {sprinkles.map((s, i) => (
          <span
            key={i}
            className="sprinkle"
            style={{
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
