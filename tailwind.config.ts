import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#F2F3F5',
        card:     '#FFFFFF',
        input:    '#F2F3F5',
        hover:    '#ECEDF0',
        active:   '#E5E6EA',
        border:   '#E0E1E6',
        border2:  '#CDD0D8',
        tx:       '#1A1C21',
        tx2:      '#5A5E72',
        tx3:      '#9498AB',
        accent:   '#F0B90B',
        blue:     '#1E6FEB',
        send:     '#2AABEE',
        green:    '#00B173',
        red:      '#E8251F',
      },
      fontFamily: {
        sans:    ['var(--font-unbounded)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
        display: ['var(--font-unbounded)', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}

export default config
