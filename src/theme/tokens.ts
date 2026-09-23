// Type, radius and spacing scales. Values were consolidated from what the app
// actually uses (18 font sizes, 22 radii, ~20 spacing values) - the comments
// say which raw values each token absorbs when migrating a screen.

export const fontSize = {
  xs: 11, // 10, 11 - captions, badges, uppercase labels
  sm: 12,
  base: 13, // default body / secondary rows (most common)
  md: 14,
  lg: 15, // row titles, card names
  xl: 17, // 16-18 - section headers, inputs
  xxl: 22, // 19-22 - screen titles
  display: 28, // 24-28 - hero numbers, auth titles (32/36 left as literals)
} as const;

export const radius = {
  sm: 8, // 6-9 - small chips, thumbnails, inputs (2-5 left as literals: bars, checkboxes)
  md: 12, // 10-14 - buttons, cards, rows (most common)
  lg: 16, // 15-22 - large cards, sheets
  pill: 999, // capsules and circles
} as const;

export const spacing = {
  xs: 4, // 2-5
  sm: 8, // 6-9
  md: 12, // 10-14
  lg: 16, // 15-18
  xl: 20,
  xxl: 24, // 22-24
  xxxl: 32,
} as const;
