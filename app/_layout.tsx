import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DobBackfillModal } from '../src/components/profile/DobBackfillModal';
import { AuthProvider, useAuth } from '../src/context/auth-context';
import { fetchDateOfBirth } from '../src/lib/profile';
import { colors } from '../src/theme/colors';

function RootNavigation() {
  const { session, isLoading } = useAuth();
  const pathname = usePathname();
  const inAuthGroup = pathname.startsWith('/login') || pathname.startsWith('/signup');

  // Existing users who signed up before date_of_birth existed get a one-time
  // prompt per session rather than a permanent block - "dismissed" lives only
  // in memory here, so it naturally resets (and the prompt reappears) on the
  // next cold start or login, exactly as intended.
  const [dobStatus, setDobStatus] = useState<'checking' | 'missing' | 'present'>('checking');
  const [dobPromptDismissed, setDobPromptDismissed] = useState(false);

  useEffect(() => {
    if (!session) {
      setDobStatus('checking');
      setDobPromptDismissed(false);
      return;
    }

    let isMounted = true;
    fetchDateOfBirth(session.user.id)
      .then((dob) => {
        if (isMounted) setDobStatus(dob ? 'present' : 'missing');
      })
      .catch(() => {
        // Best-effort: a failed lookup shouldn't block the user from using
        // the app - just skip the prompt for this session.
        if (isMounted) setDobStatus('present');
      });
    return () => {
      isMounted = false;
    };
    // Re-check only when the logged-in user actually changes, not on every
    // token refresh (which produces a new session object with the same id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Discover and the rest of the (tabs) group are browsable as a guest.
  // Only bounce a signed-in user away from the login/signup screens.
  if (session && inAuthGroup) {
    return <Redirect href="/" />;
  }

  // Any screen outside the 4 main tabs is pushed on top of this stack, so it
  // gets a header with a standard back arrow to Discover/whatever screen it
  // was opened from. The (tabs) and (auth) groups manage their own chrome.
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="gym/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="gym/[id]/face-of-gym" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="gym/[id]/members" options={{ headerShown: true, title: 'Members' }} />
        <Stack.Screen name="city-bracket/[contestPeriodId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="compare/[gymAId]/[gymBId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="trainer/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="album/[userId]/[mediaType]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="messages" options={{ headerShown: true, title: 'Messages' }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
        <Stack.Screen name="messages/[threadId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="list-gym" options={{ headerShown: true, title: 'List your gym' }} />
        <Stack.Screen
          name="change-password"
          options={{ headerShown: true, title: 'Change Password' }}
        />
        <Stack.Screen
          name="check-in-history"
          options={{ headerShown: true, title: 'Check-In History' }}
        />
      </Stack>

      {session ? (
        <DobBackfillModal
          visible={dobStatus === 'missing' && !dobPromptDismissed}
          userId={session.user.id}
          onSkip={() => setDobPromptDismissed(true)}
          onSaved={() => setDobStatus('present')}
        />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
