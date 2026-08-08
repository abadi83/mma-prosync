import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E3F2FD',
          100: '#BBDEFB',
          300: '#90CAF9',
          500: '#2196F3',
          700: '#0D47A1',
        },
      },
      fontFamily: {
        sans: ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
