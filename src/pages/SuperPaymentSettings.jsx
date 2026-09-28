import { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { fetchSuperPaymentSettings, saveSuperPaymentSettings } from '../services/courseAccessService';
import api from '../services/api';

// Super Admin → Payment Management (spec §8). Changes here apply
// instantly for every college (Colleges read the same singleton row via
// GET /api/college/payment-settings).
export default function SuperPaymentSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState({ upi_id: '', account_name: '', bank_name: '', amount: '', currency: 'INR', description: '' });
  const [qrFile, setQrFile] = useState(null);
  const [hasQr, setHasQr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSuperPaymentSettings()
      .then((res) => {
        if (res.settings) {
          const { upi_id, account_name, bank_name, amount, currency, description, has_qr } = res.settings;
          setFields({ upi_id: upi_id || '', account_name: account_name || '', bank_name: bank_name || '', amount: amount || '', currency: currency || 'INR', description: description || '' });
          setHasQr(!!has_qr);
        }
      })
      .catch((err) => showToast(err.message || 'Could not load payment settings.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    try {
      await saveSuperPaymentSettings(fields, qrFile);
      showToast('Payment settings updated.', 'success');
      setQrFile(null);
      if (qrFile) setHasQr(true);
    } catch (err) {
      showToast(err.message || 'Could not save payment settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage label="Loading payment settings…" />;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-ink">Payment Management</h1>
      <div className="space-y-4 rounded-xl border border-line bg-paper-card p-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-light">QR Code</label>
          {hasQr && !qrFile && <img src={`${api.defaults.baseURL}/super/payment-settings/qr`} alt="Current QR" className="mb-2 h-32 w-32 rounded-lg border border-line object-contain" />}
          <input type="file" accept="image/*" onChange={(e) => setQrFile(e.target.files?.[0] || null)} className="text-sm text-ink" />
        </div>
        <Field label="UPI ID" value={fields.upi_id} onChange={(v) => setFields((f) => ({ ...f, upi_id: v }))} />
        <Field label="Account Holder Name" value={fields.account_name} onChange={(v) => setFields((f) => ({ ...f, account_name: v }))} />
        <Field label="Bank Name" value={fields.bank_name} onChange={(v) => setFields((f) => ({ ...f, bank_name: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" value={fields.amount} onChange={(v) => setFields((f) => ({ ...f, amount: v }))} />
          <Field label="Currency" value={fields.currency} onChange={(v) => setFields((f) => ({ ...f, currency: v }))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-light">Description</label>
          <textarea value={fields.description} onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Payment Settings'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-light">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink" />
    </div>
  );
}
