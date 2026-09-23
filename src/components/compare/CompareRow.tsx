import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

const NOT_AVAILABLE = 'Not available';

// Highlights whichever side is numerically better, when both sides actually
// have a value to compare - a missing value on either side means there's
// nothing fair to compare, so neither side is highlighted (never shown as a
// "loss" against a gym that simply hasn't been rated/priced yet).
export function CompareRow({
  label,
  rawA,
  rawB,
  formatValue,
  higherIsBetter = true,
}: {
  label: string;
  rawA: number | null;
  rawB: number | null;
  formatValue: (value: number) => string;
  higherIsBetter?: boolean;
}) {
  const aWins =
    rawA !== null && rawB !== null && rawA !== rawB && (higherIsBetter ? rawA > rawB : rawA < rawB);
  const bWins =
    rawA !== null && rawB !== null && rawA !== rawB && (higherIsBetter ? rawB > rawA : rawB < rawA);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valuesRow}>
        <View style={[styles.valueBox, aWins && styles.valueBoxWinner]}>
          <Text style={[styles.valueText, aWins && styles.valueTextWinner]}>
            {rawA !== null ? formatValue(rawA) : NOT_AVAILABLE}
          </Text>
        </View>
        <View style={[styles.valueBox, bWins && styles.valueBoxWinner]}>
          <Text style={[styles.valueText, bWins && styles.valueTextWinner]}>
            {rawB !== null ? formatValue(rawB) : NOT_AVAILABLE}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  valuesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  valueBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueBoxWinner: {
    backgroundColor: '#052e1f',
    borderColor: colors.emerald,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  valueTextWinner: {
    color: colors.emeraldLight,
    fontWeight: '700',
  },
});
