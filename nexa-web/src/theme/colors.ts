// Nexa-web unified color palette
export const colors = {
  // Primary colors (matching nexa-web SCSS variables)
  primary: {
    main: '#2563eb',      // matches $primary in _variables.scss
    light: '#60a5fa',     // lighter blue
    lighter: '#dbeafe',   // very light blue
    dark: '#1e40af',      // darker blue
  },

  // Backgrounds
  background: {
    primary: '#FAFBFC',
    secondary: '#f3f4f6',  // matches $light-gray
    tertiary: '#FFFFFF',   // matches $white
    hover: '#F3F4F6',
  },

  // Borders
  border: {
    light: '#F0F1F3',
    main: '#E6E8EB',
    dark: '#D1D5DB',
  },

  // Text
  text: {
    primary: '#111827',    // matches $black
    secondary: '#6B7280',  // matches $primary-light
    muted: '#9CA3AF',
    disabled: '#D1D5DB',
  },

  // Status colors
  status: {
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
  },

  // Node type colors (soft palette - aligned with nexa-web)
  node: {
    source: {
      main: '#06B6D4',      // cyan for source
      light: '#E0F2FE',
      border: '#67E8F9',
    },
    silver: {
      main: '#8B5CF6',      // purple for silver/curated
      light: '#F5F3FF',
      border: '#C4B5FD',
    },
    gold: {
      main: '#F59E0B',      // amber for gold/consumption
      light: '#FEF3C7',
      border: '#FCD34D',
    },
    transform: {
      main: '#2563eb',      // nexa-web blue for transformations
      light: '#dbeafe',
      border: '#93c5fd',
    },
  },

  // Shadows
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
};

// Border radius
export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

// Spacing
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
};
