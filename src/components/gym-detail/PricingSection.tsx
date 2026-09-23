import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { GymPlanType, GymPricingPlan } from '../../types/database';

const PLAN_LABELS: Record<GymPlanType, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  annual: 'Annual',
};

function formatRupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// Shows the gym's REAL plan options and prices (e.g. "Monthly ₹1,500 ·
// Annual ₹12,000") - not the normalized monthly_equivalent figure used
// internally for tiering, since that's not what a member is actually
// choosing between.
export function PricingSection({
  plans,
  isGymAdmin,
  onEditPress,
}: {
  plans: GymPricingPlan[];
  isGymAdmin: boolean;
  onEditPress: () => void;
}) {
  if (plans.length === 0 && !isGymAdmin) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Pricing</Text>
        {isGymAdmin ? (
          <Pressable style={styles.editButton} onPress={onEditPress} hitSlop={8}>
            <Feather name="edit-2" size={13} color={colors.emerald} />
            <Text style={styles.editButtonText}>{plans.length === 0 ? 'Add' : 'Edit'}</Text>
          </Pressable>
        ) : null}
      </View>

      {plans.length === 0 ? (
        <Text style={styles.empty}>No pricing added yet.</Text>
      ) : (
        <Text style={styles.plansText}>
          {plans.map((plan) => `${PLAN_LABELS[plan.planType]} ${formatRupees(plan.price)}`).join(' · ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    color: colors.emerald,
    fontWeight: '700',
    fontSize: 13,
  },
  plansText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
