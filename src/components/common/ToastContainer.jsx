import { useToast } from '../../context/ToastContext';

const STYLES = {
  success: 'bg-teal text-white',
  error: 'bg-crimson text-white',
  warning: 'bg-gold text-white',
  info: 'bg-purple text-white',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-[400] flex flex-col gap-2 w-[min(340px,calc(100vw-40px))]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`${STYLES[t.type] || STYLES.info} rounded-xl px-4 py-3 shadow-lg flex items-start justify-between gap-3 animate-[toastIn_.2s_ease]`}
        >
          <span className="text-sm leading-snug">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="text-white/80 hover:text-white text-sm leading-none"
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
