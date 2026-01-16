import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sage Green - Primary brand color (trustworthy, calm)
        sage: {
          50: '#f6f7f6',
          100: '#e3e7e3',
          200: '#c7d0c7',
          300: '#a3b1a3',
          400: '#7d8f7d',
          500: '#627362',
          600: '#4d5c4d',
          700: '#404b40',
          800: '#363e36',
          900: '#2f352f',
          950: '#181c18',
        },
        // Warm Gray - Secondary, professional (adjusted for readability)
        warmgray: {
          50: '#f9f8f7',
          100: '#f3f1ef',
          200: '#e8e4e0',
          300: '#d9d3cc',
          400: '#a8a099',  // darker than before
          500: '#8a827a',  // darker than before
          600: '#6b635c',  // darker than before
          700: '#524b46',  // darker than before
          800: '#3d3835',  // darker than before
          900: '#1f1c1a',  // much darker - almost black
          950: '#0f0e0d',  // near black
        },
        // Cream White - Background, clean
        cream: {
          50: '#fdfcfa',
          100: '#faf8f4',
          200: '#f5f2eb',
          300: '#ede8dd',
          400: '#e2dace',
          500: '#d4cabf',
          600: '#c0b4a7',
          700: '#a89a8c',
          800: '#8a7e72',
          900: '#72685e',
          950: '#3c3632',
        },
        // Functional colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      fontSize: {
        // Larger base sizes for better readability
        'xs': ['0.875rem', { lineHeight: '1.4' }],
        'sm': ['0.9375rem', { lineHeight: '1.5' }],
        'base': ['1.0625rem', { lineHeight: '1.6' }],
        'lg': ['1.1875rem', { lineHeight: '1.6' }],
        'xl': ['1.375rem', { lineHeight: '1.5' }],
        '2xl': ['1.625rem', { lineHeight: '1.4' }],
        '3xl': ['2rem', { lineHeight: '1.3' }],
        '4xl': ['2.5rem', { lineHeight: '1.2' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in': 'slide-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
