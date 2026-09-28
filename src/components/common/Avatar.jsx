// Default profile avatars (spec §4). Honest scope note: this environment
// doesn't have photorealistic AI image generation wired up, so these are
// simple deterministic illustrated icons — a person silhouette with role
// styling (formal blazer for faculty, ID-card badge for students) — not
// generated portrait photos. Swapping AVATAR_SVGS below for real generated
// image URLs later is a drop-in change; nothing else in the app needs to
// know the difference since everything just renders by avatar id.
const PALETTE = {
  student_male_1: { skin: '#e8b48c', hair: '#2b2118', top: '#7fb8e0', accent: '#1e3a5f' },
  student_male_2: { skin: '#c88a5c', hair: '#1a1410', top: '#7fb8e0', accent: '#1e3a5f' },
  student_female_1: { skin: '#e8b48c', hair: '#3a2a1c', top: '#7fb8e0', accent: '#1e3a5f' },
  student_female_2: { skin: '#c88a5c', hair: '#0f0d0b', top: '#7fb8e0', accent: '#1e3a5f' },
  faculty_male_1: { skin: '#e8b48c', hair: '#3a3a3a', top: '#2f3b52', accent: '#c9a961' },
  faculty_male_2: { skin: '#c88a5c', hair: '#1a1a1a', top: '#2f3b52', accent: '#c9a961' },
  faculty_female_1: { skin: '#e8b48c', hair: '#4a2f1c', top: '#2f3b52', accent: '#c9a961' },
  faculty_female_2: { skin: '#c88a5c', hair: '#181410', top: '#2f3b52', accent: '#c9a961' },
};

export default function Avatar({ avatarId, size = 40, className = '' }) {
  const p = PALETTE[avatarId];
  if (!p) return null;
  const isFaculty = avatarId.startsWith('faculty');
  const isFemale = avatarId.includes('female');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Profile avatar">
      <circle cx="32" cy="32" r="32" fill="#eef1fb" />
      {/* Shoulders / clothing */}
      <path d="M8 60 Q32 42 56 60 L56 64 L8 64 Z" fill={p.top} />
      {isFaculty && <path d="M20 46 L32 60 L44 46 L38 42 L32 50 L26 42 Z" fill={p.accent} opacity="0.85" />}
      {/* Neck */}
      <rect x="26" y="34" width="12" height="10" fill={p.skin} />
      {/* Head */}
      <circle cx="32" cy="24" r="14" fill={p.skin} />
      {/* Hair */}
      {isFemale ? (
        <path d="M18 22 Q18 8 32 8 Q46 8 46 22 Q46 30 44 34 Q45 20 32 20 Q19 20 20 34 Q18 30 18 22 Z" fill={p.hair} />
      ) : (
        <path d="M18 20 Q18 8 32 8 Q46 8 46 20 Q46 14 32 14 Q18 14 18 20 Z" fill={p.hair} />
      )}
      {/* ID card for students */}
      {!isFaculty && <rect x="27" y="50" width="10" height="7" rx="1" fill="#fff" stroke={p.accent} strokeWidth="1" />}
    </svg>
  );
}
