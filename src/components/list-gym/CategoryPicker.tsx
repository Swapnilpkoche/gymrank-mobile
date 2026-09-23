import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export const GYM_CATEGORIES = [
  'Gym',
  'CrossFit',
  'Yoga Studio',
  'Martial Arts',
  'Pilates',
  'Dance Studio',
  'Other',
] as const;

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (category: string) => void;
}) {
  return (
    <View style={styles.row}>
      {GYM_CATEGORIES.map((category) => {
        const isActive = category === value;
        return (
          <Pressable
            key={category}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onChange(category)}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{category}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#fff',
  },
});
