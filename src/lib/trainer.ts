import { supabase } from './supabase';
import { formatWaitDuration } from './time';
import type {
  MyGymHistoryItem,
  StaffRequest,
  TrainerAffiliation,
  TrainerCertification,
  TrainerProfile,
} from '../types/database';

const PHOTO_BUCKET = 'trainer-photos';
const CERTIFICATE_BUCKET = 'trainer-certificates';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// These mirror limits enforced in the DB (table CHECKs, the certification
// trigger, and the buckets' file_size_limit) - the DB is the real gate, the
// client just checks first so the user gets a clear message instead of a
// constraint error.
export const MAX_BIO_LENGTH = 1000;
export const MAX_SPECIALTIES = 10;
export const MAX_SPECIALTIES_TOTAL_LENGTH = 300;
export const MAX_CERTIFICATIONS = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const NOT_ADULT_MESSAGE =
  'Trainer profiles are for users 18 and over. Make sure your date of birth is set in Edit Profile.';

export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1].toLowerCase() : 'jpg';
}

// Both buckets restrict allowed mime types, so send an explicit content type
// (from the picker, falling back to the file extension) instead of relying on
// whatever the fetched blob reports - which is often empty for local files.
// An ArrayBuffer body is what makes supabase-js honour `contentType`.
async function uploadImage(
  bucket: string,
  userId: string,
  filePrefix: string,
  image: PickedImage
): Promise<string> {
  if (image.fileSize && image.fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const contentType = image.mimeType ?? MIME_BY_EXTENSION[extensionFromUri(image.uri)] ?? 'image/jpeg';
  const extension = EXTENSION_BY_MIME[contentType] ?? 'jpg';
  // Path is prefixed with the user's own id to satisfy the buckets' storage
  // policies (foldername[1] = auth.uid()).
  const path = `${userId}/${filePrefix}${Date.now()}.${extension}`;

  const response = await fetch(image.uri);
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType });
  if (error) throw error;
  return path;
}

async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Best-effort cleanup - an orphaned object is harmless, a failed cleanup
  // must never fail the user's actual action.
  await supabase.storage.from(bucket).remove(paths);
}

// RLS/storage-policy rejections are how the server-side is_adult() gate
// surfaces: Postgres 42501 for tables, a 403 "row-level security" error for
// storage.
function isPermissionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, statusCode, message } = err as {
    code?: string;
    statusCode?: string | number;
    message?: string;
  };
  return (
    code === '42501' ||
    String(statusCode) === '403' ||
    /row-level security/i.test(message ?? '')
  );
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function publicPhotoUrl(path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

type RawTrainerProfileRow = {
  user_id: string;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  photo_path: string | null;
};

function toTrainerProfile(row: RawTrainerProfileRow): TrainerProfile {
  return {
    userId: row.user_id,
    bio: row.bio,
    specialties: row.specialties ?? [],
    yearsExperience: row.years_experience,
    photoPath: row.photo_path,
    photoUrl: row.photo_path ? publicPhotoUrl(row.photo_path) : null,
  };
}

export async function fetchTrainerProfile(userId: string): Promise<TrainerProfile | null> {
  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('user_id, bio, specialties, years_experience, photo_path')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? toTrainerProfile(data as RawTrainerProfileRow) : null;
}

// Looked up by id (rather than trusting a name passed through navigation
// params) so the "applying to..." context can't show anything but the real
// gym. Null for a gym the caller can't see (e.g. not active).
export async function fetchGymName(gymId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('gyms')
    .select('name')
    .eq('id', gymId)
    .maybeSingle();

  if (error) throw error;
  return data?.name ?? null;
}

export type SaveTrainerProfileInput = {
  bio: string | null;
  specialties: string[];
  yearsExperience: number | null;
  newPhoto: PickedImage | null;
};

export type SaveTrainerProfileResult =
  | { kind: 'success'; profile: TrainerProfile }
  | { kind: 'not_adult'; message: string }
  | { kind: 'error'; message: string };

export async function saveTrainerProfile(
  userId: string,
  input: SaveTrainerProfileInput,
  existingPhotoPath: string | null
): Promise<SaveTrainerProfileResult> {
  let photoPath = existingPhotoPath;
  let uploadedPath: string | null = null;

  if (input.newPhoto) {
    try {
      uploadedPath = await uploadImage(PHOTO_BUCKET, userId, 'profile-', input.newPhoto);
      photoPath = uploadedPath;
    } catch (err) {
      if (isPermissionError(err)) return { kind: 'not_adult', message: NOT_ADULT_MESSAGE };
      return { kind: 'error', message: errorMessage(err, 'Failed to upload your photo.') };
    }
  }

  const { data, error } = await supabase
    .from('trainer_profiles')
    .upsert(
      {
        user_id: userId,
        bio: input.bio,
        specialties: input.specialties,
        years_experience: input.yearsExperience,
        photo_path: photoPath,
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, bio, specialties, years_experience, photo_path')
    .single();

  if (error) {
    if (uploadedPath) await removeObjects(PHOTO_BUCKET, [uploadedPath]);
    if (isPermissionError(error)) return { kind: 'not_adult', message: NOT_ADULT_MESSAGE };
    return { kind: 'error', message: error.message };
  }

  if (uploadedPath && existingPhotoPath && existingPhotoPath !== uploadedPath) {
    await removeObjects(PHOTO_BUCKET, [existingPhotoPath]);
  }

  return { kind: 'success', profile: toTrainerProfile(data as RawTrainerProfileRow) };
}

type RawCertificationRow = {
  id: number;
  title: string;
  issuing_body: string;
  photo_path: string | null;
};

export async function fetchTrainerCertifications(userId: string): Promise<TrainerCertification[]> {
  const { data, error } = await supabase
    .from('trainer_certifications')
    .select('id, title, issuing_body, photo_path')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as RawCertificationRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    issuingBody: row.issuing_body,
    photoPath: row.photo_path,
  }));
}

