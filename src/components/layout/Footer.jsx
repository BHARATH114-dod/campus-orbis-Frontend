import { Link } from 'react-router-dom';
import Logo from '../common/Logo';

// Refund & Cancellation is intentionally omitted — Campus Orbis has no
// payments, subscriptions, or bookings, so that policy doesn't apply.
const LEGAL_LINKS = [
  { to: '/legal/privacy', label: 'Privacy Policy' },
  { to: '/legal/terms', label: 'Terms & Conditions' },
  { to: '/legal/cookies', label: 'Cookie Policy' },
  { to: '/legal/copyright', label: 'Copyright & IP' },
  { to: '/legal/disclaimer', label: 'Disclaimer' },
  { to: '/legal/community-guidelines', label: 'Community Guidelines' },
  { to: '/legal/accessibility', label: 'Accessibility' },
  { to: '/legal/security', label: 'Security' },
];

// Set a real URL here to show a social link — omitted entirely if left null,
// so we never show a placeholder link that goes nowhere.
const SOCIAL_LINKS = [
  { label: 'Instagram', href: null },
  { label: 'LinkedIn', href: null },
  { label: 'YouTube', href: null },
];

export default function Footer() {
  const activeSocialLinks = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <footer className="border-t border-line bg-surface-dark text-white/80">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Logo size={32} />
            Campus Orbis
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            Connecting students, faculty, and campus life in one place — a separate, secure space for every
            college on the platform.
          </p>
        </div>

        <FooterColumn title="Quick Links">
          <FooterLink href="/#home" label="Home" />
          <FooterLink href="/#about" label="About Us" />
          <FooterLink href="/legal/contact" label="Contact Us" />
          <FooterLink href="/#features" label="FAQ" />
        </FooterColumn>

        <FooterColumn title="Legal">
          {LEGAL_LINKS.map((l) => (
            <FooterLink key={l.to} href={l.to} label={l.label} />
          ))}
        </FooterColumn>

        <FooterColumn title="Company">
          <FooterLink href="/#about" label="About" />
          <FooterLink href="/legal/contact" label="Contact" />
          {activeSocialLinks.length > 0 && (
            <div className="mt-2 flex gap-3">
              {activeSocialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/75 hover:text-white"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </FooterColumn>
      </div>

      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Campus Orbis. All Rights Reserved.
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, label }) {
  // Internal page routes use <Link> for client-side navigation (no full
  // reload); same-page hash anchors (e.g. "/#about") stay plain <a> tags.
  if (href.startsWith('/legal/')) {
    return (
      <Link to={href} className="text-sm text-white/75 hover:text-white">
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className="text-sm text-white/75 hover:text-white">
      {label}
    </a>
  );
}
