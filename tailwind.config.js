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
          navy: '#0A1F44',
          'navy-light': '#162F5E',
          'navy-dark': '#06132B',
          aqua: '#00B4D8',
          'aqua-hover': '#0096B4',
          'aqua-light': '#E0F7FA',
          primary: '#00B4D8',
          'primary-hover': '#0096B4',
          'primary-light': '#E0F7FA',
          secondary: '#4B5563',
          'secondary-light': '#9CA3AF',
          highlight: '#C0C0C0',
          border: '#C0C0C0',
          'border-light': '#E2E8F0',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: '#1A1A1A',
          muted: '#4B5563',
          success: '#10B981',
          'success-light': '#ECFDF5',
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          danger: '#EF4444',
          'danger-light': '#FEE2E2',
        },
        dark: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#C0C0C0',
          text: '#1A1A1A',
          muted: '#4B5563',
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
        'flostat': '0 4px 20px -2px rgba(10, 31, 68, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'flostat-hover': '0 10px 25px -5px rgba(0, 180, 216, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        'flostat-aqua': '0 4px 14px 0 rgba(0, 180, 216, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
