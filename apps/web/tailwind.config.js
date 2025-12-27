/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // HANDLED Landing Page Palette (WCAG AA compliant)
        // Sage-forward, warm cream backgrounds, earthy and professional
        surface: '#FFFBF8',
        'surface-alt': '#F5F1EE',

        // Primary: Sage - growth, trust, professionalism
        'sage': '#4A7C6F',
        'sage-hover': '#3D6B5F',
        'sage-light': '#8FAA9E',

        // Text colors
        'text-primary': '#1A1815',
        'text-muted': '#4A4440',

        // Macon Brand Colors
        'macon-navy': {
          DEFAULT: '#1a365d',
          dark: '#0f2442',
          light: '#2d4a7c',
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e3a5f',
          800: '#152e4d',
          900: '#0c1f3a',
        },
        'macon-orange': {
          DEFAULT: '#d97706',
          dark: '#b45309',
          light: '#fbbf24',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        'macon-teal': {
          DEFAULT: '#0d9488',
          dark: '#0f766e',
          light: '#5eead4',
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        warning: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Semantic tokens
        primary: {
          DEFAULT: '#1a365d',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#d97706',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#f3f4f6',
          foreground: '#6b7280',
        },
        accent: {
          DEFAULT: '#0d9488',
          foreground: '#FFFFFF',
        },
        border: '#e5e7eb',
        input: '#e5e7eb',
        background: '#ffffff',
        foreground: '#111827',
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        'hero': ['4.5rem', { lineHeight: '1.15', fontWeight: '700' }],
        'h1': ['3.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['3rem', { lineHeight: '1.25', fontWeight: '700' }],
        'h3': ['2rem', { lineHeight: '1.3', fontWeight: '700' }],
        'subtitle': ['1.375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        DEFAULT: '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'subtle': '0 2px 4px rgba(0, 0, 0, 0.2)',
        'elegant': '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        'lifted': '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        'elevation-1': '0 1px 3px rgba(10, 37, 64, 0.12), 0 1px 2px rgba(10, 37, 64, 0.24)',
        'elevation-2': '0 4px 6px -1px rgba(10, 37, 64, 0.1), 0 2px 4px -1px rgba(10, 37, 64, 0.06)',
        'elevation-3': '0 10px 15px -3px rgba(10, 37, 64, 0.1), 0 4px 6px -2px rgba(10, 37, 64, 0.05)',
        'elevation-4': '0 20px 25px -5px rgba(10, 37, 64, 0.1), 0 10px 10px -5px rgba(10, 37, 64, 0.04)',
        'soft': '0 2px 8px -2px rgba(10, 37, 64, 0.06), 0 2px 4px -2px rgba(10, 37, 64, 0.04)',
        'medium': '0 8px 16px -4px rgba(10, 37, 64, 0.08), 0 4px 8px -4px rgba(10, 37, 64, 0.06)',
        'large': '0 16px 32px -8px rgba(10, 37, 64, 0.10), 0 8px 16px -8px rgba(10, 37, 64, 0.08)',
        'glow-orange': '0 0 20px rgba(217, 119, 6, 0.4)',
        'glow-teal': '0 0 20px rgba(13, 148, 136, 0.4)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-urgent': '0 0 20px rgba(239, 68, 68, 0.4)',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%)',
        'gradient-orange': 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
        'gradient-teal': 'linear-gradient(135deg, #0d9488 0%, #5eead4 100%)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
