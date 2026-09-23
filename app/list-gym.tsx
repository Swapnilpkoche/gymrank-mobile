import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CategoryPicker } from '../src/components/list-gym/CategoryPicker';
import { DocumentPicker, type PickedDocument } from '../src/components/list-gym/DocumentPicker';
import { LocationMapPicker } from '../src/components/list-gym/LocationMapPicker';
import { PhotoPicker } from '../src/components/list-gym/PhotoPicker';
import { SelectField } from '../src/components/list-gym/SelectField';
import { useAuth } from '../src/context/auth-context';
import type { Coordinates } from '../src/lib/location';
import { fetchCities, fetchCountries, fetchStates } from '../src/lib/locations';
import {
  submitGymOnboarding,
  uploadGymPhoto,
  uploadOnboardingDocument,
} from '../src/lib/onboarding';
import { colors } from '../src/theme/colors';
import type { LocationOption, OnboardingDocumentType } from '../src/types/database';

export default function ListGymScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [documents, setDocuments] = useState<Partial<Record<OnboardingDocumentType, PickedDocument>>>(
    {}
  );

  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [country, setCountry] = useState<LocationOption | null>(null);
  const [state, setState] = useState<LocationOption | null>(null);
  const [city, setCity] = useState<LocationOption | null>(null);
  const [mapCoords, setMapCoords] = useState<Coordinates | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchCountries().then(setCountries).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setState(null);
    setCity(null);
    setStates([]);
    setCities([]);
    if (country) {
      fetchStates(country.id).then(setStates).catch((err) => setError(err.message));
    }
  }, [country]);

  useEffect(() => {
    setCity(null);
    setCities([]);
    if (state) {
      fetchCities(state.id).then(setCities).catch((err) => setError(err.message));
    }
  }, [state]);

  const isFormValid = useMemo(
    () =>
      name.trim().length > 0 &&
      category !== null &&
      country !== null &&
      state !== null &&
      city !== null &&
      addressLine1.trim().length > 0 &&
      phone.trim().length > 0 &&
      mapCoords !== null,
    [name, category, country, state, city, addressLine1, phone, mapCoords]
  );

  async function handleSubmit() {
    if (!session || !isFormValid || !country || !state || !city || !category || !mapCoords) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const { gymId, requestId } = await submitGymOnboarding({
        name: name.trim(),
        category,
        phone: phone.trim(),
        city: city.name,
        state: state.name,
        country: country.name,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || null,
        landmark: landmark.trim() || null,
        postalCode: postalCode.trim() || null,
        latitude: mapCoords.latitude,
        longitude: mapCoords.longitude,
      });

      await Promise.all(photoUris.map((uri, index) => uploadGymPhoto(gymId, uri, index)));

      await Promise.all(
        Object.entries(documents).map(([documentType, doc]) =>
          doc
            ? uploadOnboardingDocument(
                session.user.id,
                requestId,
                documentType as OnboardingDocumentType,
                doc.uri
              )
            : Promise.resolve()
        )
      );

      setSubmittedPhone(phone.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your gym. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedPhone) {
    return (
      <View style={styles.confirmationContainer}>
        <Feather name="check-circle" size={48} color={colors.emerald} />
        <Text style={styles.confirmationTitle}>Submitted for review</Text>
        <Text style={styles.confirmationText}>
          Your gym has been submitted for review. Our team will contact you at {submittedPhone} to
          verify your details before your gym goes live.
        </Text>
        <Pressable style={styles.confirmationButton} onPress={() => router.back()}>
          <Text style={styles.confirmationButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>List your gym</Text>
      <Text style={styles.subtitle}>
        Tell us about your gym. Our team will reach out to verify your details before it goes live.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Gym name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. PowerHouse Fitness"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <CategoryPicker value={category} onChange={setCategory} />
      </View>

      <SelectField
        label="Country"
        placeholder="Select country"
        value={country}
        options={countries}
        onSelect={setCountry}
      />
      <SelectField
        label="State"
        placeholder="Select state"
        value={state}
        options={states}
        disabled={!country}
        onSelect={setState}
      />
      <SelectField
        label="City"
        placeholder="Select city"
        value={city}
        options={cities}
        disabled={!state}
        onSelect={setCity}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Address line 1</Text>
        <TextInput
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="Street address"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Address line 2 (optional)</Text>
        <TextInput
          style={styles.input}
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Apartment, floor, etc."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Landmark (optional)</Text>
        <TextInput
          style={styles.input}
          value={landmark}
          onChangeText={setLandmark}
          placeholder="Nearby landmark"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Postal code (optional)</Text>
        <TextInput
          style={styles.input}
          value={postalCode}
          onChangeText={setPostalCode}
          placeholder="Postal code"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
        />
      </View>

      <LocationMapPicker onChange={setMapCoords} />

      <View style={styles.field}>
        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Contact phone number"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />
      </View>

      <PhotoPicker uris={photoUris} onChange={setPhotoUris} />

      <DocumentPicker documents={documents} onChange={setDocuments} />

      <Pressable
        style={[styles.submitButton, (!isFormValid || isSubmitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit for review</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -8,
  },
  error: {
    color: '#f87171',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmationContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmationText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmationButton: {
    backgroundColor: colors.emerald,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  confirmationButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
