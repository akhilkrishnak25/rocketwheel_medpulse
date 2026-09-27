/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rocket Wheel Brand Palette from Image
        royal: {
          50: '#f0f2ff',
          100: '#e0e4ff',
          200: '#c7cefe',
          300: '#a3adfc',
          400: '#7983f8',
          500: '#4e54f3',
          600: '#1E20E0', // Primary Vibrant Electric Royal Blue from logo background/R
          700: '#191ac2',
          800: '#15179f',
          900: '#15177e',
          950: '#0d0e4d',
        },
        pink: {
          50: '#fff1f4',
          100: '#ffe4e8',
          200: '#fecdd6',
          300: '#fea3b4',
          400: '#fd6f8c',
          500: '#FF1D6B', // Vibrant Rocket Pink from 'OCKET'
          600: '#e1145a',
          700: '#be0c47',
          800: '#9d0d3b',
          900: '#831035',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#FBA94C', // Warm Golden Orange from 'wheel' tag
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        border: 'hsl(214.3, 31.8%, 91.4%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
