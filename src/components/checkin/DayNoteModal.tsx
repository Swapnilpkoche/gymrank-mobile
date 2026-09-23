import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { deleteDayNote, saveDayNote } from '../../lib/dayNotes';
import { colors } from '../../theme/colors';
import type { DayNote, MyGym } from '../../types/database';

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function DayNoteModal({
  visible,
  dateKey,
  userId,
  myGyms,
  notesForDate,
  readOnly,
  onClose,
  onSaved,
}: {
  visible: boolean;
  dateKey: string | null;
  userId: string;
  myGyms: MyGym[];
  notesForDate: DayNote[];
  // Past dates: note stays visible but can't be edited or deleted.
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initialGymId = notesForDate[0]?.gymId ?? myGyms[0]?.gymId ?? null;
    setSelectedGymId(initialGymId);
    setNoteText(notesForDate.find((note) => note.gymId === initialGymId)?.noteText ?? '');
    // Re-derive only when the modal opens for a (possibly new) date - not on
    // every render, since notesForDate/myGyms are fresh arrays each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dateKey]);

  function handleSelectGym(gymId: number) {
    setSelectedGymId(gymId);
    setNoteText(notesForDate.find((note) => note.gymId === gymId)?.noteText ?? '');
  }

  const existingNote = notesForDate.find((note) => note.gymId === selectedGymId) ?? null;
  const hasGym = myGyms.length > 0;

  async function handleSave() {
    if (readOnly || !dateKey || selectedGymId === null) return;
    setIsSaving(true);
    try {
      const trimmed = noteText.trim();
      if (trimmed.length === 0) {
        if (existingNote) await deleteDayNote(existingNote.id);
      } else {
        await saveDayNote({ userId, gymId: selectedGymId, noteDate: dateKey, noteText: trimmed });
      }
      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (readOnly || !existingNote) return;
    setIsSaving(true);
    try {
      await deleteDayNote(existingNote.id);
      onSaved();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{dateKey ? formatDateLabel(dateKey) : ''}</Text>

          {!hasGym ? (
            <Text style={styles.helperText}>
              {readOnly
                ? 'No note for this day.'
                : 'Join a gym from Discover to start adding notes to your calendar days.'}
            </Text>
          ) : (
            <>
              {myGyms.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.gymPickerRow}
                  contentContainerStyle={styles.gymPickerContent}
                >
                  {myGyms.map((gym) => (
                    <Pressable
                      key={gym.gymId}
                      style={[styles.gymChip, selectedGymId === gym.gymId && styles.gymChipActive]}
                      onPress={() => handleSelectGym(gym.gymId)}
                    >
                      <Text
                        style={[
                          styles.gymChipText,
                          selectedGymId === gym.gymId && styles.gymChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {gym.gymName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <TextInput
                style={styles.input}
                value={noteText}
                onChangeText={setNoteText}
                placeholder={
                  readOnly ? 'No note for this day.' : 'e.g. leg day tomorrow, felt great today…'
                }
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!isSaving && !readOnly}
              />
            </>
          )}

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>{readOnly ? 'Close' : 'Cancel'}</Text>
            </Pressable>
            {!readOnly && existingNote ? (
              <Pressable style={styles.dangerButton} onPress={handleDelete} disabled={isSaving}>
                <Feather name="trash-2" size={16} color="#f87171" />
              </Pressable>
            ) : null}
            {!readOnly ? (
              <Pressable
                style={[styles.primaryButton, !hasGym && styles.primaryButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving || !hasGym}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000b3',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  gymPickerRow: {
    flexGrow: 0,
  },
  gymPickerContent: {
    gap: 8,
  },
  gymChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: 160,
  },
  gymChipActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  gymChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  gymChipTextActive: {
    color: '#fff',
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
