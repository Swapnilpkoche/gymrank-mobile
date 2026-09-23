import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '../../theme';

const MAX_PHOTOS = 6;

export function PhotoPicker({
  uris,
  onChange,
}: {
  uris: string[];
  onChange: (uris: string[]) => void;
}) {
  async function handleAddPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_PHOTOS - uris.length),
      quality: 0.7,
    });

    if (result.canceled) return;
    onChange([...uris, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_PHOTOS));
  }

  function handleRemove(uri: string) {
    onChange(uris.filter((existing) => existing !== uri));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos (optional)</Text>
      <Text style={styles.hint}>Add a few photos of the gym exterior/interior.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {uris.map((uri) => (
          <View key={uri} style={styles.thumbWrapper}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable style={styles.removeBadge} onPress={() => handleRemove(uri)}>
              <Feather name="x" size={12} color={colors.white} />
            </Pressable>
          </View>
        ))}

        {uris.length < MAX_PHOTOS ? (
          <Pressable style={styles.addButton} onPress={handleAddPhotos}>
            <Feather name="plus" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  row: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radius.md,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
});
