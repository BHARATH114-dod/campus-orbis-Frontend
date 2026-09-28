import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy explains what information {SITE_NAME} collects, why we collect it, and
        how it's used, stored, and protected.
      </p>

      <Section heading="Information We Collect">
        <p>Because accounts are created by your college's administrators rather than through public signup, the information we hold comes from your account setup and your ordinary use of the Service:</p>
        <BulletList
          items={[
            'Account details: name, username, role (student/faculty/HOD/admin), department, section, and roll number where applicable.',
            'Authentication data: a securely hashed password (we never store passwords in plain text).',
            'Content you provide: notes and documents you upload, event posts, club activity, board posts and replies, test submissions, and profile information you choose to add.',
            'Attendance and academic records entered by faculty/admins as part of normal college operations.',
            'Device push-notification tokens, only if you enable notifications, used solely to deliver in-app alerts to your device.',
            'Short video/audio recording chunks captured during proctored online tests, only while that specific test is active, for academic-integrity monitoring purposes.',
          ]}
        />
      </Section>

      <Section heading="Why We Collect It">
        <p>
          We collect this information to operate the core features of the Service: authenticating
          you, showing you the right content for your role and section, tracking attendance and
          academic progress, enabling communication (Board, notifications), and running online
          tests with monitoring where your college has enabled that feature.
        </p>
      </Section>

      <Section heading="How Data Is Stored and Used">
        <p>
          Data is stored in our MongoDB database and, for uploaded files (notes, images, test
          monitoring clips), in database-backed file storage (GridFS). Data is scoped to your
          college and role — for example, faculty can generally only see students in their own
          section, and students cannot see other students' private records.
        </p>
      </Section>

      <Section heading="Third-Party Sharing">
        <p>
          We do not sell your personal information. Limited data is shared with the following
          third-party service, only where your college has enabled the relevant feature:
        </p>
        <BulletList
          items={[
            'Your browser\'s own push service (e.g. Google, Mozilla, Microsoft, or Apple, depending on which browser you use) — used only if you enable notifications, to deliver an encrypted notification alert to your device. This is a standard part of how web browsers support notifications and is not specific to Campus Orbis; the browser vendor sees only that an encrypted message was delivered to your device, not its contents. If you do not enable notifications, no data is sent this way.',
          ]}
        />
      </Section>

      <Section heading="Cookies and Tracking Technologies">
        <p>
          We use a single essential session cookie to keep you signed in. We do not use
          advertising or third-party analytics/tracking cookies. See our{' '}
          <a href="/legal/cookies" className="font-medium text-teal hover:underline">
            Cookie Policy
          </a>{' '}
          for details.
        </p>
      </Section>

      <Section heading="Your Rights">
        <p>Depending on your role and applicable law, you can generally:</p>
        <BulletList
          items={[
            'View and update certain profile information from your account settings.',
            'Request a copy of the personal data we hold about you.',
            'Request correction of inaccurate data.',
            'Request deletion of your account data, subject to your college\u2019s record-keeping requirements (e.g. academic records that must be retained).',
          ]}
        />
        <p>To exercise any of these, contact us using the details below.</p>
      </Section>

      <Section heading="Data Security and Retention">
        <p>
          We apply reasonable technical and organizational measures to protect your data (see our{' '}
          <a href="/legal/security" className="font-medium text-teal hover:underline">
            Security Information
          </a>{' '}
          page). We retain account and academic data for as long as your account is active and
          your college requires it for record-keeping, and remove it in line with your college's
          data-retention practices when no longer needed.
        </p>
      </Section>

      <Section heading="Contact Us About Privacy">
        <p>
          Questions about this policy or your data can be sent to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </PolicyLayout>
  );
}
