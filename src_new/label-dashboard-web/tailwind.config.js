/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  prefix: 'tw-',                     // prevents ALL Bootstrap/Tailwind naming conflicts
  // preflight enabled: Bootstrap CDN removed in Phase 5
  theme: {
    screens: {
      // Matches Bootstrap 5 breakpoints exactly
      sm: '576px',
      md: '768px',
      lg: '992px',
      xl: '1200px',
      '2xl': '1400px',
    },
    extend: {
      colors: {
        body: '#4a5568',
        heading: '#2d3748',
        muted: '#9ca3af',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#ef4444',
        'danger-dark': '#dc2626',
        info: '#0891b2',
        'input-bg': '#f9fafb',
        'input-bg-focus': '#ffffff',
        'input-bg-hover': '#f3f4f6',
        surface: '#ffffff',
        'border-subtle': '#e5e7eb',
        'border-default': '#dee2e6',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Inter"', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        'card-mobile': '8px',
        input: '8px',
        btn: '8px',
        badge: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        dropdown: '0 4px 16px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        modal: '0 10px 40px rgba(0,0,0,0.3)',
        'focus-ring': '0 0 0 3px rgba(59,130,246,0.1)',
      },
      spacing: {
        'navbar-height': '50px',
        'sidebar-width': '260px',
        'sidebar-collapsed-width': '86px',
        'mobile-nav-height': '72px',
        'card-pad': '28px',
        'card-pad-mobile': '20px',
        'grid-gap': '12px',
        'grid-gap-mobile': '8px',
      },
      zIndex: {
        sidebar: '1000',
        navbar: '1001',
        dropdown: '1050',
        'modal-bd': '1040',
        modal: '1050',
        'mobile-nav': '1100',
        overlay: '9999',
      },
    },
  },
  plugins: [],
};
