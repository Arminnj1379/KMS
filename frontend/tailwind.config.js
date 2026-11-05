/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2fe',
          100: '#dce4fd',
          200: '#bccdfb',
          300: '#8fadF8',
          400: '#5d81f2',
          500: '#2e5bee',
          600: '#2449c4',
          700: '#1d3b9e',
          800: '#1c357e',
          900: '#1b3168',
          950: '#152452',
        },
        paper: {
          DEFAULT: '#f4f4f2',
          dark: '#0e1116',
        },
      },
      boxShadow: {
        pop: '0 8px 28px -8px rgb(24 27 32 / 0.18), 0 2px 6px -2px rgb(24 27 32 / 0.08)',
        lift: '0 2px 10px -2px rgb(24 27 32 / 0.10)',
      },
      borderRadius: {
        card: '0.625rem',
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
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
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
