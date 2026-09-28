export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function isPastDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

// Test Scheduling — exact date + time display, e.g. "10:00 AM · 25 August
// 2026". Always shows the college's local timezone (the browser's own),
// consistently, per spec item 8/9: students should never have to guess
// when a test starts or ends.
export function formatExactDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${time} · ${date}`;
}

// Test Scheduling — live countdown, HH:MM:SS, floored to the second and
// never negative (a boundary tick right at zero should read 00:00:00,
// not -0:00:-1). Used for both "Starts In" (within 1 hour of start) and
// the client-side "Time Remaining" estimate before a student has joined.
export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
