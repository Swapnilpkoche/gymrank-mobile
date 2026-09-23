import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { Coordinates } from '../lib/location';

type DeviceLocationState = {
  status: 'loading' | 'granted' | 'denied';
  coords: Coordinates | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export function useDeviceLocation(): DeviceLocationState {
  const [state, setState] = useState<DeviceLocationState>({
    status: 'loading',
    coords: null,
    city: null,
    state: null,
    country: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function resolveLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted) {
          setState({ status: 'denied', coords: null, city: null, state: null, country: null });
        }
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const [address] = await Location.reverseGeocodeAsync(coords);

      if (isMounted) {
        setState({
          status: 'granted',
          coords,
          city: address?.city ?? null,
          state: address?.region ?? null,
          country: address?.country ?? null,
        });
      }
    }

    resolveLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
