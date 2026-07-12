// theme.js — SunCycle design system
// Warm, premium, sun-inspired. Think golden hour, not neon.

export const colours = {
  // Primary sun palette
  sun:        "#FFD246",   // primary yellow — route glow, CTAs
  sunWarm:    "#FFA826",   // deeper orange — gradient base
  sunDeep:    "#FF7A00",   // sunset orange — accents

  // Shade palette
  shade:      "#4A7FA5",   // cool blue — shaded segments
  shadeDeep:  "#2C5F7A",   // deeper blue

  // Backgrounds — near-black with warm undertone
  bg:         "#0F0E0C",   // primary background
  bgCard:     "#1A1916",   // card surface
  bgElevated: "#242220",   // elevated elements
  bgInput:    "#1E1D1B",   // input fields

  // Text
  textPrimary:   "#F5F0E8",   // warm off-white
  textSecondary: "#8A8378",   // muted warm grey
  textTertiary:  "#4A4540",   // very muted

  // Borders
  border:     "#2A2825",
  borderGlow: "rgba(255, 210, 70, 0.2)",

  // Status
  success:    "#4CAF50",
  error:      "#E57373",

  // Glassmorphism
  glass:      "rgba(26, 25, 22, 0.85)",
  glassLight: "rgba(255, 210, 70, 0.08)",
};

export const typography = {
  // Display — for sun scores, big numbers
  display: {
    fontFamily: "Georgia",   // available on all platforms, elegant
    fontWeight: "700",
  },
  // Heading — route names, section titles
  heading: {
    fontFamily: "System",
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  // Body — descriptions, metadata
  body: {
    fontFamily: "System",
    fontWeight: "400",
    lineHeight: 22,
  },
  // Label — small caps, metadata
  label: {
    fontFamily: "System",
    fontWeight: "500",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const shadows = {
  sun: {
    shadowColor: colours.sun,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Sun score → colour gradient (for progress bars, scores)
export function sunScoreColour(pct) {
  if (pct >= 75) return colours.sun;
  if (pct >= 55) return colours.sunWarm;
  if (pct >= 35) return "#E8A020";
  return colours.shade;
}

// Sun score → emoji
export function sunEmoji(pct) {
  if (pct >= 75) return "☀️";
  if (pct >= 55) return "🌤️";
  if (pct >= 35) return "⛅";
  return "☁️";
}
