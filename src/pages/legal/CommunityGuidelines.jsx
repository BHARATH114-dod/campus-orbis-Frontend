import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function CommunityGuidelines() {
  return (
    <PolicyLayout title="Community Guidelines" lastUpdated={LAST_UPDATED}>
      <p>
        {SITE_NAME} includes shared spaces — like the Board, event pages, and club pages — where
        students, faculty, and admins can post, reply, and interact. These guidelines keep those
        spaces useful and respectful for everyone in your college community.
      </p>

      <Section heading="Respectful Behavior">
        <p>
          Treat others the way you'd want to be treated. Disagreements happen, but keep
          discussions constructive.
        </p>
      </Section>

      <Section heading="Harassment and Bullying">
        <p>
          Targeted harassment, bullying, threats, or intimidation of any student, faculty member,
          or staff will not be tolerated.
        </p>
      </Section>

      <Section heading="Spam">
        <p>Do not post repetitive, irrelevant, or promotional content unrelated to campus life or academics.</p>
      </Section>

      <Section heading="Illegal or Hateful Content">
        <BulletList
          items={[
            'No content that is illegal, or that promotes illegal activity.',
            'No hate speech, or content that abuses or demeans someone based on identity, background, or beliefs.',
          ]}
        />
      </Section>

      <Section heading="Misleading Content">
        <p>Do not post false information intended to deceive or mislead other students, faculty, or staff.</p>
      </Section>

      <Section heading="Copyright">
        <p>Only post content you have the right to share. See our Copyright & Intellectual Property page for more.</p>
      </Section>

      <Section heading="Enforcement">
        <p>
          Posts or replies that violate these guidelines may be removed, and repeated or serious
          violations may result in suspension of your account, at the discretion of your
          college's administrators.
        </p>
      </Section>

      <Section heading="Reporting a Problem">
        <p>
          If you see something on the Board or elsewhere that concerns you, please report it to
          your faculty/HOD/college admin, or reach us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </PolicyLayout>
  );
}
