import { supabase } from './supabase';
import type { Gym, GymPriceTier, GymWithDiscoverData } from '../types/database';

type RawGymRow = Omit<Gym, 'city' | 'state' | 'country'> & {
  city: string | null;
  state: string | null;
  country: string | null;
  gym_locations: {
    is_primary: boolean;
    localities: {
      name: string;
      cities: {
        name: string;
        states: {
          name: string;
          countries: { name: string } | null;
        } | null;
      } | null;
    } | null;
  }[];
};

// The flat gyms.city/state/country columns are legacy and often unpopulated
// (e.g. country is set but city/state are null on real rows). The actual
// location hierarchy lives in gym_locations -> localities -> cities ->
// states -> countries, so resolve from there first and only fall back to
// the flat columns if a gym has no primary location on file.
function resolveLocationNames(row: RawGymRow) {
  const primaryLocation = row.gym_locations.find((l) => l.is_primary) ?? row.gym_locations[0];
  const city = primaryLocation?.localities?.cities;
  const state = city?.states;
  const country = state?.countries;

  return {
    city: city?.name ?? row.city,
    state: state?.name ?? row.state,
    country: country?.name ?? row.country,
  };
}

async function fetchGyms(): Promise<Gym[]> {
  const { data, error } = await supabase
    .from('gyms')
    .select(
      `id, name, slug, description, status, verification_status, location, city, state, country, category, latitude, longitude,
      gym_locations ( is_primary, localities ( name, cities ( name, states ( name, countries ( name ) ) ) ) )`
    )
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) throw error;

  // supabase-js can't infer to-one vs to-many embeds without generated
  // Database types, so it types every nested relation as an array; the
  // actual runtime shape here is nested single objects (or null).
  const rows = (data ?? []) as unknown as RawGymRow[];

  return rows.map((row) => {
    const { city, state, country } = resolveLocationNames(row);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      verification_status: row.verification_status,
      location: row.location,
      category: row.category,
      latitude: row.latitude,
      longitude: row.longitude,
      city,
      state,
      country,
    };
  });
}

async function fetchRatings(gymIds: number[]): Promise<Map<number, { rating: number; reviewCount: number }>> {
  const ratings = new Map<number, { rating: number; reviewCount: number }>();
  if (gymIds.length === 0) return ratings;

  const { data, error } = await supabase
    .from('gym_reviews')
    .select('gym_id, rating')
    .eq('status', 'published')
    .in('gym_id', gymIds);

  if (error) throw error;

  const totals = new Map<number, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const existing = totals.get(row.gym_id) ?? { sum: 0, count: 0 };
    existing.sum += Number(row.rating);
    existing.count += 1;
    totals.set(row.gym_id, existing);
  }

  for (const [gymId, { sum, count }] of totals) {
    ratings.set(gymId, { rating: sum / count, reviewCount: count });
  }

  return ratings;
}

async function fetchHeroPhotos(gymIds: number[]): Promise<Map<number, string>> {
  const heroPhotos = new Map<number, string>();
  const firstGalleryPhotos = new Map<number, string>();
  if (gymIds.length === 0) return heroPhotos;

  const { data, error } = await supabase
    .from('gym_media')
    .select('gym_id, role, url, sort_order')
    .in('gym_id', gymIds)
    .in('role', ['hero', 'gallery'])
    .order('sort_order', { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    if (row.role === 'hero') {
      heroPhotos.set(row.gym_id, row.url);
    } else if (!firstGalleryPhotos.has(row.gym_id)) {
      firstGalleryPhotos.set(row.gym_id, row.url);
    }
  }

  for (const [gymId, url] of firstGalleryPhotos) {
    if (!heroPhotos.has(gymId)) {
      heroPhotos.set(gymId, url);
    }
  }

  return heroPhotos;
}

// gym_price_tiers is driven by each gym's LOWEST monthly_equivalent across
// its gym_pricing_plans rows (see the view) - the client never needs the
// raw plan data here, just the resulting tier.
async function fetchPriceTiers(gymIds: number[]): Promise<Map<number, GymPriceTier | null>> {
  const tiers = new Map<number, GymPriceTier | null>();
  if (gymIds.length === 0) return tiers;

  const { data, error } = await supabase
    .from('gym_price_tiers')
    .select('gym_id, price_tier')
    .in('gym_id', gymIds);

  if (error) throw error;

  for (const row of data ?? []) {
    tiers.set(row.gym_id, row.price_tier as GymPriceTier | null);
  }

  return tiers;
}

async function fetchMemberCounts(gymIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (gymIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('gym_member_counts')
    .select('gym_id, active_member_count')
    .in('gym_id', gymIds);

  if (error) throw error;

  for (const row of data ?? []) {
    counts.set(row.gym_id, Number(row.active_member_count));
  }

  return counts;
}

// Shared by fetchDiscoverGyms and searchGyms - both end up with a flat list
// of gym rows that just need the same rating/photo/member-count/price-tier
// enrichment joined on afterward. This is also why search_gyms's own SQL
// doesn't need to return price fields itself - every gym row converges
// through here regardless of which path produced it.
async function enrichGyms(gyms: Gym[]): Promise<GymWithDiscoverData[]> {
  const gymIds = gyms.map((gym) => gym.id);

  const [ratings, photos, memberCounts, priceTiers] = await Promise.all([
    fetchRatings(gymIds),
    fetchHeroPhotos(gymIds),
    fetchMemberCounts(gymIds),
    fetchPriceTiers(gymIds),
  ]);

  return gyms.map((gym) => ({
    ...gym,
    rating: ratings.get(gym.id)?.rating ?? null,
    reviewCount: ratings.get(gym.id)?.reviewCount ?? 0,
    photoUrl: photos.get(gym.id) ?? null,
    memberCount: memberCounts.get(gym.id) ?? null,
    distanceKm: null,
    priceTier: priceTiers.get(gym.id) ?? null,
  }));
}

export async function fetchDiscoverGyms(): Promise<GymWithDiscoverData[]> {
  const gyms = await fetchGyms();
  return enrichGyms(gyms);
}

// search_gyms already resolves city/state/country from the locality
// hierarchy server-side (same fallback-to-flat-columns logic as
// resolveLocationNames above), so its row shape lines up with Gym directly -
// no separate mapping step needed before enrichment.
export async function searchGyms(searchTerm: string): Promise<GymWithDiscoverData[]> {
  const { data, error } = await supabase.rpc('search_gyms', { search_term: searchTerm });
  if (error) throw error;

  const gyms = (data ?? []) as Gym[];
  return enrichGyms(gyms);
}
