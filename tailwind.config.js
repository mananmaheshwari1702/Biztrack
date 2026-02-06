/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colors and other theme extensions are now handled in index.css via @theme
    },
  },
  plugins: [],
}
