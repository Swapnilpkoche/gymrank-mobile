import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../../theme/colors';

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
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
});
