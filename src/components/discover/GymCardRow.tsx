import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '../../theme';
import type { GymWithDiscoverData } from '../../types/database';
import { GymCard } from './GymCard';

export function GymCardRow({
  title,
  gyms,
  emptyLabel,
}: {
  title: string;
  gyms: GymWithDiscoverData[];
  emptyLabel: string;
}) {
  const router = useRouter();

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.swipeHint}>Swipe →</Text>
      </View>

      {gyms.length > 0 ? (
        <FlatList
          data={gyms}
          keyExtractor={(item) => String(item.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.row}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/gym/[id]', params: { id: String(item.id) } })}
            >
              <GymCard gym={item} />
            </Pressable>
          )}
        />
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  swipeHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  row: {
    gap: spacing.md,
    paddingRight: spacing.xs,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    paddingVertical: spacing.sm,
  },
});
