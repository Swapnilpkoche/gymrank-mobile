import { Feather } from '@expo/vector-icons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { AlbumItem } from '../../types/database';

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const ALBUM_TILE_WIDTH = '31.5%' as const;

export function AlbumThumb({
  item,
  onPress,
  onDelete,
  onToggleVisibility,
  overlayLabel,
}: {
  item: AlbumItem;
  onPress: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  overlayLabel?: string;
}) {
  // Both actions are only ever passed for the owner's own album (the same
  // gate onDelete already used), so a single badge doubles as the entry
  // point to both instead of the old instant-delete tap.
  function handleManagePress() {
    const options: Array<{ text: string; onPress?: () => void; style?: 'destructive' | 'cancel' }> =
      [];
    if (onToggleVisibility) {
      options.push({
        text: item.visibility === 'private' ? 'Make Public' : 'Make Private',
        onPress: onToggleVisibility,
      });
    }
    if (onDelete) {
      options.push({ text: 'Delete', style: 'destructive', onPress: onDelete });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(item.mediaType === 'photo' ? 'Photo options' : 'Video options', undefined, options);
  }

  return (
    <Pressable style={styles.tile} onPress={onPress}>
      {item.mediaType === 'photo' ? (
        <Image source={{ uri: item.url }} style={styles.thumb} />
      ) : (
        <View style={styles.thumb}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.videoBackground} />
          ) : (
            <View style={[styles.videoBackground, styles.videoPlaceholder]} />
          )}
          <View style={styles.playIconWrap} pointerEvents="none">
            <Feather name="play-circle" size={26} color="#fff" />
          </View>
          {item.durationSeconds !== null ? (
            <Text style={styles.durationBadge}>{formatDuration(item.durationSeconds)}</Text>
          ) : null}
        </View>
      )}

      {item.visibility === 'private' ? (
        <View style={styles.privateBadge} pointerEvents="none">
          <Feather name="lock" size={10} color="#fff" />
        </View>
      ) : null}

      {overlayLabel ? (
        <View style={styles.moreOverlay}>
          <Text style={styles.moreOverlayText}>{overlayLabel}</Text>
        </View>
      ) : onDelete || onToggleVisibility ? (
        <Pressable style={styles.manageBadge} onPress={handleManagePress} hitSlop={6}>
          <Feather name="more-vertical" size={12} color="#fff" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: ALBUM_TILE_WIDTH,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoPlaceholder: {
    backgroundColor: '#1e293b',
  },
  playIconWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#00000099',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  privateBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000b3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlayText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
