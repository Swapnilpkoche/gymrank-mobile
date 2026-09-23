import * as SecureStore from 'expo-secure-store';

// expo-secure-store is backed by Keychain (iOS) / Keystore (Android) -
// unlike AsyncStorage/expo-sqlite's localStorage, it's the appropriate
// place for a plaintext password, since it's encrypted at rest by the OS.
const STORAGE_KEY = 'gymrank_remembered_credentials';

export type RememberedCredentials = {
  email: string;
  password: string;
};

export async function saveRememberedCredentials(credentials: RememberedCredentials): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(credentials));
}

export async function loadRememberedCredentials(): Promise<RememberedCredentials | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as RememberedCredentials;
  } catch {
    return null;
  }
}

export async function clearRememberedCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
