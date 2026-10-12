import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { AuthScreenContainer, useCloseAuthFlow } from '../../src/components/auth/AuthScreenContainer';
import { OtpCodeInput, ResendCodeLink } from '../../src/components/auth/OtpCode';
import { colors, fontSize, radius, spacing } from '../../src/theme';

// Reached right after Sign up, or from Log in when the account's email was
// never confirmed. With "Confirm email" on, an unverified account has no
// session at all, so skipping simply leaves the person browsing as a guest -
// every guest prompt still applies - and they can come back here via Log in.
export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const closeAuthFlow = useCloseAuthFlow();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Same synchronous double-tap guard as Reset password: a confirmation
  // token is single-use, so a second verifyOtp for the same code would fail
  // even though the first one just succeeded.
  const isSubmittingRef = useRef(false);

  async function handleResend() {
    if (!email) return;
    setError(null);
    setResendMessage(null);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setResendMessage('A new code has been sent to your email.');
  }

  async function handleSubmit() {
    setError(null);
    setResendMessage(null);

    if (!email) {
      setError('Missing email address. Please log in again to verify.');
      return;
    }
    if (!code.trim()) {
      setError('Enter the code from your email.');
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'signup',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // verifyOtp signs them in, so they get full access right away - just
      // drop back to whatever they were browsing.
      closeAuthFlow();
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenContainer topAction="close">
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to {email ?? 'your email'} to finish setting up your account.
      </Text>

      <OtpCodeInput value={code} onChangeText={setCode} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {resendMessage ? <Text style={styles.message}>{resendMessage}</Text> : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting || !code.trim()}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </Pressable>

      <ResendCodeLink onResend={handleResend} />

      <Pressable onPress={closeAuthFlow}>
        <Text style={styles.skipLink}>Skip for now</Text>
      </Pressable>
      <Text style={styles.skipNote}>
        You can browse as a guest. Log in any time to enter your code and finish signing up.
      </Text>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.display,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
  },
  message: {
    color: colors.emerald,
  },
  skipLink: {
    textAlign: 'center',
    color: colors.textMuted,
    fontWeight: '600',
  },
  skipNote: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
});
