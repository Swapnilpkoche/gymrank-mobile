import { Feather } from '@expo/vector-icons';
import * as ExpoDocumentPicker from 'expo-document-picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';
import type { OnboardingDocumentType } from '../../types/database';

export type PickedDocument = {
  uri: string;
  name: string;
};

const DOCUMENT_SLOTS: { type: OnboardingDocumentType; label: string }[] = [
  { type: 'business_registration', label: 'Business registration' },
  { type: 'id_proof', label: 'ID proof' },
  { type: 'lease_agreement', label: 'Lease agreement' },
];

export function DocumentPicker({
  documents,
  onChange,
}: {
  documents: Partial<Record<OnboardingDocumentType, PickedDocument>>;
  onChange: (documents: Partial<Record<OnboardingDocumentType, PickedDocument>>) => void;
}) {
  async function handlePick(type: OnboardingDocumentType) {
    const result = await ExpoDocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled) return;
    const asset = result.assets[0];
    onChange({ ...documents, [type]: { uri: asset.uri, name: asset.name } });
  }

  function handleRemove(type: OnboardingDocumentType) {
    const next = { ...documents };
    delete next[type];
    onChange(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Documents (optional)</Text>
      <Text style={styles.hint}>
        These help us verify your gym faster, but they're entirely optional here - you can also
        provide them later during a verification call.
      </Text>

      {DOCUMENT_SLOTS.map(({ type, label }) => {
        const picked = documents[type];
        return (
          <View key={type} style={styles.slot}>
            <View style={styles.slotInfo}>
              <Text style={styles.slotLabel}>{label}</Text>
              {picked ? (
                <Text style={styles.slotFileName} numberOfLines={1}>
                  {picked.name}
                </Text>
              ) : (
                <Text style={styles.slotEmpty}>Not added</Text>
              )}
            </View>

            {picked ? (
              <Pressable style={styles.removeButton} onPress={() => handleRemove(type)}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Pressable style={styles.addButton} onPress={() => handlePick(type)}>
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 17,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  slotInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  slotLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  slotFileName: {
    color: colors.emeraldLight,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  slotEmpty: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.emerald,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  removeButton: {
    padding: spacing.sm,
  },
});
