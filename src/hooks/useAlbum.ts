import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  deleteAlbumItem,
  fetchAlbumItems,
  fetchMediaLimits,
  updateMediaVisibility,
  uploadAlbumPhoto,
  uploadAlbumVideo,
  type UploadAlbumMediaResult,
} from '../lib/album';
import { confirmDelete } from '../lib/confirmations';
import type { AlbumItem, AlbumMediaType, AlbumVisibility } from '../types/database';

// Alert-based chooser, matching the existing "Add Video" record/library
// picker pattern already used in this hook.
function promptVisibility(onChoice: (visibility: AlbumVisibility) => void) {
  Alert.alert('Who can see this?', "You can change this later from the item's options.", [
    { text: 'Public', onPress: () => onChoice('public') },
    { text: 'Private (mutual followers only)', onPress: () => onChoice('private') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

const MAX_VIDEO_SECONDS = 15;

// Shared by the Profile-tab preview (AlbumSection) and the full-grid screen
// (app/album/[userId]/[mediaType].tsx) so upload/delete logic lives in one
// place. Safe to call for a user other than the caller: fetchAlbumItems is
// public, and fetchMediaLimits/deleteAlbumItem/upload* just no-op or get
// rejected by RLS for a non-owner - callers gate the add/delete UI on their
// own isOwnProfile check, this hook doesn't need to know about that.
export function useAlbum(userId: string) {
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [photoLimit, setPhotoLimit] = useState(5);
  const [videoLimit, setVideoLimit] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<AlbumMediaType | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [albumItems, limits] = await Promise.all([
        fetchAlbumItems(userId),
        fetchMediaLimits(userId),
      ]);
      setItems(albumItems);
      setPhotoLimit(limits.photoLimit);
      setVideoLimit(limits.videoLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the album.');
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const photoCount = items.filter((item) => item.mediaType === 'photo').length;
  const videoCount = items.filter((item) => item.mediaType === 'video').length;

  // Uploads one at a time (not in parallel) so progress can be tracked and
  // shown, and so a cap-exceeded rejection on item N stops the rest right
  // away instead of firing N identical alerts.
  async function runBatchUpload(
    mediaType: AlbumMediaType,
    uploaders: Array<() => Promise<UploadAlbumMediaResult>>
  ) {
    setUploadingType(mediaType);
    const total = uploaders.length;
    let failureCount = 0;

    for (let i = 0; i < total; i += 1) {
      setUploadProgress({ current: i + 1, total });
      try {
        const result = await uploaders[i]();
        if (result.kind === 'success') {
          setItems((prev) => [result.item, ...prev]);
        } else if (result.kind === 'limit_exceeded') {
          Alert.alert("Can't add more", result.message);
          break;
        } else {
          failureCount += 1;
        }
      } catch (err) {
        failureCount += 1;
      }
    }

    setUploadProgress(null);
    setUploadingType(null);

    if (failureCount > 0) {
      Alert.alert(
        'Some uploads failed',
        `${failureCount} of ${total} item${total === 1 ? '' : 's'} couldn't be uploaded. Please try again.`
      );
    }
  }

  async function addPhotos() {
    const remainingSlots = Math.max(0, photoLimit - photoCount);
    if (remainingSlots <= 0) {
      Alert.alert(
        "Can't add more",
        `You can upload up to ${photoLimit} photos on the free plan. Upgrade to add more.`
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    // Video multi-select is flaky across platforms in expo-image-picker
    // (particularly Android), so this is deliberately images-only - video
    // stays single-pick via addVideoOptions below.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.7,
    });
    if (result.canceled) return;

    const uris = result.assets.map((asset) => asset.uri);
    if (uris.length === 0) return;

    promptVisibility((visibility) => {
      runBatchUpload(
        'photo',
        uris.map((uri) => () => uploadAlbumPhoto(userId, uri, visibility))
      );
    });
  }

  async function handleVideoAsset(asset: ImagePicker.ImagePickerAsset | undefined) {
    if (!asset) return;

    const durationSeconds = asset.duration != null ? asset.duration / 1000 : 0;
    if (durationSeconds > MAX_VIDEO_SECONDS) {
      Alert.alert('Video too long', `Videos must be ${MAX_VIDEO_SECONDS} seconds or under.`);
      return;
    }

    // Best-effort: a failed thumbnail extraction shouldn't block the video
    // upload, it just falls back to the placeholder.
    const thumbnailUri = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 })
      .then((result) => result.uri)
      .catch(() => null);

    promptVisibility((visibility) => {
      runBatchUpload('video', [
        () => uploadAlbumVideo(userId, asset.uri, durationSeconds, thumbnailUri, visibility),
      ]);
    });
  }

  async function recordVideo() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (result.canceled) return;

    await handleVideoAsset(result.assets[0]);
  }

  async function chooseVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (result.canceled) return;

    await handleVideoAsset(result.assets[0]);
  }

  function addVideoOptions() {
    Alert.alert(
      'Add Video',
      `Record a new video or choose one from your library. Max ${MAX_VIDEO_SECONDS} seconds.`,
      [
        { text: 'Record Video', onPress: recordVideo },
        { text: 'Choose from Library', onPress: chooseVideo },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function deleteItem(item: AlbumItem) {
    confirmDelete(item.mediaType, async () => {
      const previousItems = items;
      setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      try {
        await deleteAlbumItem(item);
      } catch (err) {
        setItems(previousItems);
        Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
      }
    });
  }

  // Not optimistic: this physically moves a file between storage buckets, so
  // there's a real network round trip before the new visibility (and its
  // freshly-resolved URL) is actually true.
  async function toggleVisibility(item: AlbumItem) {
    const nextVisibility: AlbumVisibility = item.visibility === 'private' ? 'public' : 'private';
    try {
      const result = await updateMediaVisibility(item, nextVisibility);
      if (result.kind === 'success') {
        setItems((prev) =>
          prev.map((existing) => (existing.id === item.id ? result.item : existing))
        );
      } else {
        Alert.alert('Something went wrong', result.message);
      }
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return {
    items,
    photoCount,
    videoCount,
    photoLimit,
    videoLimit,
    isLoading,
    uploadingType,
    uploadProgress,
    error,
    addPhotos,
    addVideoOptions,
    deleteItem,
    toggleVisibility,
    reload: load,
  };
}
