/** @type {import('tailwindcss').Config} */
const v = name => `var(--${name})`

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries([
        'bg', 'panel', 'fill', 'fill-2', 'line', 'line-2', 'ink', 'ink-2', 'muted', 'faint',
        'niamh', 'niamh-text', 'niamh-light', 'rupert', 'rupert-text', 'rupert-light', 'joint', 'joint-text', 'joint-light',
        'pos', 'pos-tint', 'neg', 'neg-tint', 'warn', 'warn-tint', 'spend', 'save', 'save-tint', 'free', 'on-ink',
        // Legacy names, aliased to the palette above in globals.css
        'surface', 'card', 'border', 'positive', 'negative', 'income-bg', 'income-text', 'expense-bg', 'expense-text',
        'savings-bg', 'savings-text', 'pension', 'pension-light', 'accent', 'accent-light',
      ].map(n => [n, v(n)])),
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        // Headline figures are Inter now; the serif is reserved for the logo.
        serif: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'serif'],
      },
      // Named steps; nothing under 12px.
      fontSize: {
        caption: ['12px', '16px'],
        label: ['13px', '18px'],
        body: ['15px', '20px'],
        lead: ['17px', '22px'],
      },
      letterSpacing: {
        label: '0.07em',
      },
      borderRadius: {
        panel: '22px',
      },
    },
  },
  plugins: [],
}
