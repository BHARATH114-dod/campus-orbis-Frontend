import Logo from './common/Logo';

/**
 * Reusable full-bleed hero. Defaults match the Campus Orbis landing page copy,
 * but every bit of content is a prop so it can be reused (e.g. a smaller
 * hero atop a dashboard section) without forking the component.
 */
export default function HeroSection({
  title = (
    <>Welcome to <span className="text-hero-secondary">Campus Orbis</span></>
  ),
  subtitle = 'Your one-stop solution for campus activities — announcements, events, notes, attendance, and marks, all in one place.',
  primaryCta,
  secondaryCta,
  minHeight = 'min-h-[min(92vh,760px)]',
}) {
  return (
    <section
      id="home"
      className={`relative flex ${minHeight} items-center justify-center bg-[#0B1B3A] bg-cover bg-top px-6 py-24 text-center`}
      style={{ backgroundImage: "url('/hero-bg.svg')" }}
    >
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-5">
        <div className="grid h-[84px] w-[84px] place-items-center rounded-[22px] border border-white/35 bg-white/15 shadow-lg backdrop-blur-md">
          <Logo size={52} />
        </div>

        <h1 className="text-[clamp(32px,5vw,52px)] font-extrabold leading-tight text-white [text-shadow:0_2px_18px_rgba(6,20,44,0.35)]">
          {title}
        </h1>

        <p className="max-w-[520px] text-[clamp(15px,2vw,18.5px)] leading-relaxed text-white/90 [text-shadow:0_1px_12px_rgba(6,20,44,0.3)]">
          {subtitle}
        </p>

        {(primaryCta || secondaryCta) && (
          <div className="mt-2 flex flex-wrap justify-center gap-3.5">
            {primaryCta}
            {secondaryCta}
          </div>
        )}
      </div>
    </section>
  );
}
