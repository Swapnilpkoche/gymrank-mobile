import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  swipeHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    gap: 12,
    paddingRight: 4,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
});
