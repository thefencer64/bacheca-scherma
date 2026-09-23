/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        scherma: {
          blue:    '#0179C0',
          navy:    '#00244F',
        }
      }
    },
  },
  plugins: [],
}
