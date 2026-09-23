import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AlbumGrid } from '../../../src/components/profile/AlbumGrid';
import { AlbumViewerModal } from '../../../src/components/profile/AlbumViewerModal';
import { useAuth } from '../../../src/context/auth-context';
import { useAlbum } from '../../../src/hooks/useAlbum';
import { colors, fontSize, radius, spacing } from '../../../src/theme';
import type { AlbumItem, AlbumMediaType } from '../../../src/types/database';

export default function FullAlbumScreen() {
  const { userId, mediaType: mediaTypeParam } = useLocalSearchParams<{
    userId: string;
    mediaType: string;
  }>();
  const mediaType: AlbumMediaType = mediaTypeParam === 'videos' ? 'video' : 'photo';
  const title = mediaType === 'photo' ? 'Photos' : 'Videos';

  const { session } = useAuth();
  const isOwnProfile = session?.user.id === userId;

  const album = useAlbum(userId);
  const [viewerItem, setViewerItem] = useState<AlbumItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await album.reload();
    setIsRefreshing(false);
    // album.reload is stable for this userId - only depend on the object
    // identity that actually changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.reload]);

  const items = album.items.filter((item) => item.mediaType === mediaType);
  const countLabel =
    mediaType === 'photo'
      ? `${album.photoCount}/${album.photoLimit}`
      : `${album.videoCount}/${album.videoLimit}`;
  const isThisUploading = album.uploadingType === mediaType;

  function handleItemPress(item: AlbumItem) {
    setViewerItem(item);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.emerald}
        />
      }
    >
      <Stack.Screen options={{ title }} />

      <View style={styles.headerRow}>
        {isOwnProfile && !album.isLoading ? (
          <Text style={styles.countLabel}>{countLabel}</Text>
        ) : null}

        {isOwnProfile ? (
          <Pressable
            style={styles.addButton}
            onPress={mediaType === 'photo' ? album.addPhotos : album.addVideoOptions}
            disabled={album.uploadingType !== null}
          >
            {isThisUploading && album.uploadProgress && album.uploadProgress.total > 1 ? (
              <Text style={styles.addButtonText}>
                Uploading {album.uploadProgress.current} of {album.uploadProgress.total}…
              </Text>
            ) : album.uploadingType !== null ? (
              <ActivityIndicator color={colors.emerald} size="small" />
            ) : (
              <>
                <Feather name="plus" size={14} color={colors.emerald} />
                <Text style={styles.addButtonText}>Add</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {album.error ? <Text style={styles.error}>{album.error}</Text> : null}

      {album.isLoading ? (
        <ActivityIndicator color={colors.emerald} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No {title.toLowerCase()} yet.</Text>
      ) : (
        <AlbumGrid
          items={items}
          onItemPress={handleItemPress}
          onDeleteItem={isOwnProfile ? album.deleteItem : undefined}
          onToggleVisibility={isOwnProfile ? album.toggleVisibility : undefined}
        />
      )}

      <AlbumViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countLabel: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginLeft: 'auto',
  },
  addButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: fontSize.base,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.base,
  },
  empty: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
});
