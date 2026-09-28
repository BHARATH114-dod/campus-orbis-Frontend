import Logo from './Logo';

/**
 * Reusable loading spinner. fullPage is used for first load (session check)
 * and whenever a page/dashboard is switching in — it shows just the logo,
 * centered, with the globe spinning, per the brand splash treatment.
 * @param {{ size?: 'sm'|'md'|'lg', fullPage?: boolean, label?: string }} props
 */
export default function LoadingSpinner({ size = 'md', fullPage = false, label = 'Loading…' }) {
  if (fullPage) {
    return (
      <div className="campus-splash" role="status" aria-live="polite" aria-label={label}>
        <span className="campus-splash__inner">
          <Logo size={120} />
        </span>
      </div>
    );
  }

  const dims = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-12 h-12 border-4' }[size];

  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div
        className={`${dims} rounded-full border-teal border-t-transparent animate-spin`}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-ink-light">{label}</span>}
    </div>
  );
}
