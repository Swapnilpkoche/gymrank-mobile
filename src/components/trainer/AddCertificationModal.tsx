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
import { colors } from '../../theme/colors';

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
                <Feather name="alert-triangle" size={14} color="#f87171" />
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
                <ActivityIndicator color="#fff" size="small" />
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
    backgroundColor: '#000000b3',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: 16,
    paddingBottom: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
  },
  photoButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  removeText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 13,
  },
  privacyNote: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8717126',
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
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
});
