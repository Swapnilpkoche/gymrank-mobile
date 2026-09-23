import { supabase } from './supabase';
import type { GymPlanType, GymPricingPlan } from '../types/database';

type RawGymPricingPlanRow = {
  id: number;
  gym_id: number;
  plan_type: GymPlanType;
  price: number;
  monthly_equivalent: number;
};

function toGymPricingPlan(row: RawGymPricingPlanRow): GymPricingPlan {
  return {
    id: row.id,
    gymId: row.gym_id,
    planType: row.plan_type,
    price: Number(row.price),
    monthlyEquivalent: Number(row.monthly_equivalent),
  };
}

export async function fetchGymPricingPlans(gymId: number): Promise<GymPricingPlan[]> {
  const { data, error } = await supabase
    .from('gym_pricing_plans')
    .select('id, gym_id, plan_type, price, monthly_equivalent')
    .eq('gym_id', gymId);

  if (error) throw error;

  const rows = (data ?? []) as RawGymPricingPlanRow[];
  const order: GymPlanType[] = ['monthly', 'quarterly', 'half_yearly', 'annual'];
  return rows
    .map(toGymPricingPlan)
    .sort((a, b) => order.indexOf(a.planType) - order.indexOf(b.planType));
}

export type SaveGymPricingPlanResult = { kind: 'success' } | { kind: 'error'; message: string };

// gym_pricing_plans has a UNIQUE(gym_id, plan_type) constraint, so an
// upsert on that pair naturally covers "add" and "edit" with one call - the
// owner never needs to know which case they're in.
export async function saveGymPricingPlan(
  gymId: number,
  planType: GymPlanType,
  price: number
): Promise<SaveGymPricingPlanResult> {
  const { error } = await supabase
    .from('gym_pricing_plans')
    .upsert({ gym_id: gymId, plan_type: planType, price }, { onConflict: 'gym_id,plan_type' });

  if (error) return { kind: 'error', message: error.message };
  return { kind: 'success' };
}

export async function deleteGymPricingPlan(planId: number): Promise<void> {
  const { error } = await supabase.from('gym_pricing_plans').delete().eq('id', planId);
  if (error) throw error;
}
