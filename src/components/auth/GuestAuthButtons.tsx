import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

// The one guest-facing way into auth: Sign in and Sign up side by side, so a
// new user never has to open Log in first to find Sign up. Used by the
// Discover header and every "Sign in to ..." prompt across the app.
export function GuestAuthButtons({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();

  return (
    <View style={[styles.row, style]}>
      <Pressable style={styles.signInButton} onPress={() => router.push('/login')}>
        <Text style={styles.signInText}>Sign in</Text>
      </Pressable>
      <Pressable style={styles.signUpButton} onPress={() => router.push('/signup')}>
        <Text style={styles.signUpText}>Sign up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  signInButton: {
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  signInText: {
    color: colors.emerald,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  signUpButton: {
    backgroundColor: colors.emerald,
    // Same 1px border (in the fill colour) as Sign in, so both pills are the
    // same height.
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  signUpText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
});
