import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        amc: {
          bg: '#ffffff',
          panel: '#f8fafc',
          border: '#e2e8f0',
          accent: '#2563eb',
          success: '#059669',
          warning: '#d97706',
          danger: '#dc2626',
          idle: '#94a3b8',
          working: '#2563eb',
          thinking: '#7c3aed',
          blocked: '#dc2626',
          communicating: '#059669',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(37, 99, 235, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.5)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
