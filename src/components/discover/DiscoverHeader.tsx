import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../context/auth-context';
import { colors } from '../../theme/colors';

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
    paddingVertical: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  location: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  authButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  signInButton: {
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInText: {
    color: colors.emerald,
    fontWeight: '600',
    fontSize: 13,
  },
  signUpButton: {
    backgroundColor: colors.emerald,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signUpText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
