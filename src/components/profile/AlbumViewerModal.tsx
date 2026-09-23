import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Modal, Pressable, StyleSheet } from 'react-native';

import type { AlbumItem } from '../../types/database';

// A fresh instance per item (keyed by id below) so the player is created
// and torn down alongside the modal content - no play state leaking
// between videos, no manual pause-on-close wiring needed.
function VideoPlayerView({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });

  return (
    <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
  );
}

export function AlbumViewerModal({
  item,
  onClose,
}: {
  item: AlbumItem | null;
  onClose: () => void;
}) {
  const isPhoto = item?.mediaType === 'photo';

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      {/* Video has its own native controls to interact with, so background-tap-to-close
          is limited to photos - the close button below still works for both. */}
      <Pressable style={styles.overlay} onPress={isPhoto ? onClose : undefined}>
        {isPhoto ? (
          <Image source={{ uri: item.url }} style={styles.image} resizeMode="contain" />
        ) : item ? (
          <VideoPlayerView key={item.id} url={item.url} />
        ) : null}
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  video: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff26',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
