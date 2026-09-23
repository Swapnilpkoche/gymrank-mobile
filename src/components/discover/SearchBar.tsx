import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fontSize, radius } from '../../theme';
import { spacing } from '../../theme';

export function SearchBar({
  value,
  onChangeText,
  isSearching,
}: {
  value: string;
  onChangeText: (text: string) => void;
  isSearching?: boolean;
}) {
  return (
    <View style={styles.container}>
      <Feather name="search" size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        placeholder="Search gyms, areas, members..."
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {isSearching ? (
        <ActivityIndicator color={colors.textMuted} size="small" />
      ) : value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
});
