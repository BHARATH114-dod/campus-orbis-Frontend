import { Link } from 'react-router-dom';

/**
 * Shared wrapper for every Legal & Policies page. Keeps typography, spacing
 * and the "back to site" navigation consistent across all of them, and mobile
 * responsive via a single centered, comfortably-narrow column.
 */
export default function PolicyLayout({ title, lastUpdated, children }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
      <Link to="/" className="text-sm font-semibold text-teal hover:underline">
        ← Back to {`Campus Orbis`}
      </Link>

      <h1 className="mt-5 text-3xl font-extrabold text-ink sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-light">Last updated: {lastUpdated}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink-light">{children}</div>

      <Link
        to="/"
        className="mt-12 inline-block rounded-full bg-hero-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to Home
      </Link>
    </div>
  );
}

/** One labeled block within a policy page (renders as an h2 + body). */
export function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink sm:text-xl">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

/** Simple bullet list with consistent spacing/markers. */
export function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
