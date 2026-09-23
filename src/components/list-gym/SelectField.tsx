import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { LocationOption } from '../../types/database';

export function SelectField({
  label,
  placeholder,
  value,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: LocationOption | null;
  options: LocationOption[];
  disabled?: boolean;
  onSelect: (option: LocationOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value?.name ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onSelect(item);
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No options available.</Text>}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  valueText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
