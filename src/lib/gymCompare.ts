import { supabase } from './supabase';
import { fetchAmenities, fetchEquipment } from './gymDetail';
import { fetchDiscoverGyms } from './gyms';
import type { GymPriceTier, GymWithDiscoverData, LocationOption } from '../types/database';

export type GymRatingBreakdown = {
  overall: number | null;
  reviewCount: number;
  equipment: number | null;
  cleanliness: number | null;
  staff: number | null;
  crowd: number | null;
  value: number | null;
};

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null).map(Number);
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// A dedicated aggregation rather than reusing get_location_stats (which only
// covers the overall rating): the per-category breakdown needs the raw
// sub-rating columns, so this fetches them all in one query and averages
// every column (overall + 5 sub-categories) from the same row set, ignoring
// nulls per column since sub-ratings are optional on a review.
export async function fetchGymRatingBreakdown(gymId: number): Promise<GymRatingBreakdown> {
  const { data, error } = await supabase
    .from('gym_reviews')
    .select('rating, equipment_rating, cleanliness_rating, staff_rating, crowd_rating, value_rating')
    .eq('gym_id', gymId)
    .eq('status', 'published');

  if (error) throw error;

  const rows = data ?? [];
  return {
    overall: average(rows.map((row) => (row.rating !== null ? Number(row.rating) : null))),
    reviewCount: rows.length,
    equipment: average(rows.map((row) => (row.equipment_rating !== null ? Number(row.equipment_rating) : null))),
    cleanliness: average(rows.map((row) => (row.cleanliness_rating !== null ? Number(row.cleanliness_rating) : null))),
    staff: average(rows.map((row) => (row.staff_rating !== null ? Number(row.staff_rating) : null))),
    crowd: average(rows.map((row) => (row.crowd_rating !== null ? Number(row.crowd_rating) : null))),
    value: average(rows.map((row) => (row.value_rating !== null ? Number(row.value_rating) : null))),
  };
}

export type GymPriceInfo = {
  priceTier: GymPriceTier | null;
  lowestMonthlyEquivalent: number | null;
};

export async function fetchGymPriceInfo(gymId: number): Promise<GymPriceInfo> {
  const { data, error } = await supabase
    .from('gym_price_tiers')
    .select('price_tier, lowest_monthly_equivalent')
    .eq('gym_id', gymId)
    .maybeSingle();

  if (error) throw error;

  return {
    priceTier: (data?.price_tier as GymPriceTier | null) ?? null,
    lowestMonthlyEquivalent: data?.lowest_monthly_equivalent != null ? Number(data.lowest_monthly_equivalent) : null,
  };
}

export type GymCompareSummary = {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type GymCompareData = {
  summary: GymCompareSummary;
  ratings: GymRatingBreakdown;
  price: GymPriceInfo;
  equipment: LocationOption[];
  amenities: LocationOption[];
};

async function fetchGymCompareSummary(gymId: number): Promise<GymCompareSummary | null> {
  const { data, error } = await supabase
    .from('gyms')
    .select(
      `id, name, category, city, latitude, longitude,
      gym_locations ( is_primary, localities ( city_id, cities ( name ) ) ),
      gym_media ( role, url, sort_order )`
    )
    .eq('id', gymId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Same to-one-embedded-as-array caveat as gyms.ts/gymDetail.ts (no
  // generated Database types to tell supabase-js otherwise).
  const row = data as unknown as {
    id: number;
    name: string;
    category: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    gym_locations: {
      is_primary: boolean;
      localities: { cities: { name: string } | null } | null;
    }[];
    gym_media: { role: string; url: string; sort_order: number }[];
  };

  const primaryLocation = row.gym_locations.find((l) => l.is_primary) ?? row.gym_locations[0];
  const cityName = primaryLocation?.localities?.cities?.name ?? row.city;

  const sortedMedia = [...row.gym_media].sort((a, b) => a.sort_order - b.sort_order);
  const hero = sortedMedia.find((m) => m.role === 'hero');
  const photoUrl = hero?.url ?? sortedMedia[0]?.url ?? null;

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: cityName,
    photoUrl,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function fetchGymCompareData(gymId: number): Promise<GymCompareData | null> {
  const summary = await fetchGymCompareSummary(gymId);
  if (!summary) return null;

  const [ratings, price, equipment, amenities] = await Promise.all([
    fetchGymRatingBreakdown(gymId),
    fetchGymPriceInfo(gymId),
    fetchEquipment(gymId),
    fetchAmenities(gymId),
  ]);

  return { summary, ratings, price, equipment, amenities };
}

// The second-gym picker's default list, before the user searches - reuses
// fetchDiscoverGyms + a client-side city-name filter, same pattern Discover
// itself already uses to scope "gyms in my city" (there's no dedicated
// server-side "gyms in city X" query in this app yet).
export async function fetchGymsInSameCity(
  cityName: string | null,
  excludeGymId: number
): Promise<GymWithDiscoverData[]> {
  const gyms = await fetchDiscoverGyms();
  return gyms.filter((gym) => gym.id !== excludeGymId && cityName !== null && gym.city === cityName);
}
