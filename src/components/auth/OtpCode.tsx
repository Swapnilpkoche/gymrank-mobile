import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

// Shared by every flow that emails a one-time code (Reset password, Verify
// email). This project standardizes on typed codes rather than email links,
// since deep links don't test reliably in Expo Go.
export function OtpCodeInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (code: string) => void;
}) {
  return (
    <TextInput
      style={styles.input}
      placeholderTextColor={colors.textMuted}
      placeholder="Code from email"
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      value={value}
      onChangeText={onChangeText}
    />
  );
}

// `onResend` does the actual send and reports its own success/error. There's
// no client-side cooldown - Supabase's email rate limit is the real one, and
// its error message is surfaced by the caller.
export function ResendCodeLink({ onResend }: { onResend: () => Promise<void> }) {
  const [isResending, setIsResending] = useState(false);
  // Same synchronous double-tap guard as the submit buttons: state alone
  // leaves a window before the disabled look commits.
  const isResendingRef = useRef(false);

  async function handlePress() {
    if (isResendingRef.current) return;
    isResendingRef.current = true;
    setIsResending(true);
    try {
      await onResend();
    } finally {
      isResendingRef.current = false;
      setIsResending(false);
    }
  }

  return (
    <Pressable onPress={handlePress} disabled={isResending}>
      <Text style={styles.link}>{isResending ? 'Resending…' : "Didn't get a code? Resend"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  link: {
    textAlign: 'center',
    marginTop: spacing.lg,
    color: colors.emerald,
  },
});
