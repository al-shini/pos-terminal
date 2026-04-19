/**
 * Shini Extra Jordan — Brand & Design System tokens.
 *
 * Single source of truth for colors, spacing, radii, typography and shadows.
 * Import these tokens from anywhere in the app to stay on-brand.
 *
 *   import brand from 'theme/brand';
 *   <div style={{ background: brand.colors.primary }} />
 */

const brand = {
    name: 'Shini Extra Jordan',

    colors: {
        // Extracted from the official logo
        primary: '#E11E26',          // SHINI red
        primaryDark: '#B3141B',
        primaryLight: '#F8D7D9',
        primaryHover: '#C8161E',

        accent: '#2D2D2D',           // "extra" cursive / "JORDAN" text

        // Neutrals
        ink: '#111827',              // Headings
        text: '#1F2937',             // Body
        textMuted: '#6B7280',        // Secondary / hints
        textSubtle: '#9CA3AF',

        border: '#E5E7EB',
        borderStrong: '#D1D5DB',
        divider: '#F1F5F9',

        bg: '#F8FAFC',               // App background
        bgAlt: '#F3F4F6',
        paper: '#FFFFFF',

        // Semantic
        success: '#16A34A',
        successBg: '#DCFCE7',
        warning: '#D97706',
        warningBg: '#FEF3C7',
        danger: '#DC2626',
        dangerBg: '#FEE2E2',
        info: '#2563EB',
        infoBg: '#DBEAFE',
    },

    // Layered gradients for the branded hero panel
    gradients: {
        brandHero:
            'radial-gradient(1200px 600px at 20% 10%, rgba(225,30,38,0.10) 0%, rgba(225,30,38,0) 60%),' +
            'radial-gradient(900px 500px at 90% 90%, rgba(45,45,45,0.08) 0%, rgba(45,45,45,0) 60%),' +
            'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
        brandRedSoft:
            'linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 55%, #FFF5F5 100%)',
        primaryButton:
            'linear-gradient(135deg, #E11E26 0%, #B3141B 100%)',
    },

    radii: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        pill: 999,
    },

    spacing: (n) => `${n * 4}px`,

    shadows: {
        xs: '0 1px 2px rgba(17, 24, 39, 0.04)',
        sm: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
        md: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.04)',
        lg: '0 12px 32px rgba(17, 24, 39, 0.10), 0 4px 8px rgba(17, 24, 39, 0.04)',
        xl: '0 24px 48px rgba(17, 24, 39, 0.12)',
        brand: '0 10px 30px rgba(225, 30, 38, 0.25)',
    },

    typography: {
        fontFamily:
            '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
        monoFamily:
            '"JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace',
        weights: {
            regular: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            heavy: 800,
        },
    },
};

export default brand;
