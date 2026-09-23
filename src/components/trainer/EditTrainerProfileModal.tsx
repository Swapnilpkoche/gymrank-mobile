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
import {
  MAX_BIO_LENGTH,
  MAX_SPECIALTIES,
  MAX_SPECIALTIES_TOTAL_LENGTH,
  saveTrainerProfile,
  type PickedImage,
} from '../../lib/trainer';
import { colors } from '../../theme/colors';
import type { TrainerProfile } from '../../types/database';

const MAX_SPECIALTY_LENGTH = 40;
const MAX_YEARS = 60;

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function EditTrainerProfileModal({
  visible,
  userId,
  displayName,
  fallbackAvatarUrl,
  profile,
  applyGymName,
  onClose,
  onSaved,
}: {
  visible: boolean;
  userId: string;
  displayName: string;
  fallbackAvatarUrl: string | null;
  profile: TrainerProfile | null;
  // Set when the user got here from a specific gym's "Join as Trainer" - the
  // form then says which gym the request is for instead of reading as a
  // generic profile form.
  applyGymName?: string | null;
  onClose: () => void;
  onSaved: (profile: TrainerProfile) => void;
}) {
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [years, setYears] = useState('');
  const [newPhoto, setNewPhoto] = useState<PickedImage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBio(profile?.bio ?? '');
    setSpecialties(profile?.specialties ?? []);
    setSpecialtyInput('');
    setYears(profile?.yearsExperience != null ? String(profile.yearsExperience) : '');
    setNewPhoto(null);
    setErrorMessage(null);
  }, [visible, profile]);

  function addSpecialty() {
    const value = specialtyInput.trim();
    if (!value) return;

    if (specialties.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setSpecialtyInput('');
      return;
    }
    if (specialties.length >= MAX_SPECIALTIES) {
      setErrorMessage(`You can add up to ${MAX_SPECIALTIES} specialties.`);
      return;
    }
    if (value.length > MAX_SPECIALTY_LENGTH) {
      setErrorMessage(`Each specialty can be up to ${MAX_SPECIALTY_LENGTH} characters.`);
      return;
    }
    const next = [...specialties, value];
    if (next.join(',').length > MAX_SPECIALTIES_TOTAL_LENGTH) {
      setErrorMessage('Your specialties are too long in total - shorten or remove some.');
      return;
    }

    setErrorMessage(null);
    setSpecialties(next);
    setSpecialtyInput('');
  }

  async function handlePickPhoto() {
    const image = await pickImage({ square: true });
    if (image) setNewPhoto(image);
  }

  async function handleSave() {
    setErrorMessage(null);

    let yearsExperience: number | null = null;
    if (years.trim()) {
      const parsed = Number(years);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_YEARS) {
        setErrorMessage(`Years of experience must be a whole number from 0 to ${MAX_YEARS}.`);
        return;
      }
      yearsExperience = parsed;
    }

    // A half-typed specialty in the input box shouldn't be silently dropped.
    let finalSpecialties = specialties;
    const pending = specialtyInput.trim();
    if (pending && !specialties.some((s) => s.toLowerCase() === pending.toLowerCase())) {
      finalSpecialties = [...specialties, pending];
    }
    if (
      finalSpecialties.length > MAX_SPECIALTIES ||
      finalSpecialties.some((s) => s.length > MAX_SPECIALTY_LENGTH) ||
      finalSpecialties.join(',').length > MAX_SPECIALTIES_TOTAL_LENGTH
    ) {
      setErrorMessage('Your specialties are too long or too many - shorten or remove some.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveTrainerProfile(
        userId,
        {
          bio: bio.trim() || null,
          specialties: finalSpecialties,
          yearsExperience,
          newPhoto,
        },
        profile?.photoPath ?? null
      );

      if (result.kind === 'success') {
        onSaved(result.profile);
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  const photoUri = newPhoto?.uri ?? profile?.photoUrl ?? fallbackAvatarUrl;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{profile ? 'Edit Trainer Profile' : 'Create Trainer Profile'}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {applyGymName ? (
              <View style={styles.applyBanner}>
                <Feather name="map-pin" size={16} color={colors.emeraldLight} />
                <View style={styles.applyBannerText}>
                  <Text style={styles.applyBannerTitle}>
                    Request to join {applyGymName} as a trainer
                  </Text>
                  <Text style={styles.applyBannerBody}>
                    {profile
                      ? `Save your changes, then confirm your request to ${applyGymName}.`
                      : `Step 1: create your trainer profile. Step 2: confirm your request to ${applyGymName}. Nothing is sent until you confirm.`}
                  </Text>
                </View>
              </View>
            ) : null}

            <Pressable style={styles.photoWrapper} onPress={handlePickPhoto} disabled={isSaving}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoFallback]}>
                  <Text style={styles.photoFallbackText}>{initials(displayName)}</Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Feather name="camera" size={13} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.photoHint}>Trainer photo (shown on your public trainer profile)</Text>

            <View style={styles.field}>
              <Text style={styles.label}>About you</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={bio}
                onChangeText={setBio}
                placeholder="Your training style, background, who you work best with..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={MAX_BIO_LENGTH}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {bio.length}/{MAX_BIO_LENGTH}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Specialties ({specialties.length}/{MAX_SPECIALTIES})
              </Text>
              {specialties.length > 0 ? (
                <View style={styles.chipRow}>
                  {specialties.map((specialty) => (
                    <Pressable
                      key={specialty}
                      style={styles.chip}
                      onPress={() => setSpecialties((prev) => prev.filter((s) => s !== specialty))}
                    >
                      <Text style={styles.chipText}>{specialty}</Text>
                      <Feather name="x" size={12} color={colors.emeraldLight} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, styles.addInput]}
                  value={specialtyInput}
                  onChangeText={setSpecialtyInput}
                  onSubmitEditing={addSpecialty}
                  placeholder="e.g. Strength training"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  maxLength={MAX_SPECIALTY_LENGTH}
                />
                <Pressable style={styles.addButton} onPress={addSpecialty}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Years of experience</Text>
              <TextInput
                style={styles.input}
                value={years}
                onChangeText={(text) => setYears(text.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
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
                <Text style={styles.primaryButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const PHOTO_SIZE = 96;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000b3',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '92%',
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
  applyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#052e1f',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    padding: 12,
  },
  applyBannerText: {
    flex: 1,
    gap: 4,
  },
  applyBannerTitle: {
    color: colors.emeraldLight,
    fontSize: 14,
    fontWeight: '700',
  },
  applyBannerBody: {
    color: colors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  photoWrapper: {
    alignSelf: 'center',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  },
  photoFallback: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 32,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -8,
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
  multiline: {
    minHeight: 110,
  },
  counter: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#052e1f',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  chipText: {
    color: colors.emeraldLight,
    fontSize: 12,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 14,
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
