import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { AlbumItem } from '../../types/database';
import { colors, fontSize, radius, spacing } from '../../theme';

// One player per video page, created and torn down with the page, so there's
// no play state leaking between videos. Only the page on screen plays -
// swiping away pauses it, swiping back resumes from where it was.
function VideoPlayerView({ url, isActive }: { url: string; isActive: boolean }) {
  const player = useVideoPlayer(url);

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView player={player} style={styles.media} nativeControls contentFit="contain" />
  );
}

// Keyed on the opened item, so each open starts fresh on the tapped item.
function ViewerPager({
  items,
  startIndex,
  onClose,
}: {
  items: AlbumItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(startIndex);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.overlay}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        // Keeps neighbours ready for a smooth swipe without holding a video
        // player open for every item in the album.
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width }]}>
            {item.mediaType === 'photo' ? (
              // Video has its own native controls to interact with, so
              // tap-to-close is limited to photos - the close button below
              // still works for both.
              <Pressable style={styles.photoTapArea} onPress={onClose}>
                <Image source={{ uri: item.url }} style={styles.media} resizeMode="contain" />
              </Pressable>
            ) : (
              <VideoPlayerView url={item.url} isActive={index === activeIndex} />
            )}
          </View>
        )}
      />

      {items.length > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {activeIndex + 1} / {items.length}
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
        <Feather name="x" size={22} color={colors.white} />
      </Pressable>
    </View>
  );
}

// `items` is the album the item was opened from. Swiping stays within the
// opened item's own media type, so callers can pass the whole album and
// photos never swipe into videos (or vice versa).
export function AlbumViewerModal({
  item,
  items,
  onClose,
}: {
  item: AlbumItem | null;
  items: AlbumItem[];
  onClose: () => void;
}) {
  const siblings = item ? items.filter((other) => other.mediaType === item.mediaType) : [];
  const foundIndex = item ? siblings.findIndex((other) => other.id === item.id) : -1;
  // Shouldn't happen, but if the opened item isn't in the list, still show it.
  const pagerItems = foundIndex === -1 && item ? [item] : siblings;
  const startIndex = Math.max(foundIndex, 0);

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      {item ? (
        <ViewerPager key={item.id} items={pagerItems} startIndex={startIndex} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrimHeavy,
  },
  page: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTapArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: '100%',
    height: '80%',
  },
  counter: {
    position: 'absolute',
    top: 56,
    left: 20,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff26',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
