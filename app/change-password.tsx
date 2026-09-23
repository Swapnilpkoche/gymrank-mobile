import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PasswordStrengthMeter } from '../src/components/auth/PasswordStrengthMeter';
import { useAuth } from '../src/context/auth-context';
import { supabase } from '../src/lib/supabase';
import { colors } from '../src/theme/colors';

export default function ChangePasswordScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = session?.user.email;

  async function handleSubmit() {
    setError(null);

    if (!email) {
      setError('Missing account email. Please sign in again.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Fill in all three fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from your current password.');
      return;
    }

    setIsSubmitting(true);

    // Re-authenticating is the only client-side way to confirm the
    // current password is correct - Supabase has no separate "verify
    // password" call, and updateUser() doesn't require the old password.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      setIsSubmitting(false);
      setError('Current password is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    Alert.alert('Password updated', 'Your password has been changed successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Change Password</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Enter your current password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete="current-password"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Enter a new password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete="password-new"
        />
        <PasswordStrengthMeter password={newPassword} variant="dark" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter your new password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete="password-new"
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update Password</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#f8717126',
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
