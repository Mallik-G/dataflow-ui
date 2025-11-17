/**
 * Typography Configuration
 *
 * Unified typography system matching nexa-web SCSS variables
 * Font family: Inter (from _variables.scss)
 */

export const typography = {
  // Font families (matching nexa-web SCSS)
  fontFamily: {
    primary: '"Inter", sans-serif',     // matches $font-primary
    secondary: '"Inter", sans-serif',   // matches $font-secondary
    mono: '"Courier New", monospace',
  },

  // Font sizes (matching nexa-web SCSS variables)
  fontSize: {
    small: '0.75rem',     // 12px - matches $small
    medium: '0.875rem',   // 14px - matches $medium
    large: '1rem',        // 16px - matches $large
    xlarge: '1.25rem',    // 20px - matches $xlarge
    xxlarge: '1.5rem',    // 24px
    xxxlarge: '2rem',     // 32px
  },

  // Font weights
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
  },
};

// Utility function to get font style
export const getTypographyStyle = (
  size: keyof typeof typography.fontSize = 'large',
  weight: keyof typeof typography.fontWeight = 'regular'
) => ({
  fontFamily: typography.fontFamily.primary,
  fontSize: typography.fontSize[size],
  fontWeight: typography.fontWeight[weight],
  lineHeight: typography.lineHeight.normal,
});
