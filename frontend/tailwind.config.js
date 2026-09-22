/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7fd',
          100: '#ddedf9',
          200: '#c1e1f5',
          300: '#95cfef',
          400: '#61b6e6',
          500: '#1977cc',
          600: '#1565b0',
          700: '#135290',
          800: '#144677',
          900: '#153b63',
          950: '#0e2541',
          DEFAULT: '#1977cc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
