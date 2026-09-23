import { supabase } from './supabase';
import type { LocationOption } from '../types/database';

export async function fetchCountries(): Promise<LocationOption[]> {
  const { data, error } = await supabase
    .from('countries')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchStates(countryId: number): Promise<LocationOption[]> {
  const { data, error } = await supabase
    .from('states')
    .select('id, name')
    .eq('country_id', countryId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchCities(stateId: number): Promise<LocationOption[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, name')
    .eq('state_id', stateId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