// Certificate photos live in a private bucket. Storage RLS only lets the
// owner, and owners/admins of a gym the trainer has a pending or active staff
// row at, create a signed URL - everyone else gets a per-path error, which is
// simply left out of the result (the certificate still shows, just without a
// photo).
export async function fetchCertificatePhotoUrls(
  paths: string[]
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      urls[item.path] = item.signedUrl;
    }
  }
  return urls;
}

export type AddCertificationInput = {
  title: string;
  issuingBody: string;
  photo: PickedImage | null;
};

export type AddCertificationResult =
  | { kind: 'success' }
  | { kind: 'not_adult'; message: string }
  | { kind: 'error'; message: string };

export async function addTrainerCertification(
  userId: string,
  input: AddCertificationInput
): Promise<AddCertificationResult> {
  let photoPath: string | null = null;

  if (input.photo) {
    try {
      photoPath = await uploadImage(CERTIFICATE_BUCKET, userId, 'cert-', input.photo);
    } catch (err) {
      if (isPermissionError(err)) return { kind: 'not_adult', message: NOT_ADULT_MESSAGE };
      return { kind: 'error', message: errorMessage(err, 'Failed to upload the certificate photo.') };
    }
  }

  const { error } = await supabase.from('trainer_certifications').insert({
    user_id: userId,
    title: input.title,
    issuing_body: input.issuingBody,
    photo_path: photoPath,
  });

  if (!error) return { kind: 'success' };

  if (photoPath) await removeObjects(CERTIFICATE_BUCKET, [photoPath]);
  if (isPermissionError(error)) return { kind: 'not_adult', message: NOT_ADULT_MESSAGE };
  // The 10-certification cap is a DB trigger; its message is already clear.
  return { kind: 'error', message: error.message };
}

export async function deleteTrainerCertification(certification: TrainerCertification): Promise<void> {
  const { error } = await supabase
    .from('trainer_certifications')
    .delete()
    .eq('id', certification.id);
  if (error) throw error;

  if (certification.photoPath) {
    await removeObjects(CERTIFICATE_BUCKET, [certification.photoPath]);
  }
}

type RawAffiliationRow = {
  gym_id: number;
  gyms: { name: string; city: string | null } | null;
};

export async function fetchTrainerAffiliations(userId: string): Promise<TrainerAffiliation[]> {
  const { data, error } = await supabase
    .from('gym_staff')
    .select('gym_id, gyms(name, city)')
    .eq('user_id', userId)
    .eq('role', 'trainer')
    .eq('status', 'active');

  if (error) throw error;

  return ((data ?? []) as unknown as RawAffiliationRow[]).map((row) => ({
    gymId: row.gym_id,
    gymName: row.gyms?.name ?? 'Unknown gym',
    city: row.gyms?.city ?? null,
  }));
}

export type MyStaffStatus = {
  role: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended' | 'removed';
  // Epoch ms when a rejected request may be re-sent; null when there's no
  // wait (not rejected, or the cooldown has passed). Derived from the server's
  // clock at fetch time, so a wrong device clock only skews the label.
  retryAt: number | null;
  // For a 'removed' row: when it ended and who ended it, so the person is told
  // plainly - removedBySelf = they left; false = an owner/admin removed them.
  removedAt: string | null;
  removedBySelf: boolean;
};

