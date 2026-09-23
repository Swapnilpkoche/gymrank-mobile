import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { requestCurrentCoordinates, type Coordinates } from '../../lib/location';
import { colors, fontSize, radius, spacing } from '../../theme';

const DEFAULT_DELTA = 0.01;
const PIN_SIZE = 34;

// Roughly central India, used only if we can't get the device's GPS fix -
// the owner is still expected to drag the map to the real spot in that case.
const FALLBACK_CENTER: Coordinates = { latitude: 21.1458, longitude: 79.0882 };

export function LocationMapPicker({ onChange }: { onChange: (coords: Coordinates) => void }) {
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    requestCurrentCoordinates().then((result) => {
      if (!isMounted) return;

      const coords = result.kind === 'granted' ? result.coords : FALLBACK_CENTER;
      if (result.kind === 'permission-denied') {
        setWarning("Location access is off, so we've centered the map on a default spot — drag it to find your gym.");
      } else if (result.kind === 'location-error') {
        setWarning("Couldn't get your current location — drag the map to find your gym.");
      }

      setInitialRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      });
      setSelected(coords);
      onChange(coords);
    });

    return () => {
      isMounted = false;
    };
    // Only resolve the device's location once, when the picker first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRegionChangeComplete(region: Region) {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setSelected(coords);
    onChange(coords);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Pin your gym on the map</Text>
      <Text style={styles.hint}>
        Drag the map so the pin sits exactly on your gym&apos;s entrance. This point is what
        members&apos; GPS check-ins are measured against, so accuracy here matters.
      </Text>

      {warning ? <Text style={styles.warning}>{warning}</Text> : null}

      <View style={styles.mapWrapper}>
        {initialRegion ? (
          <>
            <MapView
              style={styles.map}
              initialRegion={initialRegion}
              onRegionChangeComplete={handleRegionChangeComplete}
            />
            <View style={styles.pinWrapper} pointerEvents="none">
              <Feather name="map-pin" size={PIN_SIZE} color={colors.emerald} style={styles.pinIcon} />
            </View>
          </>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.emerald} />
          </View>
        )}
      </View>

      <Text style={styles.coords}>
        {selected ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : 'Locating…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 17,
  },
  warning: {
    fontSize: fontSize.sm,
    color: '#f59e0b',
  },
  mapWrapper: {
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  pinWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    marginBottom: PIN_SIZE,
  },
  coords: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
