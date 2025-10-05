/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slateglass: 'rgba(15, 23, 42, 0.75)',
      },
    },
  },
  plugins: [],
}
