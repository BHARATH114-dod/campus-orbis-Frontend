import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function TermsAndConditions() {
  return (
    <PolicyLayout title="Terms & Conditions" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms & Conditions ("Terms") govern your use of {SITE_NAME} (the "Service"), a
        campus management platform used by students, faculty, HODs, and administrators of
        participating colleges. By accessing or using the Service, you agree to these Terms.
      </p>

      <Section heading="1. Proper Use of the Service">
        <p>
          {SITE_NAME} is provided for academic and campus-administration purposes — attendance,
          notes, tests, events, clubs, placements, and related college activities. You agree to use
          it only for these intended purposes and in a manner consistent with your assigned role.
        </p>
      </Section>

      <Section heading="2. User Responsibilities">
        <BulletList
          items={[
            'Keep your login credentials confidential and do not share your account with anyone else.',
            'Provide accurate information where the Service asks you to (e.g. profile details, uploaded coursework).',
            'Use features such as the Board, Notes, Events, and Clubs sections responsibly and respectfully.',
            'Report any suspected unauthorized use of your account to your college administrator or our support team.',
          ]}
        />
      </Section>

      <Section heading="3. Prohibited Activities">
        <p>You agree not to:</p>
        <BulletList
          items={[
            'Attempt to gain unauthorized access to another user\u2019s account, data, or any part of the Service.',
            'Upload files, notes, images, or posts that are unlawful, harassing, defamatory, or that infringe someone else\u2019s rights.',
            'Interfere with or disrupt the Service, its servers, or its networks (including test-monitoring and messaging features).',
            'Use automated tools to scrape, extract, or misuse data from the Service.',
            'Impersonate another person or misrepresent your role or affiliation.',
          ]}
        />
      </Section>

      <Section heading="4. Account Creation and Account Rules">
        <p>
          {SITE_NAME} does not offer public self-signup. Accounts are created for you by the
          relevant authority above your role in the college hierarchy (a Super Admin creates
          College Admins, who create HODs, who create Faculty and Students). You are responsible
          for all activity that occurs under your account.
        </p>
      </Section>

      <Section heading="5. Changes to the Service">
        <p>
          We may update, modify, or discontinue features of the Service at any time — for example,
          to improve functionality, fix issues, or roll out new academic tools. We'll aim to keep
          disruption to a minimum, but we do not guarantee that any specific feature will remain
          available indefinitely.
        </p>
      </Section>

      <Section heading="6. Suspension or Termination">
        <p>
          We (or your college administrator) may suspend or terminate your account if you violate
          these Terms, misuse the Service, or if your affiliation with the college ends (e.g.
          graduation, transfer, or resignation). You may also lose access if your college's
          subscription to the platform ends.
        </p>
      </Section>

      <Section heading="7. Limitation of Liability">
        <p>
          The Service is provided on an "as is" and "as available" basis. To the fullest extent
          permitted by law, {SITE_NAME} and its operators are not liable for indirect, incidental,
          or consequential damages arising from your use of, or inability to use, the Service —
          including data loss, missed notifications, or interrupted access.
        </p>
      </Section>

      <Section heading="8. General Terms">
        <BulletList
          items={[
            'These Terms, together with our Privacy Policy and other linked policies, form the entire agreement between you and us regarding the Service.',
            'If any part of these Terms is found unenforceable, the remaining parts continue to apply.',
            'We may update these Terms from time to time; continued use of the Service after changes means you accept the revised Terms.',
          ]}
        />
      </Section>

      <Section heading="Questions about these Terms?">
        <p>
          Contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </PolicyLayout>
  );
}
