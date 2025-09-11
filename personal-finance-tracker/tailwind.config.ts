import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        glass: {
          bg: 'rgba(15, 23, 42, 0.8)',
          border: 'rgba(148, 163, 184, 0.1)',
        },
        accent: {
          primary: '#3b82f6',
          secondary: '#10b981',
          tertiary: '#8b5cf6',
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      backdropBlur: {
        'xs': '2px',
      }
    }
  },
  plugins: []
} satisfies Config;

