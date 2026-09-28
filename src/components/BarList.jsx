/**
 * @param {{ data: [{ label, count }], suffix?: string, emptyText?: string }} props
 * Renders each row's bar width relative to the max count in the set.
 */
export default function BarList({ data, suffix = '', emptyText = 'No data yet.' }) {
  if (!data || data.length === 0) return <p className="text-sm text-ink-light">{emptyText}</p>;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{d.label}</span>
            <span className="text-ink-light">{d.count}{suffix}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/50">
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${Math.max((d.count / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
