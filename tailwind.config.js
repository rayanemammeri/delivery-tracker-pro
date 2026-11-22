/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        cash: { DEFAULT: '#10b981', soft: '#10b98122' },
        machine: { DEFAULT: '#6366f1', soft: '#6366f122' },
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        up: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: { pop: 'pop .18s ease-out', up: 'up .22s ease-out' },
    },
  },
  plugins: [],
};
