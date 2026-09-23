import * as Location from 'expo-location';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

const GPS_TIMEOUT_MS = 15000;

export type LocationRequestPhase = 'permission' | 'locating';

export type LocationRequestOutcome =
  | { kind: 'granted'; coords: Coordinates }
  | { kind: 'permission-denied' }
  | { kind: 'location-error' };

// Shared by the check-in flow (src/lib/checkin.ts) and the gym-listing map
// picker: request foreground permission, then get a GPS fix with a manual
// timeout since getCurrentPositionAsync has no built-in one in this SDK.
export async function requestCurrentCoordinates(
  onPhaseChange?: (phase: LocationRequestPhase) => void
): Promise<LocationRequestOutcome> {
  onPhaseChange?.('permission');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return { kind: 'permission-denied' };
  }

  onPhaseChange?.('locating');
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), GPS_TIMEOUT_MS);
      }),
    ]);
    return {
      kind: 'granted',
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { kind: 'location-error' };
  }
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function formatDistanceMeters(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}
