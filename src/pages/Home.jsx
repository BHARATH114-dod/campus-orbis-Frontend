import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import CountUp from '../components/CountUp';
import { fetchColleges, fetchPublicStats, collegeLogoUrl } from '../services/authService';

const FEATURES = [
  { icon: '🏫', title: 'Independent Colleges', text: "Every college's data, users, and content are fully separate — no cross-college visibility." },
  { icon: '🧑‍🏫', title: 'Role Hierarchy', text: 'Super Admin → College Admin → HOD → Faculty → Student, each managing only their own layer.' },
  { icon: '🗓️', title: 'Events & Posters', text: 'Create events with a poster image, and students RSVP in one tap.' },
  { icon: '📄', title: 'Study Notes Sharing', text: 'Upload notes and slides — viewable in-app by default, downloadable if the uploader allows it.' },
  { icon: '✅', title: 'Attendance & Marks', text: 'Faculty record attendance and test scores for their section; students see their own.' },
  { icon: '📢', title: 'Public Board & Lost+Found', text: 'Post complaints, opinions, or a lost item; reply directly to reconnect it with its owner.' },
  { icon: '🧪', title: 'Online Tests', text: 'Faculty write MCQ, theory, and coding tests; students take them at their own pace, with fullscreen as an optional focus aid.' },
  { icon: '⚙️', title: 'Account Settings', text: 'Every signed-in user can change their own password and appearance preferences.' },
];

export default function Home() {
  const [stats, setStats] = useState({ colleges: null, users: null });
  const [colleges, setColleges] = useState([]);

  useEffect(() => {
    fetchPublicStats().then(setStats).catch(() => {});
    fetchColleges().then(setColleges).catch(() => {});
  }, []);

  return (
    <>
      <HeroSection
        primaryCta={
          <Link to="/login" className="rounded-xl bg-hero-primary px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700">
            Login
          </Link>
        }
        secondaryCta={
          <a href="#about" className="rounded-xl border border-white/55 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-md hover:bg-white/20">
            Get Started
          </a>
        }
      />

      {/* ---------- About ---------- */}
      <section id="about" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal">About Campus Orbis</span>
            <h2 className="mt-2 text-3xl font-extrabold text-purple">Everything your campus needs, in one login</h2>
            <p className="mt-4 text-ink-light leading-relaxed">
              Campus Orbis brings announcements, events, shared notes, a public board for lost &amp; found and campus
              discussion, and secure role-based access for students, faculty, and admins into a single platform.
            </p>
            <p className="mt-3 text-ink-light leading-relaxed">
              Every college gets its own Super-Admin-created space, with its own College Admin, HODs, faculty, and
              students — no self sign-up, and no visibility into any other college's data.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard value="5" label="Role types" />
            <StatCard value={<CountUp value={stats.colleges} />} label="Colleges on Campus Orbis" />
            <StatCard value={<CountUp value={stats.users} />} label="People using Campus Orbis" />
            <StatCard value="100%" label="Isolated by college" />
          </div>
        </div>
      </section>

      {/* ---------- Colleges on Campus Orbis ---------- */}
      {colleges.length > 0 && (
        <section className="bg-paper-card py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-teal">Trusted by</span>
              <h2 className="mt-2 text-2xl font-extrabold text-purple">Colleges on Campus Orbis</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {colleges.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-paper p-5 text-center shadow-sm">
                  {c.has_logo ? (
                    <img src={collegeLogoUrl(c.id)} alt="" className="h-12 w-12 rounded object-contain" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-purple/10 text-sm font-bold text-purple">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-ink">{c.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Features ---------- */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-teal">What's inside</span>
            <h2 className="mt-2 text-3xl font-extrabold text-purple">Our Features</h2>
            <p className="mt-2 text-ink-light">Built to keep every campus activity organized, secure, and easy to find.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-line bg-paper-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-teal hover:shadow-lg hover:shadow-teal/10"
              >
                <div className="text-2xl transition-transform duration-200 group-hover:scale-110">{f.icon}</div>
                <h3 className="mt-3 text-sm font-bold text-ink transition-colors group-hover:text-teal">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-light">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Events teaser ---------- */}
      <section id="events" className="mx-auto max-w-3xl px-6 py-20 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-teal">Stay in the loop</span>
        <h2 className="mt-2 text-3xl font-extrabold text-purple">Never miss what's happening on campus</h2>
        <p className="mt-3 text-ink-light">Workshops, fests, seminars, and more — sign in to see what's scheduled.</p>
        <Link to="/login" className="mt-6 inline-block rounded-xl bg-hero-primary px-8 py-3 text-sm font-bold text-white hover:bg-blue-700">
          Sign In
        </Link>
      </section>

      {/* ---------- Contact / no-signup notice ---------- */}
      <section id="contact" className="bg-paper-card py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-teal">Get in touch</span>
          <h2 className="mt-2 text-3xl font-extrabold text-purple">Don't have a login yet?</h2>
          <p className="mt-4 text-ink-light">
            There's no open sign-up — every account is created by the role above it. Students and faculty should
            contact their HOD; HODs are added by their College Admin.
          </p>
          <Link to="/login" className="mt-6 inline-block rounded-xl bg-hero-primary px-8 py-3 text-sm font-bold text-white hover:bg-blue-700">
            Sign In
          </Link>
        </div>
      </section>
    </>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-card p-6 text-center shadow-sm">
      <p className="text-3xl font-extrabold text-teal">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ink-light">{label}</p>
    </div>
  );
}
