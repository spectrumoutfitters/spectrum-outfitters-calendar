/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Spectrum Outfitters brand from logo: black, white, gold
        primary: {
          DEFAULT: '#B8860B',
          dark: '#8B6914',
          light: '#D4A84B',
          subtle: 'rgba(184, 134, 11, 0.1)',
        },
        brand: {
          black: '#0a0a0a',
          charcoal: '#171717',
          white: '#fafafa',
          gold: '#B8860B',
        },
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};
