import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});
  // Kept in sync with `toasts` on every render so showToast can read the
  // current list synchronously (state setters can't be read back
  // immediately after calling them). See dedup comment below.
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  // type: 'success' | 'error' | 'info' | 'warning'
  // Root-cause fix (repeated red toast spam, e.g. from a polling loop that
  // keeps failing): if the same message+type is already showing, refresh
  // its auto-dismiss timer instead of stacking a duplicate toast on top of
  // it. This keeps the UI to ONE meaningful error at a time no matter how
  // many times a background poll fails in a row, app-wide — without
  // dropping or hiding any distinct/new message.
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const existing = toastsRef.current.find((t) => t.message === message && t.type === type);
    if (existing) {
      clearTimeout(timers.current[existing.id]);
      timers.current[existing.id] = setTimeout(() => dismiss(existing.id), duration);
      return existing.id;
    }
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
