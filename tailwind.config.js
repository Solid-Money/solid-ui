import { platformSelect } from "nativewind/theme";

const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        system: platformSelect({
          ios: 'MonaSans',
          android: 'MonaSans_400Regular',
        }),
      },
      borderRadius: {
        'twice': '1.25rem',
      },
      fontSize: {
        '4.5xl': '2.5rem',
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
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
        },
        rewards: {
          DEFAULT: 'hsl(var(--rewards))',
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
    },
  },
  plugins: [require('tailwindcss-animate')],
};
