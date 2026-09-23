import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GymRow } from './GymRow';
import { colors } from '../../theme/colors';

export function GymListSection({
  title,
  gyms,
  emptyLabel,
  maxVisible,
  onViewAll,
}: {
  title: string;
  gyms: Array<{ gymId: number; gymName: string; badge?: string; note?: string }>;
  emptyLabel: string;
  maxVisible?: number;
  onViewAll?: () => void;
}) {
  const router = useRouter();
  const visibleGyms = maxVisible !== undefined ? gyms.slice(0, maxVisible) : gyms;
  const hasMore = maxVisible !== undefined && gyms.length > maxVisible;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>

      {gyms.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        <>
          <View style={styles.list}>
            {visibleGyms.map((gym) => (
              <GymRow
                key={gym.gymId}
                name={gym.gymName}
                badge={gym.badge}
                note={gym.note}
                onPress={() =>
                  router.push({ pathname: '/gym/[id]', params: { id: String(gym.gymId) } })
                }
              />
            ))}
          </View>

          {hasMore && onViewAll ? (
            <Pressable style={styles.viewAllRow} onPress={onViewAll}>
              <Text style={styles.viewAllText}>View all ({gyms.length})</Text>
              <Feather name="arrow-right" size={14} color={colors.emeraldLight} />
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
  list: {
    gap: 8,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  viewAllText: {
    color: colors.emeraldLight,
    fontWeight: '600',
    fontSize: 13,
  },
});
