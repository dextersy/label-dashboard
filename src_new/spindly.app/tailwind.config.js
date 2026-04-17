/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#019D92',
          dark: '#017A72',
          light: '#E0F7F6',
          muted: '#4DBDB6',
        },
        accent: {
          pink: '#FF5C7A',
          yellow: '#FFD60A',
          purple: '#8B5CF6',
        },
        dark: {
          DEFAULT: '#0C1F1D',
          surface: '#132421',
        },
        surface: '#F0FAFA',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 20s linear infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
