import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export function SavedGymRow({
  name,
  onPress,
  onUnfollow,
}: {
  name: string;
  onPress: () => void;
  onUnfollow: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.right}>
        <Pressable style={styles.unfollowButton} onPress={onUnfollow} hitSlop={8}>
          <Feather name="heart" size={14} color="#fff" />
        </Pressable>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unfollowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
