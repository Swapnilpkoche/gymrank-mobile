import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GymCard } from './GymCard';
import { SavedMemberRow } from '../saved/SavedMemberRow';
import { colors } from '../../theme/colors';
import type { FollowedUser, GymWithDiscoverData } from '../../types/database';

// Bounded so each column scrolls on its own instead of the taller one
// growing to swallow the outer screen's scroll.
const COLUMN_HEIGHT = 360;

export function DiscoverSearchResults({
  gyms,
  members,
  isSearching,
}: {
  gyms: GymWithDiscoverData[];
  members: FollowedUser[];
  isSearching: boolean;
}) {
  const router = useRouter();

  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        <Text style={styles.columnTitle}>Gyms</Text>
        <FlatList
          data={gyms}
          keyExtractor={(item) => String(item.id)}
          style={styles.columnList}
          contentContainerStyle={styles.columnContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/gym/[id]', params: { id: String(item.id) } })}
            >
              <GymCard gym={item} style={styles.gymCard} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{isSearching ? 'Searching…' : 'No gyms found'}</Text>
          }
        />
      </View>

      <View style={styles.column}>
        <Text style={styles.columnTitle}>Members</Text>
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          style={styles.columnList}
          contentContainerStyle={styles.columnContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          renderItem={({ item }) => (
            <SavedMemberRow
              displayName={item.fullName || item.username || 'GymTrust member'}
              username={item.username}
              avatarUrl={item.avatarUrl}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.userId } })}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{isSearching ? 'Searching…' : 'No members found'}</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  columnList: {
    maxHeight: COLUMN_HEIGHT,
  },
  columnContent: {
    gap: 10,
    flexGrow: 1,
  },
  gymCard: {
    width: '100%',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
