/**
 * Nexa-Web Unified Theme
 *
 * Central export for all theme-related constants and utilities.
 * This theme is aligned with nexa-web's SCSS variables to ensure
 * consistent styling across all screens (both native and integrated).
 *
 * SCSS Variables Reference: src/scss/abstracts/_variables.scss
 * - $primary: #2563eb
 * - $font-primary: "Inter", sans-serif
 * - Font sizes: $small (0.75rem), $medium (0.875rem), $large (1rem), $xlarge (1.25rem)
 */

export * from './colors';
export * from './typography';

// Re-export commonly used items for convenience
export { colors } from './colors';
export { typography, getTypographyStyle } from './typography';
