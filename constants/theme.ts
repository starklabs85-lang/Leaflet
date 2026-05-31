import type { TextStyle, ViewStyle } from "react-native";

/**
 * Leaflet design tokens.
 *
 * The original token names are preserved (they are referenced across every
 * screen). Values were gently warmed/softened and new tokens were added to
 * support gradients, depth, custom type, and to retire hardcoded hexes.
 */

const colors = {
  paper: "#FAF6EA",
  forest: "#1C3F31",
  leaf: "#3A6F2E",
  // Fresh, bright green for highlights and gradient stops.
  canopy: "#4E9F3D",
  leafMuted: "#E7F0DC",
  moss: "#68755E",
  terra: "#8A432E",
  ochre: "#8E5A00",
  // Warm cream — replaces hardcoded #FFF1CC / #F7E8B8.
  honey: "#FBEAC0",
  blush: "#F3D8C7",
  // Soft cool tint for variety (diagnosis / info surfaces).
  mist: "#E1EDE9",
  line: "#DAD2C0",
  ink: "#1F241F",
  white: "#FFFFFF"
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  // Softer default for cards/surfaces.
  card: 20,
  xl: 28,
  pill: 999
} as const;

const fontFamily = {
  display: "Fredoka_600SemiBold",
  displayBold: "Fredoka_700Bold",
  body: "Nunito_400Regular",
  bodyMedium: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  bodyBlack: "Nunito_800ExtraBold"
} as const;

const typography = {
  caption: 12,
  body: 16,
  heading: 18,
  title: 24,
  display: 36,
  hero: 40,
  fontFamily
} as const;

/**
 * Ready-made text style presets. Spread or assign these instead of repeating
 * `fontFamily` + size + color on every screen. Custom fonts already carry their
 * weight, so presets intentionally omit `fontWeight`.
 */
const text = {
  hero: {
    color: colors.forest,
    fontFamily: fontFamily.displayBold,
    fontSize: 40,
    lineHeight: 44
  },
  display: {
    color: colors.forest,
    fontFamily: fontFamily.displayBold,
    fontSize: 34,
    lineHeight: 40
  },
  title: {
    color: colors.forest,
    fontFamily: fontFamily.display,
    fontSize: 24,
    lineHeight: 30
  },
  heading: {
    color: colors.forest,
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 24
  },
  body: {
    color: colors.ink,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24
  },
  bodyStrong: {
    color: colors.forest,
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    lineHeight: 24
  },
  bodyMuted: {
    color: colors.moss,
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20
  },
  label: {
    color: colors.forest,
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 18
  },
  caption: {
    color: colors.moss,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16
  },
  eyebrow: {
    color: colors.leaf,
    fontFamily: fontFamily.bodyBlack,
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 16,
    textTransform: "uppercase"
  }
} satisfies Record<string, TextStyle>;

/** Elevation presets (iOS shadow* + Android elevation). */
const shadow = {
  soft: {
    elevation: 3,
    shadowColor: "#15271B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16
  },
  lifted: {
    elevation: 9,
    shadowColor: "#15271B",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28
  }
} satisfies Record<string, ViewStyle>;

/** Named gradient stop arrays for expo-linear-gradient. */
const gradient = {
  brand: ["#2C6E4F", "#193A2E"],
  canopy: ["#5BB04A", "#2F7D3A"],
  sunrise: ["#FBEAC0", "#F4D7A6"],
  mist: ["#EAF3F0", "#DCEBE6"]
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  text,
  shadow,
  gradient
};

export type LeafletTheme = typeof theme;
