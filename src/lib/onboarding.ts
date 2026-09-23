import { supabase } from './supabase';
import type { OnboardingDocumentType, OnboardingRequest } from '../types/database';

export type SubmitGymOnboardingInput = {
  name: string;
  category: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
};

export async function submitGymOnboarding(
  input: SubmitGymOnboardingInput
): Promise<{ gymId: number; requestId: number }> {
  const { data, error } = await supabase.rpc('submit_gym_onboarding', {
    p_name: input.name,
    p_category: input.category,
    p_phone: input.phone,
    p_city: input.city,
    p_state: input.state,
    p_country: input.country,
    p_address_line_1: input.addressLine1,
    p_address_line_2: input.addressLine2,
    p_landmark: input.landmark,
    p_postal_code: input.postalCode,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Gym submission did not return an id.');

  return { gymId: row.gym_id, requestId: row.request_id };
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri.split('?')[0]);
  return match ? match[1] : 'jpg';
}

export async function uploadGymPhoto(gymId: number, localUri: string, index: number): Promise<void> {
  const blob = await uriToBlob(localUri);
  const path = `${gymId}/${Date.now()}-${index}.${extensionFromUri(localUri)}`;

  const { error: uploadError } = await supabase.storage.from('gym-photos').upload(path, blob);
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from('gym-photos').getPublicUrl(path);

  const { error: insertError } = await supabase.from('gym_media').insert({
    gym_id: gymId,
    media_type: 'photo',
    role: 'gallery',
    url: publicUrlData.publicUrl,
    sort_order: index,
  });
  if (insertError) throw insertError;
}

export async function uploadOnboardingDocument(
  userId: string,
  requestId: number,
  documentType: OnboardingDocumentType,
  localUri: string
): Promise<void> {
  const blob = await uriToBlob(localUri);
  const path = `${userId}/${requestId}/${documentType}-${Date.now()}.${extensionFromUri(localUri)}`;

  const { error: uploadError } = await supabase.storage
    .from('gym-onboarding-docs')
    .upload(path, blob);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('gym_onboarding_documents').insert({
    request_id: requestId,
    document_type: documentType,
    file_path: path,
  });
  if (insertError) throw insertError;
}

export async function fetchMyOnboardingRequests(userId: string): Promise<OnboardingRequest[]> {
  const { data, error } = await supabase
    .from('gym_onboarding_requests')
    .select('id, gym_id, submitted_by, admin_status, admin_notes, created_at, gym:gyms(id, name)')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as OnboardingRequest[]) ?? [];
}
