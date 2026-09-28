import { Link } from 'react-router-dom';
import { useState } from 'react';

const TIER_ICON = { beginner: '🌱', intermediate: '🚀', advanced: '🔥' };

// Persistent topic navigation for a course (spec item 1: "structured topic
// list" + item 9: Beginner/Intermediate/Advanced staging + item 11: mobile).
// Used both on the course home page and inline on every lesson page, so a
// student can jump to any unlocked lesson without going back to the
// dashboard first. `activeLessonId` highlights the lesson currently open
// (null on the dashboard, where nothing is "current" yet).
export default function CourseSidebar({ language, tiers, activeLessonId, onNavigate }) {
  return (
    <nav className="space-y-4">
      {tiers.map((tier) => (
        <TierBlock key={tier.tier} language={language} tier={tier} activeLessonId={activeLessonId} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

function TierBlock({ language, tier, activeLessonId, onNavigate }) {
  const containsActive = tier.modules.some((m) => m.lessons.some((l) => l.id === activeLessonId));
  const [open, setOpen] = useState(containsActive || (!tier.locked && tier.completed_lessons < tier.total_lessons));

  return (
    <div className="rounded-xl border border-line bg-paper-card">
      <button
        type="button"
        onClick={() => !tier.locked && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${tier.locked ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <span>{TIER_ICON[tier.tier] || '📘'}</span> {tier.label} {tier.locked && <span>🔒</span>}
        </span>
        <span className="text-xs text-ink-light">{tier.completed_lessons}/{tier.total_lessons}</span>
      </button>

      {tier.locked ? (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-light">Complete {prevTierLabel(tier.tier)} to unlock.</p>
      ) : open && (
        <div className="space-y-2 border-t border-line p-2">
          {tier.modules.map((mod) => (
            <ModuleBlock key={mod.id} language={language} mod={mod} activeLessonId={activeLessonId} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function prevTierLabel(tier) {
  if (tier === 'intermediate') return 'Beginner';
  if (tier === 'advanced') return 'Intermediate';
  return 'the previous stage';
}

function ModuleBlock({ language, mod, activeLessonId, onNavigate }) {
  const containsActive = mod.lessons.some((l) => l.id === activeLessonId);
  const [open, setOpen] = useState(containsActive || (mod.completed_lessons > 0 && mod.completed_lessons < mod.total_lessons));

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-paper">
        <span className="truncate text-xs font-semibold text-ink">{mod.title}</span>
        <span className="shrink-0 text-[11px] text-ink-light">{mod.completed_lessons}/{mod.total_lessons}</span>
      </button>
      {open && (
        <ul className="ml-1 space-y-0.5 border-l border-line pl-2">
          {mod.lessons.map((l) => {
            const status = l.completed ? '✅' : l.locked ? '🔒' : l.id === activeLessonId ? '→' : '⚪';
            const isActive = l.id === activeLessonId;
            const row = (
              <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${isActive ? 'bg-teal/10 font-semibold text-teal' : l.locked ? 'text-ink-light' : 'text-ink hover:bg-paper'}`}>
                <span>{status}</span>
                <span className="truncate">{l.title}</span>
              </div>
            );
            return (
              <li key={l.id}>
                {l.locked ? row : (
                  <Link to={`/courses/${language}/lessons/${l.id}`} onClick={onNavigate}>{row}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
