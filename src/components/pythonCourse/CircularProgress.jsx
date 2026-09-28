/**
 * Circular progress ring. Pure SVG, no external chart lib — matches the
 * existing design system's colors via CSS vars (teal/line) rather than
 * hardcoded hex, same as every other component in this app.
 * @param {{ percentage: number, size?: number, strokeWidth?: number, label?: string, sublabel?: string }} props
 */
export default function CircularProgress({ percentage, size = 160, strokeWidth = 14, label, sublabel }) {
  const clamped = Math.max(0, Math.min(100, percentage || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--teal)" strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink">{clamped}%</span>
        {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">{label}</span>}
        {sublabel && <span className="mt-1 text-xs text-ink-light">{sublabel}</span>}
      </div>
    </div>
  );
}
