import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { deleteGymPricingPlan, saveGymPricingPlan } from '../../lib/gymPricing';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { GymPlanType, GymPricingPlan } from '../../types/database';

const PLAN_TYPES: { value: GymPlanType; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'annual', label: 'Annual' },
];

export function ManagePricingModal({
  visible,
  gymId,
  plans,
  onClose,
  onSaved,
}: {
  visible: boolean;
  gymId: number;
  plans: GymPricingPlan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [inputs, setInputs] = useState<Record<GymPlanType, string>>({
    monthly: '',
    quarterly: '',
    half_yearly: '',
    annual: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const next: Record<GymPlanType, string> = {
      monthly: '',
      quarterly: '',
      half_yearly: '',
      annual: '',
    };
    for (const plan of plans) {
      next[plan.planType] = String(plan.price);
    }
    setInputs(next);
    setErrorMessage(null);
  }, [visible, plans]);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      for (const { value: planType } of PLAN_TYPES) {
        const raw = inputs[planType].trim();
        const existing = plans.find((plan) => plan.planType === planType) ?? null;

        if (!raw) {
          // Cleared: remove the plan if one existed, otherwise nothing to do.
          if (existing) await deleteGymPricingPlan(existing.id);
          continue;
        }

        const price = Number(raw);
        if (!Number.isFinite(price) || price < 0) {
          setErrorMessage(`Enter a valid price for the ${planType.replace('_', '-')} plan.`);
          setIsSaving(false);
          return;
        }

        // Skip a no-op write when nothing changed.
        if (existing && existing.price === price) continue;

        const result = await saveGymPricingPlan(gymId, planType, price);
        if (result.kind === 'error') {
          setErrorMessage(result.message);
          setIsSaving(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save pricing.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Manage Pricing</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.hint}>
              Leave a field blank to not offer that plan. Prices are monthly membership fees in
              rupees, per billing period.
            </Text>

            {PLAN_TYPES.map((option) => (
              <View key={option.value} style={styles.field}>
                <Text style={styles.label}>{option.label}</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.input}
                    value={inputs[option.value]}
                    onChangeText={(text) =>
                      setInputs((prev) => ({ ...prev, [option.value]: text.replace(/[^0-9.]/g, '') }))
                    }
                    placeholder="Not offered"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ))}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 17,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.danger,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
