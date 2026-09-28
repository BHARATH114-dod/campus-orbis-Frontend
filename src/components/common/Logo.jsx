/**
 * Campus Orbis logo. Renders the static mark (cap + orbit ring) with the
 * globe layered on top at the same spot, spinning in place forever — used
 * everywhere the logo appears (navbar, sidebar, footer, hero) and, larger,
 * on the full-page splash shown on first load and while switching between
 * pages/dashboards (see LoadingSpinner's fullPage mode).
 *
 * `size` sets the rendered width in px; height follows automatically from
 * the logo's natural aspect ratio, so the globe overlay (positioned by %)
 * always lines up with the globe baked into the base image.
 *
 * @param {{ size?: number, className?: string, spin?: boolean }} props
 */
export default function Logo({ size = 40, className = '', spin = true }) {
  return (
    <span
      className={`campus-logo ${className}`}
      style={{ width: size }}
    >
      <img src="/logo.png" alt="Campus Orbis logo" className="campus-logo__base" draggable="false" />
      <span className="campus-logo__globe-slot" aria-hidden="true">
        <img
          src="/logo-globe.png"
          alt=""
          className={`campus-logo__globe ${spin ? 'campus-logo__globe--spin' : ''}`}
          draggable="false"
        />
      </span>
    </span>
  );
}
