import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function AccessibilityStatement() {
  return (
    <PolicyLayout title="Accessibility Statement" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} aims to be usable by students, faculty, and staff of all abilities. This
        statement describes our current approach — it is not a claim of full compliance or formal
        certification, which we have not undergone.
      </p>

      <Section heading="Our Current Efforts">
        <BulletList
          items={[
            'Navigation and layout designed to work across desktop and mobile screen sizes.',
            'Readable typography and color choices, including a light and dark theme.',
            'Standard interactive elements (links, buttons, forms) built on accessible HTML foundations where possible.',
            'Alternative text for images where applicable throughout the interface.',
          ]}
        />
      </Section>

      <Section heading="Ongoing Improvements">
        <p>
          Accessibility is something we continue to work on rather than a finished project. We
          welcome feedback on parts of {SITE_NAME} that are difficult to use with assistive
          technology, keyboard-only navigation, or screen readers.
        </p>
      </Section>

      <Section heading="Reporting an Accessibility Issue">
        <p>
          If you encounter an accessibility barrier while using {SITE_NAME}, please let us know at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          so we can look into it.
        </p>
      </Section>
    </PolicyLayout>
  );
}
