import { useEffect, useRef, useState } from 'react';

/**
 * Animates counting up from 0 to `value` whenever `value` changes (so if a
 * later fetch/poll reports a higher number, it visibly counts up again
 * rather than just snapping to the new figure).
 * @param {{ value: number | null, duration?: number, suffix?: string }} props
 */
export default function CountUp({ value, duration = 1200, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (value === null || value === undefined) return;
    const start = performance.now();
    const from = display; // count up from wherever it currently is, not always 0
    const to = value;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress); // ease-out
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  if (value === null || value === undefined) return <>—</>;
  return <>{display.toLocaleString()}{suffix}</>;
}
