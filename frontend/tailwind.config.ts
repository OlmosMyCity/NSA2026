import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/domain/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core Brand Palette (HSL CSS variables)
        blueberry: 'hsl(var(--hsl-blueberry) / <alpha-value>)',
        berry: 'hsl(var(--hsl-berry) / <alpha-value>)',
        stem: 'hsl(var(--hsl-stem) / <alpha-value>)',
        yogurt: 'hsl(var(--hsl-yogurt) / <alpha-value>)',
        plate: 'hsl(var(--hsl-plate) / <alpha-value>)',

        // Semantic Surfaces & Ink
        canvas: 'hsl(var(--hsl-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--hsl-surface-elevated) / 0.56)',
          tinted: 'hsl(var(--hsl-surface-tinted) / 0.52)',
          subtle: 'hsl(var(--hsl-surface-subtle) / 0.62)',
          hover: 'hsl(var(--hsl-surface-hover) / 0.78)',
        },
        line: {
          DEFAULT: 'hsl(var(--hsl-border-subtle) / <alpha-value>)',
          strong: 'var(--border-strong)',
        },

        // Clinical Telemetry Semantics (Harmonized HSL)
        status: {
          nominal: 'hsl(var(--hsl-status-nominal) / <alpha-value>)',
          caution: 'hsl(var(--hsl-status-caution) / <alpha-value>)',
          critical: 'hsl(var(--hsl-status-critical) / <alpha-value>)',
        },
      },
      textColor: {
        // Text hierarchy adapted to web1.jpg (Plate White, Luminous Berry, Warm Lunar Stem)
        blueberry: 'hsl(var(--hsl-ink-primary) / <alpha-value>)',
        berry: 'hsl(var(--hsl-ink-secondary) / <alpha-value>)',
        stem: 'hsl(var(--hsl-ink-muted) / <alpha-value>)',
        'ink-inverse': 'hsl(var(--hsl-blueberry) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1.45' }],
        sm: ['var(--text-sm)', { lineHeight: '1.5' }],
        base: ['var(--text-base)', { lineHeight: '1.6' }],
        lg: ['var(--text-lg)', { lineHeight: '1.5' }],
        xl: ['var(--text-xl)', { lineHeight: '1.35', letterSpacing: '-0.015em' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        display: ['var(--text-display)', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        spring: 'var(--ease-spring)',
      },
      transitionDuration: {
        press: 'var(--duration-press)',
        ui: 'var(--duration-ui)',
        panel: 'var(--duration-panel)',
      },
      maxWidth: {
        container: 'var(--container-max)',
      },
    },
  },
  plugins: [],
};

export default config;
