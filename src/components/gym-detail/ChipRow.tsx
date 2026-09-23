import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

export function ChipRow({
  title,
  items,
  variant,
}: {
  title: string;
  items: { id: number; name: string }[];
  variant: 'equipment' | 'amenity';
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[styles.chip, variant === 'equipment' ? styles.chipEquipment : styles.chipAmenity]}
          >
            <Text
              style={[
                styles.chipText,
                variant === 'equipment' ? styles.chipTextEquipment : styles.chipTextAmenity,
              ]}
            >
              {item.name}
            </Text>
          </View>
        ))}
      </View>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  chipEquipment: {
    backgroundColor: colors.card,
    borderColor: colors.emerald,
  },
  chipAmenity: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  chipTextEquipment: {
    color: colors.emeraldLight,
  },
  chipTextAmenity: {
    color: colors.textPrimary,
  },
});
