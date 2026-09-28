import { useState } from 'react';
import PolicyLayout, { Section } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, LAST_UPDATED } from './constants';

const CATEGORIES = ['Account access', 'Bug report', 'Feature request', 'Report a post or user', 'Other'];

export default function ContactSupport() {
  const [form, setForm] = useState({ name: '', email: '', category: CATEGORIES[0], message: '' });
  const [sent, setSent] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // No backend endpoint exists for this form yet — it opens the user's
    // email client pre-filled instead, so the message still reaches support.
    const subject = encodeURIComponent(`[${form.category}] Message from ${form.name || 'a user'}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <PolicyLayout title="Contact & Support" lastUpdated={LAST_UPDATED}>
      <Section heading="Get in Touch">
        <p>
          Have a question, an issue, or feedback about {SITE_NAME}? Reach us using the details
          below, or send a message with the form.
        </p>
        <div className="mt-3 space-y-1 text-ink">
          <p>
            📧{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>📞 {SUPPORT_PHONE}</p>
        </div>
      </Section>

      <Section heading="What to Contact Us About">
        <p>
          Account access issues, bugs, feature requests, or reporting a post/user that violates
          our{' '}
          <a href="/legal/community-guidelines" className="font-medium text-teal hover:underline">
            Community Guidelines
          </a>
          . We generally aim to respond within a few business days.
        </p>
      </Section>

      <Section heading="Contact Form">
        {sent ? (
          <p className="rounded-lg bg-paper-card p-4 text-ink">
            Your email client should have opened with your message ready to send. If it didn't,
            email us directly at {SUPPORT_EMAIL}.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-paper-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink">Name</span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-teal"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink">Email</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-teal"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Category</span>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-teal"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Message</span>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                rows={5}
                className="w-full rounded-md border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-teal"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-hero-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Send Message
            </button>
          </form>
        )}
      </Section>
    </PolicyLayout>
  );
}
