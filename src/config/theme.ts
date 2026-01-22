// Design System - "SYNC" Theme
// Dark, modern palette with cyan accents

export const theme = {
  colors: {
    // Primary - Cyan/Teal accent
    primary: '#00D4FF',           // Main accent (cyan)
    primaryDark: '#00A8CC',       // Pressed/hover state
    primaryLight: '#4DE8FF',      // Lighter variant

    // Secondary - Soft blue-gray
    secondary: '#4A5568',         // Secondary actions
    secondaryDark: '#2D3748',     // Darker variant
    secondaryLight: '#718096',    // Lighter variant

    // Background - Dark theme
    background: '#0A0A0F',        // Main page background (dark)
    backgroundAlt: '#0D0D14',     // Alternate sections
    surface: '#12141C',           // Cards, modals
    surfaceElevated: '#1A1D28',   // Elevated cards
    surfaceSoft: '#1A1D28',       // Subtle surface

    // Text colors - Light on dark
    text: '#FFFFFF',              // Primary text (white)
    textSecondary: '#7A8599',     // Muted gray-blue
    textMuted: '#4A5568',         // Very muted (placeholder)
    textLight: '#7A8599',         // Alias for compatibility
    textAccent: '#00D4FF',        // Accent text (cyan)
    textOnPrimary: '#0A0A0F',     // Dark on primary buttons

    // Accent colors
    accent: '#00D4FF',            // Same as primary
    accentPink: '#FF6B9D',        // Vibrant pink (love/heart elements)
    accentMint: '#4ADE80',        // Bright mint (online)
    accentGold: '#FBBF24',        // Bright gold
    accentSky: '#38BDF8',         // Sky blue

    // Status colors
    success: '#4ADE80',           // Bright green
    warning: '#FBBF24',           // Bright gold
    error: '#FF6B6B',             // Bright red
    info: '#38BDF8',              // Sky blue

    // Online/Offline indicators
    online: '#4ADE80',            // Bright green dot
    offline: '#4A5568',           // Muted gray

    // Mood colors - Vibrant on dark
    moodHappy: '#FBBF24',         // Bright gold
    moodCalm: '#38BDF8',          // Sky blue
    moodNeutral: '#7A8599',       // Neutral gray
    moodSad: '#A78BFA',           // Purple
    moodAnxious: '#F472B6',       // Pink
    moodLoved: '#FF6B9D',         // Vibrant pink
    moodExcited: '#FB923C',       // Orange
    moodGrateful: '#4ADE80',      // Green

    // Borders & Dividers
    border: '#2A2D3A',            // Dark border
    borderLight: '#1F2937',       // Very subtle
    divider: '#2A2D3A',           // Divider line

    // Special effects
    glow: 'rgba(0, 212, 255, 0.2)',        // Cyan glow
    glowStrong: 'rgba(0, 212, 255, 0.4)', // Stronger glow
    overlay: 'rgba(0, 0, 0, 0.7)',        // Dark overlay
    overlayLight: 'rgba(0, 0, 0, 0.4)',   // Light overlay
  },

  // Gradient definitions
  gradients: {
    // Dark gradients
    background: ['#0A0A0F', '#0D0D14'],
    surface: ['#12141C', '#1A1D28'],
    card: ['#12141C', '#0D0D14'],

    // Accent gradients
    primary: ['#00D4FF', '#00A8CC'],
    rose: ['#FF6B9D', '#E91E63'],
    sage: ['#4ADE80', '#22C55E'],

    // Photo overlay gradient
    photoOverlay: ['transparent', 'rgba(0, 0, 0, 0.6)'],

    // Memories screen gradient
    memories: ['#0A0A0F', '#0D0D14', '#12141C'],
    memoriesAlt: ['#0A0A0F', '#0D0D14'],

    // Button gradients
    button: ['#00D4FF', '#00A8CC'],
    buttonSoft: ['#1A1D28', '#12141C'],

    // Tab bar
    tabBar: ['#0D0D14', '#0A0A0F'],

    // Dark ambient gradient
    cloud: ['#0A0A0F', '#0D0D14', '#12141C'],
  },

  typography: {
    fontFamily: {
      regular: 'SF Pro Display',
      medium: 'SF Pro Display',
      bold: 'SF Pro Display',
      rounded: 'SF Pro Rounded',
    },

    fontSize: {
      xs: 10,
      sm: 12,
      base: 14,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 28,
      '4xl': 36,
      '5xl': 48,
    },

    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    },

    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },

    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1,
      widest: 2,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    pill: 50,
    full: 9999,
  },

  shadows: {
    // Dark theme shadows
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    // Cyan glow effects
    glow: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    glowStrong: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    // Lifted button
    lifted: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  },

  animations: {
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },

    duration: {
      instant: 100,
      fast: 200,
      normal: 300,
      slow: 500,
      gentle: 700,
    },

    spring: {
      gentle: { tension: 40, friction: 7 },
      bouncy: { tension: 100, friction: 5 },
      stiff: { tension: 200, friction: 10 },
    },
  },

  // Card preset styles
  cards: {
    default: {
      backgroundColor: '#12141C',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: '#2A2D3A',
    },
    elevated: {
      backgroundColor: '#1A1D28',
      borderRadius: 24,
      padding: 20,
    },
    organic: {
      backgroundColor: '#12141C',
      borderRadius: 28,
      padding: 20,
    },
  },

  // Component-specific tokens
  components: {
    // Tab bar
    tabBar: {
      height: 80,
      fabSize: 56,
      iconSize: 24,
    },

    // Avatar
    avatar: {
      sm: 32,
      md: 48,
      lg: 64,
      xl: 80,
      borderWidth: 3,
    },

    // Input
    input: {
      height: 48,
      borderRadius: 12,
    },

    // Button
    button: {
      heightSm: 36,
      heightMd: 44,
      heightLg: 52,
    },
  },
};

export type Theme = typeof theme;

// Helper function to get gradient colors array
export const getGradient = (name: keyof typeof theme.gradients): string[] => {
  return theme.gradients[name] as string[];
};
