import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { subscribeRealtime } from '../services/realtime';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  fetchCollegeCourseAccess, fetchCollegePaymentSettings, fetchCollegeCourseRequests, submitCollegeCourseRequest, COURSE_PACKAGES,
} from '../services/courseAccessService';
import api from '../services/api';
import ErrorBoundary from '../components/common/ErrorBoundary';

// College Admin → Request Course (spec §7): pick a package, see payment
// details, submit proof. Status goes to "Pending" until Super Admin
// reviews it (Payment Verification panel).
//
// Also College Admin's Course Lock/Unlock status view (this prompt): the
// college-wide gate below always comes straight from the database on
// every load (never held only in local state), and a real-time socket
// subscription (the same `user:<username>` room Messages.jsx uses)
// refreshes it the instant Super Admin locks/unlocks the college or a
// Faculty member toggles a language — no manual refresh needed while this
// page is open, with the on-mount fetch as the always-correct fallback if
// the socket never connects (see services/realtime.js).
export default function CollegeRequestCourse() {
  return (
    <ErrorBoundary message="Something went wrong loading Request Course.">
      <CollegeRequestCourseInner />
    </ErrorBoundary>
  );
}

function CollegeRequestCourseInner() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState({ status: 'locked', expiry_date: null, languages: [] });
  const [settings, setSettings] = useState(null);
  const [requests, setRequests] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [transactionId, setTransactionId] = useState('');
  const [upiId, setUpiId] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  // Silent refresh — used by the real-time subscription below, so an
  // incoming update doesn't flash the whole page into a loading spinner.
  const refreshAccess = () => fetchCollegeCourseAccess().then(setAccess).catch(() => {});

  useEffect(() => {
    if (!user?.username) return undefined;
    return subscribeRealtime(`user:${user.username}`, (msg) => {
      if (msg.type === 'course_access_changed') refreshAccess();
    });
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true);
    Promise.all([fetchCollegeCourseAccess(), fetchCollegePaymentSettings(), fetchCollegeCourseRequests()])
      .then(([a, s, r]) => { setAccess(a); setSettings(s.settings); setRequests(r.requests); })
      .catch((err) => showToast(err.message || 'Could not load course access info.', 'error'))
      .finally(() => setLoading(false));
  }

  async function handleSubmit() {
    if (!transactionId.trim()) return showToast('Enter the transaction ID.', 'error');
    if (!screenshot) return showToast('Upload a payment screenshot.', 'error');
    setSubmitting(true);
    try {
      await submitCollegeCourseRequest({ pkg: selectedPackage, transactionId, upiId, notes, screenshot });
      showToast('Request submitted — status is now Pending.', 'success');
      setSelectedPackage(null); setTransactionId(''); setUpiId(''); setNotes(''); setScreenshot(null);
      load();
    } catch (err) {
      showToast(err.message || 'Could not submit the request.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-bold text-ink">Request Course</h1>
      <p className="mb-4 text-sm text-ink-light">
        Current status: <span className={`font-semibold ${access.status === 'unlocked' ? 'text-teal' : 'text-ink-light'}`}>{access.status === 'unlocked' ? `Active until ${new Date(access.expiry_date).toLocaleDateString()}` : 'Locked'}</span>
      </p>

      {/* Course Lock/Unlock status, per language — always the live
          database state (see refreshAccess above), never held only in
          local component state. Faculty individually enable/disable each
          language for their own students once the college-wide gate
          above is unlocked (spec §11) — this is read-only for College
          Admin, matching the backend's own role split (Super Admin
          controls the gate, Faculty controls each language). */}
      <div className="mb-8">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-light">Course Lock/Unlock Status</h2>
        {access.status !== 'unlocked' ? (
          <p className="rounded-lg border border-line bg-paper-card p-3 text-xs text-ink-light">
            Every language is locked while the Courses module itself is locked — request a package above to unlock it.
          </p>
        ) : (access.languages || []).length === 0 ? (
          <p className="rounded-lg border border-line bg-paper-card p-3 text-xs text-ink-light">No languages to show yet.</p>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line bg-paper-card">
            {access.languages.map((l) => (
              <div key={l.language} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold text-ink">{l.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-light">{l.enabled_faculty_count} of {l.total_faculty_count} faculty enabled</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${l.status === 'unlocked' ? 'bg-teal/10 text-teal' : 'bg-line/50 text-ink-light'}`}>
                    {l.status === 'unlocked' ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selectedPackage ? (
        <>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Choose a package</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COURSE_PACKAGES.map((p) => (
              <button key={p.value} onClick={() => setSelectedPackage(p.value)} className="rounded-xl border border-line bg-paper-card p-4 text-left transition hover:border-teal hover:shadow-sm">
                <p className="font-bold text-ink">{p.label}</p>
                <p className="text-xs text-ink-light">{p.duration}</p>
              </button>
            ))}
          </div>

          {requests.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-light">Your requests</h2>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line bg-paper-card p-3 text-sm">
                    <p className="font-semibold text-ink">{r.package} · {new Date(r.created_at).toLocaleDateString()}</p>
                    <p className={`text-xs font-semibold ${r.status === 'approved' ? 'text-teal' : r.status === 'rejected' ? 'text-crimson' : 'text-gold'}`}>{r.status}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-line bg-paper-card p-5">
          <button onClick={() => setSelectedPackage(null)} className="mb-3 text-xs font-semibold text-teal hover:underline">← Choose a different package</button>
          <h2 className="mb-3 text-sm font-bold text-ink">Pay for {COURSE_PACKAGES.find((p) => p.value === selectedPackage)?.label}</h2>

          {settings ? (
            <div className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-line bg-paper p-4 text-center">
              {settings.has_qr && <img src={`${api.defaults.baseURL}/super/payment-settings/qr`} alt="Payment QR" className="h-40 w-40 rounded-lg border border-line object-contain" />}
              <p className="text-sm font-semibold text-ink">{settings.upi_id}</p>
              <p className="text-xs text-ink-light">{settings.account_name} · {settings.bank_name}</p>
              <p className="text-lg font-bold text-ink">{settings.currency} {settings.amount}</p>
              {settings.description && <p className="text-xs text-ink-light">{settings.description}</p>}
            </div>
          ) : (
            <p className="mb-4 text-xs text-ink-light">Payment details haven't been configured yet — contact Campus Orbis support.</p>
          )}

          <div className="space-y-3">
            <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Transaction ID" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="UPI ID used" className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-light">Payment Screenshot</label>
              <input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} className="text-sm text-ink" />
            </div>
            <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
