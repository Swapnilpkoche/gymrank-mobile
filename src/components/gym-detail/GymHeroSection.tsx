import { Feather } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export function GymHeroSection({
  photoUrl,
  name,
  category,
  locationText,
}: {
  photoUrl: string | null;
  name: string;
  category: string | null;
  locationText: string | null;
}) {
  return (
    <View style={styles.container}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Feather name="image" size={40} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.overlay}>
        {category ? (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{category}</Text>
          </View>
        ) : null}
        <Text style={styles.name}>{name}</Text>
        {locationText ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={colors.textPrimary} />
            <Text style={styles.locationText}>{locationText}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 240,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#020617cc',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.emerald,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  categoryTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
});
