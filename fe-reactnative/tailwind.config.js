/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ── Colors — Telkom Red Enterprise Flow System ──
      colors: {
        brand: {
          900: '#7A0019',
          800: '#9B0020',
          700: '#BE0726',
          600: '#ED1C24',
          500: '#F04E55',
          400: '#F47B81',
          300: '#F8A9AD',
          200: '#FBD5D7',
          100: '#FDE8E9',
          50:  '#FFF1F3',
        },
        primary: {
          DEFAULT: '#ED1C24',
          dark: '#9B0020',
          light: '#FFF1F3',
          50:  '#FFF1F3',
          100: '#FDE8E9',
          200: '#FBD5D7',
          300: '#F8A9AD',
          400: '#F47B81',
          500: '#F04E55',
          600: '#ED1C24',
          700: '#BE0726',
          800: '#9B0020',
          900: '#7A0019',
        },
        neutral: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#EEF2F6',
          300: '#E2E8F0',
          400: '#CBD5E1',
          500: '#94A3B8',
          600: '#64748B',
          700: '#4A5568',
          800: '#2D3748',
          900: '#1A2332',
          950: '#0F1720',
        },
        surface: '#FFFFFF',
        background: '#F8FAFC',
      },

      // ── Font Family — Inter ──
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      // ── Type Scale ──
      fontSize: {
        'display': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],   // 36px
        'heading-1': ['1.875rem', { lineHeight: '2.375rem', fontWeight: '700' }], // 30px
        'heading-2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],       // 24px
        'heading-3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],   // 20px
        'body-lg': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '400' }],    // 18px
        'body': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],            // 16px
        'body-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],    // 14px
        'caption': ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],        // 12px
        'overline': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600', letterSpacing: '0.05em' }], // 11px
      },

      // ── Border Radius — Design System Scale ──
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        'pill': '9999px',
      },

      // ── Box Shadow — Design System Scale ──
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(15, 23, 32, 0.05)',
        'sm': '0 1px 3px 0 rgba(15, 23, 32, 0.08), 0 1px 2px -1px rgba(15, 23, 32, 0.05)',
        'DEFAULT': '0 4px 6px -1px rgba(15, 23, 32, 0.08), 0 2px 4px -2px rgba(15, 23, 32, 0.05)',
        'md': '0 4px 6px -1px rgba(15, 23, 32, 0.08), 0 2px 4px -2px rgba(15, 23, 32, 0.05)',
        'lg': '0 10px 15px -3px rgba(15, 23, 32, 0.08), 0 4px 6px -4px rgba(15, 23, 32, 0.05)',
        'none': 'none',
      },

      // ── Spacing — Design System Scale (extends default) ──
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '16': '64px',
      },

      // ── Animation — Design System Timing ──
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '240': '240ms',
      },
    },
  },
  plugins: [],
};
