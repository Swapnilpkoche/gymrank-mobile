import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../context/auth-context';
import { colors, fontSize, radius, spacing } from '../../theme';

export function DiscoverHeader({ locationText }: { locationText: string | null }) {
  const { session } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Discover</Text>
        {locationText ? <Text style={styles.location}>{locationText}</Text> : null}
      </View>

      {session ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(session.user.email?.charAt(0) ?? '?').toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={styles.authButtons}>
          <Pressable style={styles.signInButton} onPress={() => router.push('/login')}>
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.signUpButton} onPress={() => router.push('/signup')}>
            <Text style={styles.signUpText}>Sign up</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  location: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  authButtons: {
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
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  signUpText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
});
