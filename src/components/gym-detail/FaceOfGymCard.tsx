import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

// Kept deliberately light - it's just the entry point. The dedicated
// face-of-gym screen does the real work of figuring out which of the two
// gender categories currently has a nominating/voting/completed contest and
// rendering the right UI for it.
export function FaceOfGymCard({ gymId }: { gymId: number }) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Face of the Gym</Text>
      <Pressable
        style={styles.card}
        onPress={() => router.push({ pathname: '/gym/[id]/face-of-gym', params: { id: String(gymId) } })}
      >
        <Feather name="award" size={22} color={colors.emerald} />
        <Text style={styles.cardText}>Nominate, vote, or see results</Text>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  cardText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
