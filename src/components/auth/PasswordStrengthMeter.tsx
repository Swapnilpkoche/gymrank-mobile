import { StyleSheet, Text, View } from 'react-native';

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

// One point each for length and each character class present. No external
// library (e.g. zxcvbn) - just a simple, dependency-free heuristic.
function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
}

function levelFromScore(score: number): StrengthLevel {
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score <= 4) return 'good';
  return 'strong';
}

const LEVEL_CONFIG: Record<StrengthLevel, { label: string; color: string; filledSegments: number }> = {
  weak: { label: 'Weak', color: '#dc2626', filledSegments: 1 },
  fair: { label: 'Fair', color: '#d97706', filledSegments: 2 },
  good: { label: 'Good', color: '#65a30d', filledSegments: 3 },
  strong: { label: 'Strong', color: '#059669', filledSegments: 4 },
};

// The filled-segment colors above read fine on either background, but the
// unfilled track needs a different shade per surface (light auth screens
// vs. the app's dark theme) to stay visible without importing theme colors
// into the (auth) group, which doesn't use them.
const TRACK_COLOR: Record<'light' | 'dark', string> = {
  light: '#e5e7eb',
  dark: '#ffffff1a',
};

export function PasswordStrengthMeter({
  password,
  variant = 'light',
}: {
  password: string;
  variant?: 'light' | 'dark';
}) {
  if (password.length === 0) return null;

  const level = levelFromScore(scorePassword(password));
  const config = LEVEL_CONFIG[level];
  const trackColor = TRACK_COLOR[variant];

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index < config.filledSegments ? config.color : trackColor },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
});
