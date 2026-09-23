import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { PasswordStrengthMeter } from '../../src/components/auth/PasswordStrengthMeter';
import { DateOfBirthPicker } from '../../src/components/profile/DateOfBirthPicker';
import { calculateAge, dateToIsoDateString, MIN_SIGNUP_AGE } from '../../src/lib/dateOfBirth';
import { supabase } from '../../src/lib/supabase';
import { AuthScreenContainer } from '../../src/components/auth/AuthScreenContainer';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignup() {
    setError(null);
    setMessage(null);

    if (!dateOfBirth) {
      setError('Date of birth is required.');
      return;
    }
    // Checked again server-side (handle_new_user, on the auth.users insert
    // trigger) - this is just for an immediate message instead of a round trip.
    if (calculateAge(dateOfBirth) < MIN_SIGNUP_AGE) {
      setError(`You must be at least ${MIN_SIGNUP_AGE} years old to sign up.`);
      return;
    }

    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { date_of_birth: dateToIsoDateString(dateOfBirth) },
      },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, Supabase returns a user but no session.
    if (data.user && !data.session) {
      setMessage('Check your email to confirm your account before logging in.');
    }
    // If confirmation is disabled, a session is returned and the root layout redirects automatically.
  }

  return (
    <AuthScreenContainer>
      <Text style={styles.title}>Sign up</Text>

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
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordStrengthMeter password={password} />

      <DateOfBirthPicker value={dateOfBirth} onChange={setDateOfBirth} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={isSubmitting || !email || !password || !dateOfBirth}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign up</Text>
        )}
      </Pressable>

      <Link href="/login" style={styles.link}>
        Already have an account? Log in
      </Link>
    </AuthScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  message: {
    color: '#059669',
  },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: '#2563eb',
  },
});
