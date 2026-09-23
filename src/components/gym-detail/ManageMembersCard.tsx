import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

// The owner/admin's entry to the Members screen (plans, renewals, expiring
// members and join requests). Rendered only for a gym's owners/admins - the
// screen and its RPCs enforce that server-side regardless.
export function ManageMembersCard({ gymId }: { gymId: number }) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/gym/[id]/members', params: { id: String(gymId) } })}
    >
      <Feather name="users" size={20} color={colors.emerald} />
      <View style={styles.body}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle}>Plans, renewals, expiring soon and join requests</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    padding: 14,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
