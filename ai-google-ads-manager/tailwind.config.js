/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './utils/**/*.{js,ts,jsx,tsx,mdx}',
    './contexts/**/*.{js,ts,jsx,tsx,mdx}',
    // Add Tremor content paths
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Add Tremor colors for proper chart rendering
        tremor: {
          brand: {
            faint: "#eff6ff", // blue-50
            muted: "#bfdbfe", // blue-200
            subtle: "#60a5fa", // blue-400
            DEFAULT: "#3b82f6", // blue-500
            emphasis: "#1d4ed8", // blue-700
            inverted: "#ffffff", // white
          },
          background: {
            muted: "#f9fafb", // gray-50
            subtle: "#f3f4f6", // gray-100
            DEFAULT: "#ffffff", // white
            emphasis: "#374151", // gray-700
          },
          border: {
            DEFAULT: "#e5e7eb", // gray-200
          },
          ring: {
            DEFAULT: "#e5e7eb", // gray-200
          },
          content: {
            subtle: "#9ca3af", // gray-400
            DEFAULT: "#6b7280", // gray-500
            emphasis: "#374151", // gray-700
            strong: "#111827", // gray-900
            inverted: "#ffffff", // white
          },
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        destructive: {
          DEFAULT: 'var(--color-error)',
          foreground: 'var(--destructive-foreground)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        info: 'var(--info)',
        
        // Modern SaaS Colors
        'saas-primary': {
          DEFAULT: 'var(--saas-primary)',
          dark: 'var(--saas-primary-dark)',
          light: 'var(--saas-primary-light)',
        },
        'saas-secondary': 'var(--saas-secondary)',
        'saas-accent': 'var(--saas-accent)',
        'saas-success': 'var(--saas-success)',
        'saas-warning': 'var(--saas-warning)',
        'saas-error': 'var(--saas-error)',
        'saas-info': 'var(--saas-info)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
  safelist: [
    // Tremor color classes
    {
      pattern: /^(bg|text|fill|stroke|border)-tremor-/,
    },
    // These are the colors used by Tremor charts
    {
      pattern: /^(bg|text|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover', 'ui-selected'],
    },
    // Specific Tremor chart colors
    'fill-blue-500',
    'fill-emerald-500',
    'fill-violet-500',
    'fill-amber-500',
    'fill-rose-500',
    'fill-cyan-500',
    'fill-indigo-500',
    'fill-orange-500',
    'fill-purple-500',
    'fill-green-500',
    'fill-red-500',
    'fill-yellow-500',
    'fill-pink-500',
    'fill-teal-500',
  ],
} 