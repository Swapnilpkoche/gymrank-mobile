import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { PasswordStrengthMeter } from '../../src/components/auth/PasswordStrengthMeter';
import { supabase } from '../../src/lib/supabase';
import { AuthScreenContainer } from '../../src/components/auth/AuthScreenContainer';

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Recovery tokens are single-use, so a duplicate verifyOtp call for the
  // same code always fails with "Token has expired or is invalid" even
  // when the first call just succeeded. `isSubmitting` state alone can't
  // prevent that: React doesn't disable the button until the next render
  // commits, leaving a window where a fast double-tap fires handleSubmit
  // twice before that happens. A ref is checked/set synchronously, with
  // no such window, so it's the actual guard - the state is kept only to
  // drive the UI (spinner/disabled look).
  const isSubmittingRef = useRef(false);
  const isResendingRef = useRef(false);

  async function handleResend() {
    if (!email || isResendingRef.current) return;
    isResendingRef.current = true;
    setError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      console.log('[reset-password] resetPasswordForEmail (resend) →', email);
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
      if (resendError) {
        console.log('[reset-password] resend failed:', resendError.message);
        setError(resendError.message);
        return;
      }
      console.log('[reset-password] resend succeeded - previous code is now stale');
      setResendMessage('A new code has been sent to your email.');
    } finally {
      isResendingRef.current = false;
      setIsResending(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    setResendMessage(null);

    if (!email) {
      setError('Missing email address. Please start over from "Forgot password?".');
      return;
    }
    if (!code.trim()) {
      setError('Enter the code from your email.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      console.log('[reset-password] verifyOtp →', { email, type: 'recovery', tokenLength: code.trim().length });
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'recovery',
      });

      if (verifyError) {
        console.log('[reset-password] verifyOtp failed:', verifyError.message);
        setError(verifyError.message);
        return;
      }
      console.log('[reset-password] verifyOtp succeeded - recovery session established');

      console.log('[reset-password] updateUser → setting new password');
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        console.log('[reset-password] updateUser failed:', updateError.message);
        setError(updateError.message);
        return;
      }
      console.log('[reset-password] updateUser succeeded - password changed, redirecting');

      // verifyOtp already established a session, so this takes the user
      // straight into the app rather than back to the login screen.
      router.replace('/');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenContainer>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to {email ?? 'your email'} and choose a new password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Code from email"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        autoComplete="password-new"
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <PasswordStrengthMeter password={newPassword} />
      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        secureTextEntry
        autoComplete="password-new"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {resendMessage ? <Text style={styles.message}>{resendMessage}</Text> : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || !code.trim() || !newPassword || !confirmPassword}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset password</Text>
        )}
      </Pressable>

      <Pressable onPress={handleResend} disabled={isResending}>
        <Text style={styles.link}>
          {isResending ? 'Resending…' : "Didn't get a code? Resend"}
        </Text>
      </Pressable>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
  },
  message: {
    color: '#059669',
  },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: '#2563eb',
  },
});
