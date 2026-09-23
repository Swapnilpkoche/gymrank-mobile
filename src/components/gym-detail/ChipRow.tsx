import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

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
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipEquipment: {
    backgroundColor: colors.card,
    borderColor: colors.emerald,
  },
  chipAmenity: {
    backgroundColor: '#1e293b',
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextEquipment: {
    color: colors.emeraldLight,
  },
  chipTextAmenity: {
    color: colors.textPrimary,
  },
});
