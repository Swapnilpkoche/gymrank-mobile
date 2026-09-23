import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { DateOfBirthPicker } from './DateOfBirthPicker';
import { GenderPicker } from './GenderPicker';
import { dateToIsoDateString, isoDateStringToDate } from '../../lib/dateOfBirth';
import { updateProfile } from '../../lib/profile';
import { colors } from '../../theme/colors';
import type { Gender, Profile } from '../../types/database';

const MAX_DOB_EDITS = 2;

export function EditProfileModal({
  visible,
  userId,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  userId: string;
  profile: Profile | null;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dobEditCount = profile?.dobEditCount ?? 0;
  const isDobLocked = profile?.dateOfBirth != null && dobEditCount >= MAX_DOB_EDITS;
  const dobEditsRemaining = Math.max(0, MAX_DOB_EDITS - dobEditCount);

  useEffect(() => {
    if (!visible) return;
    setFullName(profile?.fullName ?? '');
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setCity(profile?.city ?? '');
    setPhoneNumber(profile?.phoneNumber ?? '');
    setGender(profile?.gender ?? null);
    setDateOfBirth(profile?.dateOfBirth ?? null);
    setErrorMessage(null);
  }, [visible, profile]);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const input = {
        fullName: fullName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        city: city.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
        gender,
        dateOfBirth,
      };
      const result = await updateProfile(userId, input);

      if (result.kind === 'success') {
        // The initial null -> value entry is free; only a change to an
        // already-set date consumes one of the 2 allowed edits - mirrors
        // trg_enforce_dob_edit_limit so the local optimistic count doesn't
        // drift from what the DB actually recorded.
        const dobChanged = input.dateOfBirth !== (profile?.dateOfBirth ?? null);
        const nextDobEditCount =
          dobChanged && profile?.dateOfBirth != null ? dobEditCount + 1 : dobEditCount;

        onSaved({
          id: userId,
          avatarUrl: profile?.avatarUrl ?? null,
          ...input,
          dobEditCount: nextDobEditCount,
        });
        onClose();
      } else if (result.kind === 'duplicate_username') {
        setErrorMessage('That username is already taken.');
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
            <Text style={styles.title}>Edit Profile</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Choose a username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Where you're based"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="A short line about yourself"
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone number (optional)</Text>
              <Text style={styles.helperText}>
                For future SMS features — not required, and not used for anything yet.
              </Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Your phone number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Gender (optional)</Text>
              <Text style={styles.helperText}>
                Self-identified. Only required later if you want to be nominated for Face of the
                Gym/City.
              </Text>
              <GenderPicker value={gender} onChange={setGender} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Date of birth</Text>
              {isDobLocked ? (
                <Text style={styles.helperText}>
                  Permanently locked after {MAX_DOB_EDITS} changes. To change it further, you
                  would need to delete and recreate your account.
                </Text>
              ) : (
                <Text style={styles.helperText}>
                  {profile?.dateOfBirth == null
                    ? `You can change this up to ${MAX_DOB_EDITS} times after saving.`
                    : `You can change this ${dobEditsRemaining} more time${dobEditsRemaining === 1 ? '' : 's'}.`}
                </Text>
              )}
              <DateOfBirthPicker
                value={dateOfBirth ? isoDateStringToDate(dateOfBirth) : null}
                onChange={(date) => setDateOfBirth(dateToIsoDateString(date))}
                disabled={isDobLocked}
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
  helperText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -2,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
