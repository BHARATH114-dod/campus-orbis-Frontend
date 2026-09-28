import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function Disclaimer() {
  return (
    <PolicyLayout title="Disclaimer" lastUpdated={LAST_UPDATED}>
      <Section heading="Information Accuracy">
        <p>
          {SITE_NAME} displays information entered by colleges, faculty, and students — including
          attendance, notes, event details, and test results. While we aim for the platform to
          function reliably, we do not guarantee that all information displayed is always
          complete, current, or error-free, since much of it is entered by users themselves.
        </p>
      </Section>

      <Section heading="Service Availability">
        <p>
          We aim to keep {SITE_NAME} available and responsive, but we do not guarantee
          uninterrupted access. The Service may be temporarily unavailable due to maintenance,
          updates, or factors outside our control.
        </p>
      </Section>

      <Section heading="Third-Party Links and Content">
        <p>
          Where the Service links to external websites or resources (for example, a placement
          opportunity link or an external resource shared in Notes), we are not responsible for
          the content, accuracy, or practices of those third-party sites.
        </p>
      </Section>

      <Section heading="Limitation of Liability">
        <BulletList
          items={[
            'The Service is provided "as is" without warranties of any kind, express or implied.',
            'We are not liable for decisions made based on information displayed on the platform.',
            'To the fullest extent permitted by law, we disclaim liability for indirect, incidental, or consequential damages arising from use of the Service.',
          ]}
        />
      </Section>

      <Section heading="Questions?">
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
