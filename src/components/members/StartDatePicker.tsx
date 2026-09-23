import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { isoToLocalDate, localDateToIso } from '../../lib/memberships';
import { formatShortDate } from '../../lib/time';
import { colors, fontSize, radius, spacing } from '../../theme';

// Picks a calendar DATE ('YYYY-MM-DD'), never an instant - so there is no
// time-zone maths here. "Today" and the allowed range come from the server; the
// server re-validates whatever is chosen. Same Android-dialog / iOS-inline
// split as DateOfBirthPicker.
export function StartDatePicker({
  valueIso,
  minIso,
  maxIso,
  onChange,
  disabled,
}: {
  valueIso: string;
  minIso: string;
  maxIso: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const value = isoToLocalDate(valueIso);
  const minimumDate = isoToLocalDate(minIso);
  const maximumDate = isoToLocalDate(maxIso);

  function handlePress() {
    if (disabled) return;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (_event, selectedDate) => {
          if (selectedDate) onChange(localDateToIso(selectedDate));
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }

  return (
    <View>
      <Pressable style={[styles.input, disabled && styles.inputDisabled]} onPress={handlePress}>
        <Text style={styles.valueText}>{formatShortDate(valueIso)}</Text>
        <Feather name="calendar" size={16} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === 'ios' && showIosPicker ? (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant="dark"
            textColor={colors.textPrimary}
            onChange={(_event, selectedDate) => {
              if (selectedDate) onChange(localDateToIso(selectedDate));
            }}
          />
          <Pressable style={styles.doneButton} onPress={() => setShowIosPicker(false)}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  iosPickerWrap: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
});
