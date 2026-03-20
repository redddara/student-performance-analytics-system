/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f2',
          100: '#fbe8e8',
          200: '#f6d3d3',
          300: '#f0adad',
          400: '#e87a7a',
          500: '#df4444',
          600: '#d92323',
          700: '#b31b1b',
          800: '#8c1818',
          900: '#6e1414',
          950: '#3d0808',
        },
        gold: {
          50: '#fffbe6',
          100: '#fff5c2',
          200: '#ffec8a',
          300: '#ffe04d',
          400: '#ffd000',
          500: '#d4a500',
          600: '#ad8700',
          700: '#8c6b00',
          800: '#755900',
          900: '#614a00',
          950: '#423100',
        },
      },
      // Enhanced typography for accessibility
      fontSize: {
        'xs': ['12px', { lineHeight: '18px' }],
        'sm': ['14px', { lineHeight: '21px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '27px' }],
        'xl': ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '36px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      // Enhanced spacing for better visual hierarchy
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },
    },
  },
  plugins: [],
}