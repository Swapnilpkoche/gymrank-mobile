// Single source of truth for colour. Dark slate surfaces + emerald accent.
// The first block predates the token pass and is imported all over the app -
// keep those names stable. The rest are the recurring hardcoded values found
// in the audit, named so screens can migrate to them incrementally.
export const colors = {
  // Surfaces
  background: '#020617', // page background
  card: '#0f172a', // cards, inputs, sheets
  surfaceRaised: '#1e293b', // placeholders / chips sitting on top of `card`
  border: '#ffffff1a',

  // Text
  textPrimary: '#f1f5f9',
  textMuted: '#64748b', // secondary text, icons, placeholders
  white: '#fff', // text/icons on emerald or scrims
  textOnAccent: '#020617', // dark text on emeraldLight badges

  // Primary (emerald)
  emerald: '#10b981',
  emeraldLight: '#34d399',
  emeraldDark: '#059669', // pressed / heavier emphasis
  emeraldTint: '#052e1f', // dark emerald fill behind emerald text/icons

  // Danger / error
  danger: '#f87171',
  dangerBorder: '#f8717166',
  dangerTint: '#f8717126',

  // Warning (expiring soon, pending)
  warning: '#fbbf24',
  warningBorder: '#fbbf2466',
  warningTint: '#fbbf2414',

  // Modal backdrops / photo overlays
  scrim: '#000000b3',
  scrimLight: '#00000099',
  scrimHeavy: '#000000e6',
} as const;
