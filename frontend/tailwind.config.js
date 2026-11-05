/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Vazirmatn Variable"', 'Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          sunken: token('surface-sunken'),
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
          4: token('ink-4'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          soft: token('accent-soft'),
          fg: token('on-accent'),
        },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        'on-danger': token('on-danger'),
        overlay: token('overlay'),
      },
      boxShadow: {
        pop: '0 16px 40px -16px rgb(15 22 21 / 0.28), 0 2px 8px -2px rgb(15 22 21 / 0.10)',
        lift: '0 1px 2px rgb(15 22 21 / 0.06), 0 1px 1px rgb(15 22 21 / 0.04)',
      },
      borderRadius: {
        card: '0.75rem',
        control: '0.5rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'rise-in': 'rise-in 180ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
