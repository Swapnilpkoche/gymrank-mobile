import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

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
              <Feather name="x" size={12} color="#fff" />
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
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
});
