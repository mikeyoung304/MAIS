/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // HANDLED Graphite Dark Theme (brand refresh 2025-12-28)
        // Dark graphite backgrounds with Electric Sage accent
        surface: '#18181B', // Dark graphite background
        'surface-alt': '#27272A', // Slightly lighter graphite for cards/sections
        // Electric Sage accent on dark
        sage: '#45B37F', // Electric Sage - pops on dark
        'sage-hover': '#5CC98F', // Lighter on hover for dark mode
        'sage-light': '#6BC495', // Decorative
        'sage-text': '#45B37F', // Sage is readable on dark backgrounds
        // Text colors for dark mode
        'text-primary': '#FAFAFA', // Near-white text
        'text-muted': '#A1A1AA', // Muted gray text

        // Macon Brand Colors - New Default Palette
        'macon-navy': {
          DEFAULT: '#1a365d',
          dark: '#0f2442',
          light: '#2d4a7c',
          // Standard scale: 50=lightest (backgrounds), 900=darkest (backgrounds)
          // For TEXT on dark bg: use white, white/80, white/60
          // For TEXT on light bg: use 600, 700, 800, 900
          50: '#f8fafc', // Lightest - subtle bg tint
          100: '#e2e8f0', // Very light bg
          200: '#cbd5e1', // Light bg
          300: '#94a3b8', // Medium light
          400: '#64748b', // Medium
          500: '#475569', // Medium dark
          600: '#334155', // Dark - good for text on light bg
          700: '#1e3a5f', // Navy dark - bg color
          800: '#152e4d', // Navy darker - bg color
          900: '#0c1f3a', // Navy darkest - bg color
        },
        'macon-orange': {
          DEFAULT: '#d97706', // WCAG AA: 4.54:1 (was #fb923c at 2.26:1)
          dark: '#b45309', // WCAG AA: 6.51:1
          light: '#fbbf24', // Keep existing (decorative use)
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
          DEFAULT: '#0d9488', // WCAG AA: 4.55:1 (was #38b2ac at 2.58:1)
          dark: '#0f766e', // WCAG AA: 6.39:1
          light: '#5eead4', // Keep existing (decorative use)
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
        // Neutral grays
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
        // Status colors
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
        // Legacy Lavender/Purple palette (for tenant customization)
        lavender: {
          50: '#F5F6FA',
          100: '#ECEEF5',
          200: '#E0E3EE',
          300: '#D5D8E8',
          400: '#C5C9DD',
          500: '#B0B5D0',
          600: '#9198BE',
          700: '#7179A3',
          800: '#5A608A',
          900: '#464B6F',
        },
        navy: {
          50: '#F1F2F6',
          100: '#E3E5EB',
          200: '#C7CAD7',
          300: '#A3A8BE',
          400: '#7E84A0',
          500: '#5A6082',
          600: '#4A4E69',
          700: '#3D405B',
          800: '#30334D',
          900: '#24263F',
        },
        purple: {
          50: '#F5F3F9',
          100: '#EBE7F3',
          200: '#D7CFE7',
          300: '#C3B7DB',
          400: '#A593C9',
          500: '#8770B7',
          600: '#6F5B9A',
          700: '#58477D',
          800: '#413460',
          900: '#2B2343',
        },
        // Semantic color tokens - Updated to Macon defaults
        primary: {
          DEFAULT: '#1a365d', // Macon Navy
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#d97706', // Macon Orange (WCAG AA compliant)
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#f3f4f6', // Neutral 100
          foreground: '#6b7280', // Neutral 500
        },
        accent: {
          DEFAULT: '#0d9488', // Macon Teal (WCAG AA compliant)
          foreground: '#FFFFFF',
        },
        border: '#e5e7eb', // Neutral 200
        input: '#e5e7eb', // Neutral 200
        background: '#ffffff', // White background
        foreground: '#111827', // Neutral 900 - dark text
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        // Typography scale - ENHANCED for better readability (rem units for accessibility)
        hero: ['4.5rem', { lineHeight: '1.15', fontWeight: '700' }],
        h1: ['3.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['3rem', { lineHeight: '1.25', fontWeight: '700' }],
        h3: ['2rem', { lineHeight: '1.3', fontWeight: '700' }],
        subtitle: ['1.375rem', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem',
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        // Legacy shadows
        subtle: '0 2px 4px rgba(0, 0, 0, 0.2)',
        elegant: '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        lifted: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
        // Macon elevation system
        'elevation-1': '0 1px 3px rgba(10, 37, 64, 0.12), 0 1px 2px rgba(10, 37, 64, 0.24)',
        'elevation-2':
          '0 4px 6px -1px rgba(10, 37, 64, 0.1), 0 2px 4px -1px rgba(10, 37, 64, 0.06)',
        'elevation-3':
          '0 10px 15px -3px rgba(10, 37, 64, 0.1), 0 4px 6px -2px rgba(10, 37, 64, 0.05)',
        'elevation-4':
          '0 20px 25px -5px rgba(10, 37, 64, 0.1), 0 10px 10px -5px rgba(10, 37, 64, 0.04)',
        soft: '0 2px 8px -2px rgba(10, 37, 64, 0.06), 0 2px 4px -2px rgba(10, 37, 64, 0.04)',
        medium: '0 8px 16px -4px rgba(10, 37, 64, 0.08), 0 4px 8px -4px rgba(10, 37, 64, 0.06)',
        large: '0 16px 32px -8px rgba(10, 37, 64, 0.10), 0 8px 16px -8px rgba(10, 37, 64, 0.08)',
        // Glow effects
        'glow-orange': '0 0 20px rgba(217, 119, 6, 0.4)',
        'glow-teal': '0 0 20px rgba(13, 148, 136, 0.4)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-urgent': '0 0 20px rgba(239, 68, 68, 0.4)',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%)',
        'gradient-orange': 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
        'gradient-teal': 'linear-gradient(135deg, #0d9488 0%, #5eead4 100%)',
      },
      backdropBlur: {
        xs: '2px',
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
