import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function MonthYearPickerModal({
  visible,
  year,
  month,
  onSelect,
  onClose,
}: {
  visible: boolean;
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const [pickerYear, setPickerYear] = useState(year);

  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.yearRow}>
            <Pressable
              style={styles.navButton}
              onPress={() => setPickerYear((y) => y - 1)}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={18} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.yearText}>{pickerYear}</Text>
            <Pressable
              style={styles.navButton}
              onPress={() => setPickerYear((y) => y + 1)}
              hitSlop={8}
            >
              <Feather name="chevron-right" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.monthGrid}>
            {MONTH_ABBREVIATIONS.map((label, index) => {
              const monthNum = index + 1;
              const isSelected = pickerYear === year && monthNum === month;
              return (
                <Pressable
                  key={label}
                  style={[styles.monthCell, isSelected && styles.monthCellActive]}
                  onPress={() => onSelect(pickerYear, monthNum)}
                >
                  <Text style={[styles.monthText, isSelected && styles.monthTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const MONTH_CELL_WIDTH = '25%' as const;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  yearText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 64,
    textAlign: 'center',
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: MONTH_CELL_WIDTH,
    aspectRatio: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellActive: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
  },
  monthText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  monthTextActive: {
    color: colors.white,
  },
});
