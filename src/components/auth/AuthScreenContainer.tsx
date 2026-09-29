import { Feather } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

const TOP_BUTTON_SIZE = 40;

// Shared shell for the auth screens. Centers the form like before, but lets it
// scroll and lifts it above the keyboard so every input stays reachable on
// small phones. Same iOS-padding / Android-resize approach as the message
// thread screen.
//
// The (auth) stack hides the native header, so the close/back button is drawn
// here as an absolutely positioned overlay instead. Turning the header on would
// shift this view down and throw off KeyboardAvoidingView's overlap maths
// (it measures its layout frame, not its window position).
//
// - 'close': leaves the whole (auth) group and returns to whatever the guest
//   was browsing (Sign In / Sign Up, which are always the root of this stack).
// - 'back': steps back one screen within the auth flow (Forgot / Reset).
export function AuthScreenContainer({
  children,
  topAction,
}: {
  children: ReactNode;
  topAction: 'close' | 'back';
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  function handleClose() {
    // The parent is the root stack, where (auth) sits on top of (tabs) or
    // whichever screen pushed it - popping it there drops the whole group.
    const rootNavigation = navigation.getParent();
    if (rootNavigation?.canGoBack()) {
      rootNavigation.goBack();
    } else {
      // Opened cold (e.g. a deep link) with nothing underneath.
      router.replace('/');
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + TOP_BUTTON_SIZE + spacing.sm },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>

      <Pressable
        style={[styles.topButton, { top: insets.top + spacing.xs }]}
        onPress={topAction === 'close' ? handleClose : handleBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={topAction === 'close' ? 'Close' : 'Back'}
      >
        <Feather
          name={
            topAction === 'close' ? 'x' : Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'
          }
          size={24}
          color={colors.textPrimary}
        />
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  topButton: {
    position: 'absolute',
    left: spacing.sm,
    width: TOP_BUTTON_SIZE,
    height: TOP_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
