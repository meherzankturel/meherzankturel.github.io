// Design System - "SYNC" Theme
// Light, playful doodle aesthetic with purple/pink accents

export const theme = {
  colors: {
    // Primary - Vibrant Purple
    primary: '#7f13ec',           // Main accent (purple)
    primaryDark: '#6910c2',       // Pressed/hover state
    primaryLight: '#a855f7',      // Lighter variant

    // Secondary - Soft Pink
    secondary: '#ff85a2',         // Secondary actions (pink)
    secondaryDark: '#e6758f',     // Darker variant
    secondaryLight: '#ffb3c4',    // Lighter variant

    // Background - Light theme
    background: '#fefefe',        // Main page background (cream white)
    backgroundAlt: '#faf8f5',     // Alternate sections (warm white)
    surface: '#ffffff',           // Cards, modals
    surfaceElevated: '#ffffff',   // Elevated cards
    surfaceSoft: '#f8f5ff',       // Subtle purple tint surface

    // Text colors - Dark on light
    text: '#141118',              // Primary text (dark)
    textSecondary: '#756189',     // Muted purple-gray
    textMuted: '#9a8ba8',         // Very muted (placeholder)
    textLight: '#756189',         // Alias for compatibility
    textAccent: '#7f13ec',        // Accent text (purple)
    textOnPrimary: '#ffffff',     // White on primary buttons

    // Doodle accent colors
    accent: '#7f13ec',            // Same as primary
    accentPink: '#ff85a2',        // Doodle pink
    accentMint: '#4ADE80',        // Bright mint (online)
    accentGold: '#FBBF24',        // Bright gold
    accentSky: '#38BDF8',         // Sky blue
    doodlePink: '#ff85a2',        // Doodle pink
    doodlePurple: '#a855f7',      // Light purple

    // Status colors
    success: '#4ADE80',           // Bright green
    warning: '#FBBF24',           // Bright gold
    error: '#FF6B6B',             // Bright red
    info: '#38BDF8',              // Sky blue

    // Online/Offline indicators
    online: '#4ADE80',            // Bright green dot
    offline: '#9a8ba8',           // Muted purple-gray

    // Mood colors - Vibrant on light
    moodHappy: '#FBBF24',         // Bright gold
    moodCalm: '#38BDF8',          // Sky blue
    moodNeutral: '#756189',       // Neutral purple-gray
    moodSad: '#A78BFA',           // Purple
    moodAnxious: '#F472B6',       // Pink
    moodLoved: '#ff85a2',         // Doodle pink
    moodExcited: '#FB923C',       // Orange
    moodGrateful: '#4ADE80',      // Green

    // Borders & Dividers
    border: '#e8e0f0',            // Light purple border
    borderLight: '#f0ebf7',       // Very subtle purple
    divider: '#e8e0f0',           // Divider line

    // Special effects
    glow: 'rgba(127, 19, 236, 0.15)',      // Purple glow
    glowStrong: 'rgba(127, 19, 236, 0.3)', // Stronger glow
    overlay: 'rgba(20, 17, 24, 0.7)',      // Dark overlay
    overlayLight: 'rgba(20, 17, 24, 0.4)', // Light overlay
  },

  // Gradient definitions
  gradients: {
    // Light gradients
    background: ['#fefefe', '#faf8f5'],
    surface: ['#ffffff', '#f8f5ff'],
    card: ['#ffffff', '#fefefe'],

    // Accent gradients
    primary: ['#7f13ec', '#6910c2'],
    rose: ['#ff85a2', '#e6758f'],
    sage: ['#4ADE80', '#22C55E'],

    // Photo overlay gradient
    photoOverlay: ['transparent', 'rgba(20, 17, 24, 0.4)'],

    // Memories screen gradient
    memories: ['#fefefe', '#faf8f5', '#f8f5ff'],
    memoriesAlt: ['#fefefe', '#faf8f5'],

    // Button gradients
    button: ['#7f13ec', '#6910c2'],
    buttonSoft: ['#f8f5ff', '#ffffff'],

    // Tab bar
    tabBar: ['#fefefe', '#fefefe'],

    // Light ambient gradient
    cloud: ['#fefefe', '#faf8f5', '#f8f5ff'],
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
    // Light theme shadows
    sm: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    // Purple glow effects
    glow: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    glowStrong: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 10,
    },
    // Lifted button
    lifted: {
      shadowColor: '#7f13ec',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
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
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: '#e8e0f0',
    },
    elevated: {
      backgroundColor: '#ffffff',
      borderRadius: 24,
      padding: 20,
    },
    organic: {
      backgroundColor: '#f8f5ff',
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

  // Doodle-specific utilities
  doodle: {
    // Hand-drawn border radii (asymmetric for organic feel)
    handDrawnFrame: {
      borderRadius: 24,
      // Note: Use borderTopLeftRadius, borderTopRightRadius etc. individually for full effect
    },
    wobblyBorder: {
      borderWidth: 1.5,
      borderColor: '#a855f7',
      borderRadius: 20,
    },
    organicAvatar: {
      borderRadius: 24, // Slightly squared circle
    },
    // Scribble background pattern positions
    scribblePositions: {
      topRight: { top: 20, right: 20 },
      bottomLeft: { bottom: 60, left: 16 },
      center: { top: '50%', right: 8 },
    },
  },
};

export type Theme = typeof theme;

// Helper function to get gradient colors array
export const getGradient = (name: keyof typeof theme.gradients): string[] => {
  return theme.gradients[name] as string[];
};

// Doodle-specific style helpers
export const doodleStyles = {
  // Hand-drawn frame style (apply to View)
  handDrawnFrame: {
    borderWidth: 2,
    borderColor: '#141118',
    borderRadius: 24,
    // For a more organic look, apply slightly different radii to each corner
  },
  // Wobbly/scribble border for cards
  wobblyBorder: {
    borderWidth: 1.5,
    borderColor: '#a855f7',
    borderRadius: 20,
  },
  // Tape decoration style
  tapeDecoration: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    width: 48,
    height: 20,
    transform: [{ rotate: '-15deg' }],
  },
  // Pink scribble fill pattern
  scribblePinkFill: {
    backgroundColor: 'rgba(255, 133, 162, 0.2)',
  },
  // Purple scribble fill pattern  
  scribblePurpleFill: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
};
