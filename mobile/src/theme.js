// Design tokens for StudyRoom. Uses system fonts (no external font
// download needed — reliable on-device with zero network dependency)
// with deliberate weight/spacing choices instead, plus a warm,
// social/energetic palette distinct from the other portfolio projects.

export const colors = {
  bg: "#FAF7F5",
  panel: "#FFFFFF",
  panelAlt: "#F3EEEC",
  border: "#EAE3DF",
  ink: "#2B2438",
  muted: "#8A8194",
  accent: "#FF6F59",       // warm coral — primary actions, calls
  accentSoft: "#FFE4DE",
  secondary: "#5B8AA6",    // dusty blue — video/call surfaces
  secondarySoft: "#DCE9EF",
  success: "#3FBF7F",
  danger: "#E14B4B",
  dangerSoft: "#FBE2E2",
};

export const typography = {
  display: { letterSpacing: -0.5 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
