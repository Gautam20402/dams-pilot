/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter','sans-serif'],
        mono: ['JetBrains Mono','monospace'],
      },
    },
  },
  plugins: [],
}
