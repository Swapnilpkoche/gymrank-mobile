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
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
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
            {rememberMe ? <Feather name="check" size={13} color="#fff" /> : null}
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </Pressable>

      <Link href="/signup" style={styles.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  rememberLabel: {
    fontSize: 14,
    color: '#374151',
  },
  forgotLink: {
    color: '#2563eb',
    fontSize: 13,
  },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: '#2563eb',
  },
});
