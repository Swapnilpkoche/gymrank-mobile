import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateOfBirth } from '../../lib/dateOfBirth';
import { colors } from '../../theme/colors';

const DEFAULT_PICKER_DATE = new Date(2000, 0, 1);

// Android's DateTimePicker is an imperative popup dialog (DateTimePickerAndroid.open),
// while iOS renders an inline spinner that needs to be toggled open/closed manually -
// different enough that this wrapper is the simplest way to give both a single API.
export function DateOfBirthPicker({
  value,
  onChange,
  disabled,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  disabled?: boolean;
}) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const maximumDate = new Date();

  function handlePress() {
    if (disabled) return;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? DEFAULT_PICKER_DATE,
        mode: 'date',
        maximumDate,
        onChange: (_event, selectedDate) => {
          if (selectedDate) onChange(selectedDate);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }

  return (
    <View>
      <Pressable style={[styles.input, disabled && styles.inputDisabled]} onPress={handlePress}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDateOfBirth(value) : 'Select your date of birth'}
        </Text>
        <Feather name="calendar" size={16} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === 'ios' && showIosPicker ? (
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={value ?? DEFAULT_PICKER_DATE}
            mode="date"
            display="spinner"
            maximumDate={maximumDate}
            // The spinner otherwise renders default (near-black) text that's
            // unreadable against this app's always-dark theme - iOS doesn't
            // pick this up from the surrounding view styles automatically.
            themeVariant="dark"
            textColor={colors.textPrimary}
            onChange={(_event, selectedDate) => {
              if (selectedDate) onChange(selectedDate);
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  iosPickerWrap: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 14,
  },
});
