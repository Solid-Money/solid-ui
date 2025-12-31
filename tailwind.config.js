import { platformSelect } from 'nativewind/theme';

const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        system: platformSelect({
          ios: 'MonaSans_400Regular',
          android: 'MonaSans_400Regular',
          web: "MonaSans_400Regular, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }),
      },
      borderRadius: {
        twice: '1.25rem',
      },
      fontSize: platformSelect({
        native: {
          xs: '1rem',
          sm: '1.125rem',
          base: '1.25rem',
          lg: '1.375rem',
          xl: '1.5rem',
          '2xl': '1.75rem',
          '3xl': '2.125rem',
          '4xl': '2.75rem',
          '5xl': '3.5rem',
        },
        default: {
          '3.5xl': '2.125rem',
          '4.5xl': '2.5rem',
        },
      }),
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'color-mix(in srgb, hsl(var(--primary)) 90%, white 10%)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          hover: 'color-mix(in srgb, hsl(var(--secondary)) 90%, white 10%)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          hover: 'color-mix(in srgb, hsl(var(--destructive)) 90%, white 10%)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          hover: 'color-mix(in srgb, hsl(var(--accent)) 90%, white 10%)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          hover: 'hsl(var(--card-hover))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          hover: 'color-mix(in srgb, hsl(var(--brand)) 90%, white 30%)',
        },
        points: {
          DEFAULT: 'hsl(var(--points))',
        },
        'qr-background': {
          DEFAULT: 'hsl(var(--qr-background))',
          foreground: 'hsl(var(--qr-foreground))',
        },
        'modal-background': {
          DEFAULT: 'hsl(var(--modal-background))',
        },
        popup: {
          DEFAULT: 'hsl(var(--popup))',
        },
        'button-secondary': {
          DEFAULT: 'hsl(var(--button-secondary))',
          foreground: 'hsl(var(--button-secondary-foreground))',
        },
        'button-earning': {
          DEFAULT: 'hsl(var(--button-earning))',
          foreground: 'hsl(var(--button-earning-foreground))',
        },
        'button-dark': {
          DEFAULT: 'hsl(var(--button-dark))',
          foreground: 'hsl(var(--button-dark-foreground))',
        },
        purple: {
          DEFAULT: 'hsl(var(--purple))',
          hover: 'color-mix(in srgb, hsl(var(--purple)) 90%, white 10%)',
        },
        rewards: {
          DEFAULT: 'hsl(var(--rewards))',
          hover: 'color-mix(in srgb, hsl(var(--rewards)) 90%, white 10%)',
        },
        indigo: {
          DEFAULT: 'hsl(var(--indigo))',
        },
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      screens: {
        xs: '425px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
