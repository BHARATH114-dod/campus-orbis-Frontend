import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { changePassword } from '../services/authService';
import PasswordField from '../components/common/PasswordField';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!currentPassword) next.currentPassword = 'Enter your current password.';
    if (!newPassword) next.newPassword = 'Enter a new password.';
    else if (newPassword.length < 6) next.newPassword = 'New password must be at least 6 characters.';
    if (confirmPassword !== newPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      showToast('Password updated. Your other devices have been signed out.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (err) {
      showToast(err.message || 'Could not change your password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-ink">Settings</h1>

      {/* Appearance */}
      <section className="rounded-2xl border border-line bg-paper-card p-6">
        <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-xs text-ink-light">Choose how Campus Orbis looks on this device.</p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
              theme === 'light' ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink hover:bg-paper'
            }`}
          >
            ☀️ Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
              theme === 'dark' ? 'border-teal bg-teal/10 text-teal' : 'border-line text-ink hover:bg-paper'
            }`}
          >
            🌙 Dark
          </button>
        </div>
      </section>

      {/* Change password */}
      <section className="rounded-2xl border border-line bg-paper-card p-6">
        <h2 className="text-sm font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-xs text-ink-light">
          Changing your password signs out your other active sessions.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <Field
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={errors.currentPassword}
            autoComplete="current-password"
          />
          <Field
            label="New password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            error={errors.newPassword}
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-hero-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, type, value, onChange, error, autoComplete }) {
  // Spec item 18: password fields get the show/hide eye icon everywhere —
  // this is the account-settings Change Password form's Current/New/Confirm
  // fields, all three routed through the same shared component.
  const InputComponent = type === 'password' ? PasswordField : 'input';
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <InputComponent
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-xs text-crimson">{error}</p>}
    </div>
  );
}
