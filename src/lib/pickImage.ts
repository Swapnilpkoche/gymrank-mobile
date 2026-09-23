import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { PickedImage } from './trainer';

// Returns null when the user cancels or denies access.
export async function pickImage(options: { square?: boolean } = {}): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', 'Allow photo access in your device settings to choose an image.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options.square ?? false,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.7,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;

  return { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
}
