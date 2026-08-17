/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        flostat: {
          primary: '#0B3B91',
          'primary-hover': '#082C6E',
          'primary-light': '#EEF2FF',
          secondary: '#2563EB',
          'secondary-light': '#DBEAFE',
          success: '#22C55E',
          'success-light': '#DCFCE7',
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          danger: '#EF4444',
          'danger-light': '#FEE2E2',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E5E7EB',
          text: '#0F172A',
          muted: '#64748B',
        },
        dark: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E5E7EB',
          text: '#0F172A',
          muted: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        'xl': '12px',
      },
      boxShadow: {
        'flostat': '0 4px 20px -2px rgba(11, 59, 145, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'flostat-hover': '0 10px 25px -5px rgba(11, 59, 145, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
