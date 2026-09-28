import PolicyLayout, { Section, BulletList } from './PolicyLayout';
import { SITE_NAME, SUPPORT_EMAIL, LAST_UPDATED } from './constants';

export default function CookiePolicy() {
  return (
    <PolicyLayout title="Cookie Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This page explains how {SITE_NAME} uses cookies. We keep this simple: we use one type of
        cookie, and it exists purely to keep you signed in.
      </p>

      <Section heading="What Cookies Are">
        <p>
          Cookies are small pieces of data stored in your browser that let a website remember
          information between requests, such as whether you're logged in.
        </p>
      </Section>

      <Section heading="Why We Use Cookies">
        <p>
          {SITE_NAME} uses a session cookie to keep you authenticated after you log in, so you
          don't have to re-enter your credentials on every page.
        </p>
      </Section>

      <Section heading="Essential Cookies">
        <BulletList
          items={[
            'Session cookie — required for logging in and staying logged in. Without it, the Service cannot recognize you as authenticated, so it cannot be disabled while still using the Service.',
          ]}
        />
      </Section>

      <Section heading="Analytics / Performance Cookies">
        <p>
          {SITE_NAME} does not currently use analytics, advertising, or third-party tracking
          cookies.
        </p>
      </Section>

      <Section heading="Managing Cookies">
        <p>
          Because our only cookie is essential to signing in, disabling cookies in your browser
          will prevent you from staying logged in to {SITE_NAME}. You can still clear cookies at
          any time through your browser's settings — doing so will simply log you out.
        </p>
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
