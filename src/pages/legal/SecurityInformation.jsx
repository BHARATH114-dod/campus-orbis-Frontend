import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function SecurityInformation() {
  return (
    <PolicyLayout title="Security Information" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} handles accounts and academic data for every college on the platform, so we
        take reasonable steps to keep that information secure.
      </p>

      <Section heading="Authentication">
        <p>
          Access requires signing in with your account credentials. There is no public
          self-signup — every account is created by an administrator above your role, which
          limits who can obtain access in the first place.
        </p>
      </Section>

      <Section heading="Password Protection">
        <p>
          Passwords are never stored in plain text. We store a cryptographic hash of your password
          instead, so your actual password is not retrievable, even by us.
        </p>
      </Section>

      <Section heading="Access Controls">
        <p>
          Data visibility is scoped by role and college — for example, a faculty member can
          generally only see students in their own section, and a College Admin's visibility is
          limited to their own college.
        </p>
      </Section>

      <Section heading="Data Protection">
        <BulletList
          items={[
            'Session cookies are used to keep sign-in state secure between requests.',
            'File uploads (notes, images, spreadsheets, test-monitoring clips) are validated by type and size before being accepted.',
            'Push notification support (where enabled) is optional and isolated from core account data.',
          ]}
        />
      </Section>

      <Section heading="Reporting a Security Issue">
        <p>
          If you discover a potential security vulnerability in {SITE_NAME}, please report it
          responsibly to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          rather than disclosing it publicly, so we can investigate and address it.
        </p>
      </Section>
    </PolicyLayout>
  );
}
