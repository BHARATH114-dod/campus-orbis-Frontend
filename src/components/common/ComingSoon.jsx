/**
 * @param {{ title: string, module: string, note?: string }} props
 */
export default function ComingSoon({ title, module, note }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-light">
        This page's layout and routing are wired up — the real data and interactions arrive in <strong>{module}</strong>, once this module is reviewed and approved.
      </p>
      {note && <p className="mt-3 text-xs text-gold">{note}</p>}
    </div>
  );
}
