import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AlbumCategoryPreview } from './AlbumCategoryPreview';
import { AlbumViewerModal } from './AlbumViewerModal';
import { useAlbum } from '../../hooks/useAlbum';
import type { AlbumItem, AlbumMediaType } from '../../types/database';
import { colors, fontSize, spacing } from '../../theme';

export function AlbumSection({ userId, refreshToken }: { userId: string; refreshToken: number }) {
  const router = useRouter();
  const album = useAlbum(userId);
  const [viewerItem, setViewerItem] = useState<AlbumItem | null>(null);

  useEffect(() => {
    album.reload();
    // Only re-run when the parent's pull-to-refresh bumps this - `reload`
    // itself is stable for a given userId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const photos = album.items.filter((item) => item.mediaType === 'photo');
  const videos = album.items.filter((item) => item.mediaType === 'video');

  function handleItemPress(item: AlbumItem) {
    setViewerItem(item);
  }

  function goToFullAlbum(mediaType: AlbumMediaType) {
    router.push({
      pathname: '/album/[userId]/[mediaType]',
      params: { userId, mediaType: mediaType === 'photo' ? 'photos' : 'videos' },
    });
  }

  return (
    <View style={styles.container}>
      {album.error ? <Text style={styles.error}>{album.error}</Text> : null}

      <AlbumCategoryPreview
        title="Photos"
        items={photos}
        countLabel={album.isLoading ? undefined : `${album.photoCount}/${album.photoLimit}`}
        emptyLabel="No photos yet. Tap Add to get started."
        onItemPress={handleItemPress}
        onSeeAll={() => goToFullAlbum('photo')}
        onAdd={album.addPhotos}
        onDeleteItem={album.deleteItem}
        onToggleVisibility={album.toggleVisibility}
        isAddBusy={album.uploadingType !== null}
        uploadProgress={album.uploadingType === 'photo' ? album.uploadProgress : null}
      />

      <AlbumCategoryPreview
        title="Videos"
        items={videos}
        countLabel={album.isLoading ? undefined : `${album.videoCount}/${album.videoLimit}`}
        emptyLabel="No videos yet. Tap Add to get started."
        onItemPress={handleItemPress}
        onSeeAll={() => goToFullAlbum('video')}
        onAdd={album.addVideoOptions}
        onDeleteItem={album.deleteItem}
        onToggleVisibility={album.toggleVisibility}
        isAddBusy={album.uploadingType !== null}
        uploadProgress={album.uploadingType === 'video' ? album.uploadProgress : null}
      />

      <AlbumViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxl,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
  },
});
