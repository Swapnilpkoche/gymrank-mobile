import { supabase } from './supabase';
import type { AlbumItem, AlbumMediaType, AlbumVisibility } from '../types/database';

// Regenerated on every album load - simpler than caching/refreshing a
// long-lived signed URL, and album items are viewed in short sessions anyway.
const PRIVATE_URL_EXPIRY_SECONDS = 60 * 60;

function bucketForVisibility(visibility: AlbumVisibility): string {
  return visibility === 'private' ? 'profile-media-private' : 'profile-media';
}

// Public media uses a plain public URL like before. Private media MUST go
// through the authenticated client's signed-URL endpoint - a raw public-style
// URL for the private bucket just 404s, and more importantly the storage RLS
// policy (uploader or mutual follower, see is_mutual_follow()) is what
// actually decides whether createSignedUrl succeeds at all. Returns null if
// the caller isn't permitted to see this file.
async function resolveMediaUrl(path: string, visibility: AlbumVisibility): Promise<string | null> {
  const bucket = bucketForVisibility(visibility);
  if (visibility === 'public') {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, PRIVATE_URL_EXPIRY_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

type RawProfileMediaRow = {
  id: number;
  media_type: AlbumMediaType;
  file_path: string;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  visibility: AlbumVisibility;
};

async function toAlbumItem(row: RawProfileMediaRow): Promise<AlbumItem> {
  const [url, thumbnailUrl] = await Promise.all([
    resolveMediaUrl(row.file_path, row.visibility),
    row.thumbnail_path ? resolveMediaUrl(row.thumbnail_path, row.visibility) : Promise.resolve(null),
  ]);

  return {
    id: row.id,
    mediaType: row.media_type,
    filePath: row.file_path,
    // profile_media rows are readable by anyone (metadata isn't secret), but
    // a viewer without file access gets null back from resolveMediaUrl - an
    // empty uri just fails to load rather than crashing.
    url: url ?? '',
    durationSeconds: row.duration_seconds,
    thumbnailPath: row.thumbnail_path,
    thumbnailUrl,
    visibility: row.visibility,
  };
}

export async function fetchAlbumItems(userId: string): Promise<AlbumItem[]> {
  const { data, error } = await supabase
    .from('profile_media')
    .select('id, media_type, file_path, duration_seconds, thumbnail_path, visibility')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Promise.all(((data ?? []) as RawProfileMediaRow[]).map(toAlbumItem));
}

export async function fetchMediaLimits(
  userId: string
): Promise<{ photoLimit: number; videoLimit: number }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('photo_limit, video_limit')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    photoLimit: data?.photo_limit ?? 5,
    videoLimit: data?.video_limit ?? 3,
  };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function extensionFromUri(uri: string, fallback: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1] : fallback;
}

export type UploadAlbumMediaResult =
  | { kind: 'success'; item: AlbumItem }
  | { kind: 'limit_exceeded'; message: string }
  | { kind: 'error'; message: string };

// Insert the row BEFORE uploading the file: trg_enforce_media_limits runs
// on that insert, so a cap-exceeded rejection never touches storage at all
// (no wasted upload, no orphaned file to clean up). The reverse order would
// need a rollback path for the common case instead of just the rare one
// (DB row created but the following storage upload itself fails).
async function insertAndUpload(
  userId: string,
  localUri: string,
  mediaType: AlbumMediaType,
  fallbackExtension: string,
  durationSeconds: number | null,
  thumbnailUri: string | null,
  visibility: AlbumVisibility
): Promise<UploadAlbumMediaResult> {
  const timestamp = Date.now();
  const path = `${userId}/${mediaType}-${timestamp}.${extensionFromUri(localUri, fallbackExtension)}`;
  const thumbnailPath = thumbnailUri
    ? `${userId}/${mediaType}-${timestamp}-thumb.${extensionFromUri(thumbnailUri, 'jpg')}`
    : null;
  const bucket = bucketForVisibility(visibility);

  const { data, error: insertError } = await supabase
    .from('profile_media')
    .insert({
      user_id: userId,
      media_type: mediaType,
      file_path: path,
      duration_seconds: durationSeconds,
      thumbnail_path: thumbnailPath,
      visibility,
    })
    .select('id, media_type, file_path, duration_seconds, thumbnail_path, visibility')
    .single();

  if (insertError) {
    // Default SQLSTATE for a plain RAISE EXCEPTION (trg_enforce_media_limits
    // has no custom code) is P0001 - same pattern as the follow/review caps.
    if (insertError.code === 'P0001') {
      return { kind: 'limit_exceeded', message: insertError.message };
    }
    return { kind: 'error', message: insertError.message };
  }

  const blob = await uriToBlob(localUri);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob);

  if (uploadError) {
    await supabase.from('profile_media').delete().eq('id', data.id);
    return { kind: 'error', message: uploadError.message };
  }

  // Thumbnail upload is best-effort: if it fails, the item still has a
  // valid video and just falls back to the placeholder instead of failing
  // the whole upload over a decoration.
  let finalThumbnailPath = thumbnailPath;
  if (thumbnailPath && thumbnailUri) {
    try {
      const thumbBlob = await uriToBlob(thumbnailUri);
      const { error: thumbUploadError } = await supabase.storage
        .from(bucket)
        .upload(thumbnailPath, thumbBlob);
      if (thumbUploadError) throw thumbUploadError;
    } catch {
      finalThumbnailPath = null;
      try {
        await supabase.from('profile_media').update({ thumbnail_path: null }).eq('id', data.id);
      } catch {
        // Stale thumbnail_path in the DB just means one broken image URL
        // until the row is next touched - not worth surfacing.
      }
    }
  }

  return {
    kind: 'success',
    item: await toAlbumItem({ ...(data as RawProfileMediaRow), thumbnail_path: finalThumbnailPath }),
  };
}

