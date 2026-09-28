/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Ported 1:1 from the existing app_style.css brand palette so the React
      // rebuild looks like the same product, not a reskin.
      colors: {
        ink: 'var(--ink)',
        'ink-light': 'var(--ink-light)',
        paper: 'var(--paper)',
        'paper-card': 'var(--paper-card)',
        line: 'var(--line)',
        purple: 'var(--purple)',
        teal: 'var(--teal)',
        gold: 'var(--gold)',
        crimson: 'var(--crimson)',
        'surface-dark': 'var(--surface-dark)',
        'hero-primary': 'var(--hero-primary)',
        'hero-secondary': 'var(--hero-secondary)',
        'hero-accent': 'var(--hero-accent)',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
