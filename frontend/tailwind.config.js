/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        'nb-cream': '#FAF7F0',
        'nb-yellow': '#FFD23F',
        'nb-pink': '#FF6B9D',
        'nb-lime': '#C5E063',
        'nb-blue': '#4A90E2',
        'nb-purple': '#B8A1FF',
        'nb-orange': '#FF8C42',
        'nb-gray': '#E8E4DC',
        'nb-muted': '#6B6B6B',
        'nb-black': '#0A0A0A',
        'nb-white': '#FFFFFF',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'nb': '6px 6px 0 #0A0A0A',
        'nb-sm': '4px 4px 0 #0A0A0A',
        'nb-lg': '8px 8px 0 #0A0A0A',
        'nb-xl': '12px 12px 0 #0A0A0A',
      },
      borderWidth: {
        'nb': '3px',
        'nb-thin': '2px',
      },
      borderRadius: {
        'none': '0',
      },
    },
  },
  plugins: [],
}