// The caller's own gym_staff row for a gym, if any (the "view own record" RLS
// policy makes this readable at every status, including pending/rejected).
// gym_staff is unique per (gym, user), so this is one row at most - and it
// covers every role, not just trainer, so an owner/admin sees the right state.
export async function fetchMyStaffStatus(
  gymId: number,
  userId: string
): Promise<MyStaffStatus | null> {
  const { data, error } = await supabase
    .from('gym_staff')
    .select('role, status, removed_at, removed_by')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const status = data.status as MyStaffStatus['status'];
  let retryAt: number | null = null;
  if (status === 'rejected') {
    // Best-effort: if this lookup fails the button just offers "Request
    // again" and the server still refuses (with the real wait) on submit.
    const remaining = await fetchCooldownRemainingSeconds(gymId).catch(() => null);
    if (remaining !== null && remaining > 0) retryAt = Date.now() + remaining * 1000;
  }

  return {
    role: data.role,
    status,
    retryAt,
    removedAt: data.removed_at ?? null,
    removedBySelf: data.removed_by === userId,
  };
}

export type StaffActionResult = { kind: 'success' } | { kind: 'error'; message: string };

// Owner/admin removes an active team member. The rules - who may remove whom
// (admins can't remove owners/admins), no removing yourself - live in the
// remove_gym_staff_member RPC, which raises a plain-language message; the row
// is marked 'removed', never deleted.
export async function removeStaffMember(staffId: number): Promise<StaffActionResult> {
  const { error } = await supabase.rpc('remove_gym_staff_member', { p_staff_id: staffId });
  return error ? { kind: 'error', message: error.message } : { kind: 'success' };
}

// Whether to OFFER "Leave this gym". A sole owner can never leave (the gym
// would be left with nobody able to run it), so the UI shouldn't offer an
// action that can only fail. Everyone else always may. This is presentation
// only - leave_gym enforces the same rule on the server and is the real
// boundary (it also covers a stale screen where another owner has since gone).
export function canLeaveGym(role: string, hasOtherActiveOwner: boolean): boolean {
  return role !== 'owner' || hasOtherActiveOwner;
}

// A team member (any role) leaves a gym on their own. The last owner can't
// leave - the RPC says so.
export async function leaveGym(gymId: number): Promise<StaffActionResult> {
  const { error } = await supabase.rpc('leave_gym', { p_gym_id: gymId });
  return error ? { kind: 'error', message: error.message } : { kind: 'success' };
}

type RawGymHistoryRow = {
  id: number;
  gym_id: number;
  role: string;
  status: MyGymHistoryItem['status'];
  responded_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  gyms: { name: string } | null;
};

// The caller's own non-active rows (readable via the "own record" policy).
export async function fetchMyGymHistory(userId: string): Promise<MyGymHistoryItem[]> {
  const { data, error } = await supabase
    .from('gym_staff')
    .select('id, gym_id, role, status, responded_at, removed_at, removed_by, gyms(name)')
    .eq('user_id', userId)
    .neq('status', 'active')
    .order('id', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as RawGymHistoryRow[]).map((row) => ({
    id: row.id,
    gymId: row.gym_id,
    gymName: row.gyms?.name ?? 'Unknown gym',
    role: row.role,
    status: row.status,
    leftByChoice: row.status === 'removed' && row.removed_by === userId,
    at: row.removed_at ?? row.responded_at,
  }));
}

export type RequestTrainerResult =
  | { kind: 'success' }
  | { kind: 'needs_profile' }
  | { kind: 'cooldown'; message: string; remainingSeconds: number }
  | { kind: 'duplicate'; message: string }
  | { kind: 'error'; message: string };

