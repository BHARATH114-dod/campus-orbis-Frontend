import { useEffect } from 'react';

/**
 * Reusable modal dialog. Pass `fullScreen` for a dedicated full-screen
 * experience (e.g. Faculty Test Creation, spec Part 10) instead of the
 * default centered dialog — same open/close/escape/scroll-lock behavior,
 * just occupying the whole viewport with room for a long, sectioned form.
 * @param {{ open: boolean, onClose: () => void, title?: string, children: React.ReactNode, footer?: React.ReactNode, fullScreen?: boolean }} props
 */
export default function Modal({ open, onClose, title, children, footer, fullScreen = false }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('overflow-hidden');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [open, onClose]);

  if (!open) return null;

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[150] flex flex-col overflow-y-auto bg-paper">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-paper-card px-4 py-3 sm:px-8">
          {title && <h2 className="text-lg font-semibold text-ink sm:text-xl">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm text-ink-light hover:bg-line/40"
          >
            ✕ Close
          </button>
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-8">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-line bg-paper-card px-4 py-3 sm:px-8">
            <div className="mx-auto flex w-full max-w-3xl gap-3">{footer}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[460px] max-h-[90vh] overflow-y-auto rounded-2xl bg-paper-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          {title && <h2 className="text-xl font-semibold text-ink">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-lg border border-line px-2 py-1 text-sm text-ink-light hover:bg-line/40"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex gap-3">{footer}</div>}
      </div>
    </div>
  );
}
