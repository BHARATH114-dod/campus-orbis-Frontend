import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function CopyrightPolicy() {
  return (
    <PolicyLayout title="Copyright & Intellectual Property" lastUpdated={LAST_UPDATED}>
      <Section heading="Our Intellectual Property">
        <p>
          The {SITE_NAME} name, logo, website design, user interface, source code, and all
          original text, graphics, and other content created for the Service are the property of{' '}
          {SITE_NAME} (or its licensors), except where otherwise noted. All rights not expressly
          granted to you are reserved.
        </p>
      </Section>

      <Section heading="What You May Not Do">
        <BulletList
          items={[
            'Copy, reproduce, or redistribute the platform\u2019s design, source code, or branding without permission.',
            'Modify, decompile, or reverse-engineer any part of the Service beyond what applicable law allows.',
            'Use the Campus Orbis name or logo to represent an unaffiliated product or service.',
          ]}
        />
      </Section>

      <Section heading="Your Content">
        <p>
          Notes, images, posts, and other materials you upload remain yours. By uploading content
          to {SITE_NAME}, you grant us a limited license to store, display, and process that
          content solely as needed to operate the Service for your college (for example, showing a
          note you uploaded to your classmates, or a post you made on the Board).
        </p>
      </Section>

      <Section heading="Copyright Notice">
        <p className="font-medium text-ink">© 2026 {SITE_NAME}. All Rights Reserved.</p>
      </Section>

      <Section heading="Reporting a Concern">
        <p>
          If you believe content on {SITE_NAME} infringes your intellectual property rights,
          contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-teal hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </PolicyLayout>
  );
}
