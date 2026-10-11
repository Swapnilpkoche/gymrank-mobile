import { StyleSheet, Text, View } from 'react-native';

import { GuestAuthButtons } from '../auth/GuestAuthButtons';
import { useAuth } from '../../context/auth-context';
import { colors, fontSize, radius, spacing } from '../../theme';

export function DiscoverHeader({ locationText }: { locationText: string | null }) {
  const { session } = useAuth();

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
        <GuestAuthButtons />
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
