import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

const MAX_EXTRA_PHOTOS = 3;

export function NominationForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (input: { primaryPhotoUri: string; extraPhotoUris: string[] }) => void;
}) {
  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(null);
  const [extraPhotoUris, setExtraPhotoUris] = useState<string[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);

  async function pickPrimaryPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    setPrimaryPhotoUri(result.assets[0].uri);
  }

  async function pickExtraPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_EXTRA_PHOTOS - extraPhotoUris.length),
      quality: 0.8,
    });
    if (result.canceled) return;
    setExtraPhotoUris((prev) =>
      [...prev, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_EXTRA_PHOTOS)
    );
  }

  function removeExtraPhoto(uri: string) {
    setExtraPhotoUris((prev) => prev.filter((existing) => existing !== uri));
  }

  const canSubmit = !!primaryPhotoUri && consentAccepted && !isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Primary photo</Text>
      <Pressable style={styles.primaryPhotoBox} onPress={pickPrimaryPhoto}>
        {primaryPhotoUri ? (
          <Image source={{ uri: primaryPhotoUri }} style={styles.primaryPhoto} />
        ) : (
          <View style={styles.primaryPhotoPlaceholder}>
            <Feather name="camera" size={24} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Add your best photo</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Extra photos (optional, up to {MAX_EXTRA_PHOTOS})</Text>
      <View style={styles.extraRow}>
        {extraPhotoUris.map((uri) => (
          <View key={uri} style={styles.extraThumbWrapper}>
            <Image source={{ uri }} style={styles.extraThumb} />
            <Pressable style={styles.removeBadge} onPress={() => removeExtraPhoto(uri)}>
              <Feather name="x" size={12} color="#fff" />
            </Pressable>
          </View>
        ))}
        {extraPhotoUris.length < MAX_EXTRA_PHOTOS ? (
          <Pressable style={styles.addExtraButton} onPress={pickExtraPhotos}>
            <Feather name="plus" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((prev) => !prev)}>
        <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
          {consentAccepted ? <Feather name="check" size={12} color="#fff" /> : null}
        </View>
        <Text style={styles.consentText}>
          I understand that if I win, I may go on to represent my gym at the City level, and that
          if the winner withdraws before City voting starts, the next-highest-voted nominee may be
          promoted to winner in their place.
        </Text>
      </Pressable>

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={() => primaryPhotoUri && onSubmit({ primaryPhotoUri, extraPhotoUris })}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Nomination</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  primaryPhotoBox: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryPhoto: {
    width: '100%',
    height: '100%',
  },
  primaryPhotoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  extraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  extraThumbWrapper: {
    position: 'relative',
  },
  extraThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExtraButton: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  submitButton: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