export async function uploadAlbumPhoto(
  userId: string,
  localUri: string,
  visibility: AlbumVisibility
): Promise<UploadAlbumMediaResult> {
  return insertAndUpload(userId, localUri, 'photo', 'jpg', null, null, visibility);
}

export async function uploadAlbumVideo(
  userId: string,
  localUri: string,
  durationSeconds: number,
  thumbnailUri: string | null,
  visibility: AlbumVisibility
): Promise<UploadAlbumMediaResult> {
  return insertAndUpload(userId, localUri, 'video', 'mp4', durationSeconds, thumbnailUri, visibility);
}

export async function deleteAlbumItem(item: AlbumItem): Promise<void> {
  const { error } = await supabase.from('profile_media').delete().eq('id', item.id);
  if (error) throw error;

  // Best-effort: an orphaned storage object with no DB row is invisible and
  // doesn't count toward the upload caps, so a failure here isn't worth
  // surfacing to the user.
  const bucket = bucketForVisibility(item.visibility);
  const paths = item.thumbnailPath ? [item.filePath, item.thumbnailPath] : [item.filePath];
  await supabase.storage.from(bucket).remove(paths).catch(() => {});
}

async function downloadBlob(bucket: string, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error('Failed to download file.');
  return data;
}

export type UpdateMediaVisibilityResult =
  | { kind: 'success'; item: AlbumItem }
  | { kind: 'error'; message: string };

// "Move" means physically copying the bytes into the destination bucket and
// removing them from the source bucket - just flipping the `visibility`
// column would leave the file readable wherever it already sits, which is
// exactly the hole this feature exists to close.
export async function updateMediaVisibility(
  item: AlbumItem,
  nextVisibility: AlbumVisibility
): Promise<UpdateMediaVisibilityResult> {
  if (item.visibility === nextVisibility) {
    return { kind: 'success', item };
  }

  const sourceBucket = bucketForVisibility(item.visibility);
  const destBucket = bucketForVisibility(nextVisibility);
  const paths = item.thumbnailPath ? [item.filePath, item.thumbnailPath] : [item.filePath];

  try {
    for (const path of paths) {
      const blob = await downloadBlob(sourceBucket, path);
      const { error: uploadError } = await supabase.storage
        .from(destBucket)
        .upload(path, blob, { upsert: true });
      if (uploadError) throw uploadError;
    }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : 'Failed to move file.' };
  }

  const { error: updateError } = await supabase
    .from('profile_media')
    .update({ visibility: nextVisibility })
    .eq('id', item.id);

  if (updateError) {
    // The new copy exists but the DB still points at the old visibility -
    // clean up the new copy so nothing is duplicated, then surface the
    // error. The original copy hasn't been touched, so there's no privacy
    // exposure from failing here.
    await supabase.storage.from(destBucket).remove(paths).catch(() => {});
    return { kind: 'error', message: updateError.message };
  }

  // Only now remove the old copy. Private -> public: a leftover old copy is
  // harmless, RLS still protects it. Public -> private: a leftover copy left
  // behind in the PUBLIC bucket is a real leak (fetchable by anyone,
  // unconditionally) - that direction gets a retry and a hard failure
  // instead of a silent best-effort swallow.
  const removeOldCopy = async () => {
    const { error } = await supabase.storage.from(sourceBucket).remove(paths);
    return !error;
  };

  let removedOldCopy = await removeOldCopy();
  if (!removedOldCopy) removedOldCopy = await removeOldCopy();

  if (!removedOldCopy && nextVisibility === 'private') {
    return {
      kind: 'error',
      message:
        "This item is now marked private, but we couldn't remove the old public copy. Please try toggling it again.",
    };
  }

  const updatedItem = await toAlbumItem({
    id: item.id,
    media_type: item.mediaType,
    file_path: item.filePath,
    duration_seconds: item.durationSeconds,
    thumbnail_path: item.thumbnailPath,
    visibility: nextVisibility,
  });

  return { kind: 'success', item: updatedItem };
}
