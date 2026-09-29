import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../theme';

// Red count pill used for unread notifications and messages. Renders nothing
// at zero so callers can drop it in unconditionally.
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
});
