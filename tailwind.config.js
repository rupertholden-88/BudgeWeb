/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        surface: 'var(--surface)',
        card: 'var(--card)',
        border: 'var(--border)',
        niamh: 'var(--niamh)',
        'niamh-light': 'var(--niamh-light)',
        rupert: 'var(--rupert)',
        'rupert-light': 'var(--rupert-light)',
        joint: 'var(--joint)',
        'joint-light': 'var(--joint-light)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        'income-bg': 'var(--income-bg)',
        'income-text': 'var(--income-text)',
        'expense-bg': 'var(--expense-bg)',
        'expense-text': 'var(--expense-text)',
        'savings-bg': 'var(--savings-bg)',
        'savings-text': 'var(--savings-text)',
        pension: 'var(--pension)',
        'pension-light': 'var(--pension-light)',
        accent: 'var(--accent)',
        'accent-light': 'var(--accent-light)',
        'on-ink': 'var(--on-ink)',
      },
      // Named steps instead of one-off pixel sizes.
      fontSize: {
        caption: ['10px', '14px'],
        label: ['11px', '15px'],
        body: ['13px', '18px'],
        lead: ['15px', '20px'],
      },
      letterSpacing: {
        label: '0.08em',
      },
    },
  },
  plugins: [],
}
