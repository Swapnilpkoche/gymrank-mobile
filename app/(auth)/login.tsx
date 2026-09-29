import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  clearRememberedCredentials,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from '../../src/lib/rememberMe';
import { supabase } from '../../src/lib/supabase';
import { AuthScreenContainer } from '../../src/components/auth/AuthScreenContainer';
import { colors, fontSize, radius, spacing } from '../../src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill from a previously "remembered" login, if any - this is the
  // only place credentials are read back, and only exists because the user
  // explicitly opted in via the checkbox on an earlier successful login.
  useEffect(() => {
    let cancelled = false;
    loadRememberedCredentials().then((credentials) => {
      if (cancelled || !credentials) return;
      setEmail(credentials.email);
      setPassword(credentials.password);
      setRememberMe(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin() {
    setError(null);
    setIsSubmitting(true);
    const trimmedEmail = email.trim();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Only ever persist the password when the box is checked at the moment
    // of a successful login; otherwise make sure nothing is left behind
    // from an earlier login where it was checked.
    if (rememberMe) {
      await saveRememberedCredentials({ email: trimmedEmail, password });
    } else {
      await clearRememberedCredentials();
    }
    // On success, the root layout's auth listener redirects to the tabs group.
  }

  return (
    <AuthScreenContainer topAction="close">
      <Text style={styles.title}>Log in</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.rememberRow}>
        <Pressable
          style={styles.rememberCheckboxRow}
          onPress={() => setRememberMe((prev) => !prev)}
          hitSlop={8}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe ? <Feather name="check" size={13} color={colors.white} /> : null}
          </View>
          <Text style={styles.rememberLabel}>Remember me</Text>
        </Pressable>

        <Link href="/forgot-password" style={styles.forgotLink}>
          Forgot password?
        </Link>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isSubmitting || !email || !password}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </Pressable>

      <Link href="/signup" replace style={styles.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.display,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  rememberLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  forgotLink: {
    color: colors.emerald,
    fontSize: fontSize.base,
  },
  link: {
    textAlign: 'center',
    marginTop: spacing.lg,
    color: colors.emerald,
  },
});
