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
  View,
} from 'react-native';

import {
  approveMemberRequest,
  isoToLocalDate,
  localDateToIso,
  PLAN_OPTIONS,
  previewMemberTerm,
  renewMember,
} from '../../lib/memberships';
import { formatShortDate } from '../../lib/time';
import { colors } from '../../theme/colors';
import type { GymPlanType, GymPricingPlan, TermPreview } from '../../types/database';
import { StartDatePicker } from './StartDatePicker';

export type TermSheetTarget = {
  // approve = a pending join request (plan + start date required)
  // renew   = an existing member with a plan
  // set_plan = a legacy member with no plan yet (same call as renew)
  mode: 'approve' | 'renew' | 'set_plan';
  memberId: number;
  memberName: string;
  currentPlan: GymPlanType | null;
};

function shiftIso(iso: string, days: number): string {
  const date = isoToLocalDate(iso);
  date.setDate(date.getDate() + days);
  return localDateToIso(date);
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

const TITLES: Record<TermSheetTarget['mode'], string> = {
  approve: 'Approve & set plan',
  renew: 'Renew membership',
  set_plan: 'Set plan',
};

const CONFIRM_LABELS: Record<TermSheetTarget['mode'], string> = {
  approve: 'Approve member',
  renew: 'Confirm renewal',
  set_plan: 'Save plan',
};

export function MembershipTermSheet({
  visible,
  target,
  prices,
  onClose,
  onDone,
}: {
  visible: boolean;
  target: TermSheetTarget | null;
  // Listed prices, shown for reference only - GymTrust records the term, it
  // doesn't charge anything.
  prices: GymPricingPlan[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [plan, setPlan] = useState<GymPlanType>('monthly');
  // Only meaningful when approving; null = "today", chosen by the server.
  const [startDateIso, setStartDateIso] = useState<string | null>(null);
  const [preview, setPreview] = useState<TermPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !target) return;
    setPlan(target.currentPlan ?? 'monthly');
    setStartDateIso(null);
    setPreview(null);
    setErrorMessage(null);
  }, [visible, target]);

  // The dates shown are always the server's: today, the start (which for a
  // renewal is the day after the current term ends), and the last day of the
  // new term. The app does no date arithmetic of its own.
  useEffect(() => {
    if (!visible || !target) return;

    let cancelled = false;
    setIsPreviewing(true);
    previewMemberTerm(
      plan,
      target.mode === 'approve' ? startDateIso : null,
      target.mode === 'approve' ? null : target.memberId
    )
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setErrorMessage(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setErrorMessage(err instanceof Error ? err.message : 'Could not load dates.');
      })
      .finally(() => {
        if (!cancelled) setIsPreviewing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, target, plan, startDateIso]);

  async function handleConfirm() {
    if (!target) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result =
        target.mode === 'approve'
          ? await approveMemberRequest(target.memberId, plan, startDateIso)
          : await renewMember(target.memberId, plan, null);

      if (result.kind === 'success') {
        onDone();
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!target) return null;

  const startsAfterToday = preview !== null && preview.startDate > preview.today;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{TITLES[target.mode]}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.memberName}>{target.memberName}</Text>
            <Text style={styles.hint}>
              GymTrust doesn&apos;t take payments. Record this only after {target.memberName} has paid
              at the gym.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Plan</Text>
              <View style={styles.planList}>
                {PLAN_OPTIONS.map((option) => {
                  const selected = option.value === plan;
                  const listed = prices.find((p) => p.planType === option.value);
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.planRow, selected && styles.planRowSelected]}
                      onPress={() => setPlan(option.value)}
                      disabled={isSaving}
                    >
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={18}
                        color={selected ? colors.emerald : colors.textMuted}
                      />
                      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.planPrice}>
                        {listed ? formatPrice(listed.price) : 'Price not listed'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.subHint}>Listed prices are for reference only.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Start date</Text>
              {target.mode === 'approve' ? (
                preview ? (
                  <StartDatePicker
                    valueIso={startDateIso ?? preview.startDate}
                    minIso={shiftIso(preview.today, -366)}
                    maxIso={shiftIso(preview.today, 366)}
                    onChange={setStartDateIso}
                    disabled={isSaving}
                  />
                ) : (
                  <ActivityIndicator color={colors.emerald} size="small" />
                )
              ) : preview ? (
                <View style={styles.staticDate}>
                  <Text style={styles.staticDateText}>{formatShortDate(preview.startDate)}</Text>
                  <Text style={styles.subHint}>
                    {startsAfterToday
                      ? 'The day after the current term ends - an early renewal loses no days.'
                      : 'Today - the previous term has already ended.'}
                  </Text>
                </View>
              ) : (
                <ActivityIndicator color={colors.emerald} size="small" />
              )}
            </View>

            {preview ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>New term</Text>
                <Text style={styles.summaryValue}>
                  {formatShortDate(preview.startDate)} → {formatShortDate(preview.endDate)}
                </Text>
                <Text style={styles.subHint}>The last day of the term is included.</Text>
                {isPreviewing ? <ActivityIndicator color={colors.emerald} size="small" /> : null}
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Feather name="alert-triangle" size={14} color="#f87171" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={onClose} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, (isSaving || !preview) && styles.primaryButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSaving || !preview}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{CONFIRM_LABELS[target.mode]}</Text>
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
    backgroundColor: '#000000b3',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    gap: 16,
    paddingBottom: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  subHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  planList: {
    gap: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planRowSelected: {
    borderColor: colors.emerald,
    backgroundColor: '#052e1f',
  },
  planLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  planLabelSelected: {
    color: colors.emeraldLight,
  },
  planPrice: {
    color: colors.textMuted,
    fontSize: 12,
  },
  staticDate: {
    gap: 4,
  },
  staticDateText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryBox: {
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.emeraldLight,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8717126',
    borderWidth: 1,
    borderColor: '#f8717166',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#f87171',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1.4,
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
