/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10B981', // green from figma
        'primary-hover': '#059669',
        background: '#FAFAFA',
        card: '#FFFFFF',
      }
    },
  },
  plugins: [],
}
