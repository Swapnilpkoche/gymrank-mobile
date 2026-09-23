import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export type GymFilter = 'all' | 'best_rated' | 'best_value' | 'budget' | 'nearby';

const OPTIONS: { value: GymFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'best_rated', label: 'Best rated' },
  { value: 'best_value', label: 'Best value' },
  { value: 'budget', label: 'Budget' },
  { value: 'nearby', label: 'Nearby' },
];

export function FilterChips({
  value,
  onChange,
}: {
  value: GymFilter;
  onChange: (filter: GymFilter) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>Filter by</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
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
