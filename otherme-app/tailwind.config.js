/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'nimiq-blue': '#1f2348',
        'nimiq-light-blue': '#0582ca',
        'nimiq-gold': '#e9b213',
        'nimiq-green': '#21bca5',
        'nimiq-red': '#d94432',
        'om-teal': '#2ea3b4',
      },
      fontFamily: {
        sans: ['Muli', 'Mulish', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
