import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { LocationOption } from '../../types/database';

// No winner highlighting here - a list of equipment/amenities isn't a single
// number to compare, it's just informational.
export function CompareListSection({
  label,
  itemsA,
  itemsB,
}: {
  label: string;
  itemsA: LocationOption[];
  itemsB: LocationOption[];
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.columnsRow}>
        <View style={styles.column}>
          {itemsA.length === 0 ? (
            <Text style={styles.empty}>Not listed</Text>
          ) : (
            itemsA.map((item) => (
              <Text key={item.id} style={styles.item} numberOfLines={1}>
                {item.name}
              </Text>
            ))
          )}
        </View>
        <View style={styles.column}>
          {itemsB.length === 0 ? (
            <Text style={styles.empty}>Not listed</Text>
          ) : (
            itemsB.map((item) => (
              <Text key={item.id} style={styles.item} numberOfLines={1}>
                {item.name}
              </Text>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
