import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pickImage } from '../../lib/pickImage';
import { addTrainerCertification, type PickedImage } from '../../lib/trainer';
import { colors, fontSize, radius, spacing } from '../../theme';

const MAX_FIELD_LENGTH = 120;

export function AddCertificationModal({
  visible,
  userId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [issuingBody, setIssuingBody] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setIssuingBody('');
    setPhoto(null);
    setErrorMessage(null);
  }, [visible]);

  async function handlePickPhoto() {
    const image = await pickImage();
    if (image) setPhoto(image);
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    const trimmedIssuer = issuingBody.trim();
    if (!trimmedTitle || !trimmedIssuer) {
      setErrorMessage('Enter both the certification title and who issued it.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await addTrainerCertification(userId, {
        title: trimmedTitle,
        issuingBody: trimmedIssuer,
        photo,
      });

      if (result.kind === 'success') {
        onSaved();
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Add Certification</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.label}>Certification</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Certified Personal Trainer"
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_FIELD_LENGTH}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Issued by</Text>
              <TextInput
                style={styles.input}
                value={issuingBody}
                onChangeText={setIssuingBody}
                placeholder="e.g. ACE, NASM, ISSA"
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_FIELD_LENGTH}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Certificate photo (optional)</Text>
              {photo ? (
                <View style={styles.previewRow}>
                  <Image source={{ uri: photo.uri }} style={styles.preview} />
                  <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
                  <Feather name="image" size={16} color={colors.emerald} />
                  <Text style={styles.photoButtonText}>Choose a photo</Text>
                </Pressable>
              )}
              <Text style={styles.privacyNote}>
                Stored privately. Only you and the owners/admins of gyms you&apos;ve applied to or work
                at can view it. Avoid uploading documents that show ID numbers.
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  photoButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  privacyNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.danger,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