// The server (gym_staff INSERT policy) is the real gate: trainer role only,
// 18+ only, and a trainer_profiles row must already exist. The profile
// pre-check here is just so that case can route the user to create one
// instead of showing a generic policy error. gym_staff has UNIQUE
// (gym_id, user_id), so a repeat request hits 23505 - look up the existing
// row for a status-appropriate message, same as requestJoinAsMember.
export async function requestJoinAsTrainer(
  gymId: number,
  userId: string
): Promise<RequestTrainerResult> {
  const profile = await fetchTrainerProfile(userId);
  if (!profile) return { kind: 'needs_profile' };

  const insertRequest = () =>
    supabase
      .from('gym_staff')
      .insert({ gym_id: gymId, user_id: userId, role: 'trainer', status: 'pending' });

  const { error } = await insertRequest();
  if (!error) return { kind: 'success' };

  if (error.code !== '23505') {
    if (isPermissionError(error)) return { kind: 'error', message: NOT_ADULT_MESSAGE };
    return { kind: 'error', message: error.message };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('gym_staff')
    .select('id, role, status, removed_by')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { kind: 'duplicate', message: "You've already sent a request to this gym." };
  }

  // Someone who LEFT on their own may come back: the DB lets them clear their
  // own row (removed_by = themselves), and the delete+reinsert below does the
  // rest. Someone an owner/admin removed may not - that was the gym's call.
  const leftByChoice = existing.status === 'removed' && existing.removed_by === userId;

  if (existing.status === 'pending') {
    return { kind: 'duplicate', message: 'Your request to join as a trainer is still pending approval.' };
  }
  if (existing.status === 'active') {
    return {
      kind: 'duplicate',
      message:
        existing.role === 'trainer'
          ? "You're already a trainer at this gym."
          : "You're already part of this gym's team.",
    };
  }
  if (existing.status === 'removed' && !leftByChoice) {
    return {
      kind: 'duplicate',
      message: "You were removed from this gym's team. Contact the gym directly if you'd like to rejoin.",
    };
  }
  if (existing.status === 'suspended') {
    return {
      kind: 'duplicate',
      message: 'Your access to this gym is suspended. Contact the gym directly.',
    };
  }

  // Rejected (or left on your own) - let them try again. Only gym admins can
  // change a row's status, but a user can delete their own such row, so a
  // retry is delete+reinsert. After a rejection the DB enforces a cooldown
  // (the delete policy refuses to remove a rejected row until it has
  // elapsed); the checks here are only to give a clear message. Leaving on
  // your own has no cooldown.
  if (existing.status === 'rejected') {
    const remaining = await fetchCooldownRemainingSeconds(gymId).catch(() => null);
    if (remaining !== null && remaining > 0) return cooldownResult(remaining);
  }

  // RLS doesn't raise on a delete it refuses - it just matches 0 rows - so
  // "nothing deleted" is how a still-cooling-down row shows up here (e.g. the
  // cooldown was still running between the check above and this delete).
  const { data: deleted, error: deleteError } = await supabase
    .from('gym_staff')
    .delete()
    .eq('id', existing.id)
    .select('id');
  if (deleteError) return { kind: 'error', message: deleteError.message };

  if (!deleted || deleted.length === 0) {
    const stillLeft =
      existing.status === 'rejected'
        ? await fetchCooldownRemainingSeconds(gymId).catch(() => null)
        : null;
    if (stillLeft !== null && stillLeft > 0) return cooldownResult(stillLeft);
    return { kind: 'error', message: "We couldn't clear your earlier request. Please try again." };
  }

  const { error: reinsertError } = await insertRequest();
  if (reinsertError) return { kind: 'error', message: reinsertError.message };

  return { kind: 'success' };
}

// Seconds until the caller may re-request this gym, from the server's clock:
// null when they have no rejected request there, 0 once it has elapsed.
export async function fetchCooldownRemainingSeconds(gymId: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('trainer_request_cooldown_remaining', {
    p_gym_id: gymId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}

// Deliberately says "a waiting period" rather than a number of hours - the
// length lives in the DB (trainer_request_cooldown()) so it can change there
// without the app quoting a stale figure.
export function cooldownMessage(remainingSeconds: number): string {
  return `There's a waiting period after a declined request. You can send a new one in ${formatWaitDuration(remainingSeconds)}.`;
}

function cooldownResult(remainingSeconds: number): RequestTrainerResult {
  return { kind: 'cooldown', message: cooldownMessage(remainingSeconds), remainingSeconds };
}

type RawStaffRequestRow = {
  request_id: number;
  requester_id: string;
  requested_role: string;
  requested_at: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  trainer_bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  certification_count: number | null;
};

// SECURITY DEFINER RPC that returns rows only when the caller is an
// owner/admin of the gym - non-admins just get an empty list. It exists
// because a requester's profile row isn't readable through profiles RLS.
export async function fetchGymStaffRequests(gymId: number): Promise<StaffRequest[]> {
  const { data, error } = await supabase.rpc('get_gym_staff_requests', { p_gym_id: gymId });
  if (error) throw error;

  return ((data ?? []) as RawStaffRequestRow[]).map((row) => ({
    requestId: row.request_id,
    requesterId: row.requester_id,
    requestedRole: row.requested_role,
    requestedAt: row.requested_at,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    trainerBio: row.trainer_bio,
    specialties: row.specialties ?? [],
    yearsExperience: row.years_experience,
    certificationCount: row.certification_count ?? 0,
  }));
}

export type RespondToRequestResult = { kind: 'success' } | { kind: 'error'; message: string };

// Approval only flips status (+ the audit columns the RLS policy requires) -
// a DB trigger locks role/user/gym on a pending row, so this can never change
// what was requested.
export async function respondToStaffRequest(
  requestId: number,
  adminUserId: string,
  decision: 'active' | 'rejected'
): Promise<RespondToRequestResult> {
  const { data, error } = await supabase
    .from('gym_staff')
    .update({
      status: decision,
      responded_by: adminUserId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id');

  if (error) return { kind: 'error', message: error.message };
  if (!data || data.length === 0) {
    return { kind: 'error', message: 'This request was already handled or is no longer available.' };
  }
  return { kind: 'success' };
}
