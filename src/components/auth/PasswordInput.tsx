import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing } from '../../theme';

const TOGGLE_SIZE = 40;

// A TextInput with a show/hide (eye) toggle on the right. `style` is the
// caller's normal input style, so each screen's fields keep looking the same -
// this only reserves room on the right for the toggle. Each field has its own
// visibility state, so revealing one never reveals another.
export function PasswordInput({ style, ...props }: Omit<TextInputProps, 'secureTextEntry'>) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        {...props}
        style={[style, styles.input]}
        secureTextEntry={!isVisible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setIsVisible((prev) => !prev)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
      >
        <Feather name={isVisible ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  input: {
    paddingRight: TOGGLE_SIZE + spacing.xs,
  },
  toggle: {
    position: 'absolute',
    right: spacing.xs,
    width: TOGGLE_SIZE,
    height: TOGGLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
