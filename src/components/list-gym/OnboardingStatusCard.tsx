import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { OnboardingAdminStatus, OnboardingRequest } from '../../types/database';

const STATUS_COPY: Record<OnboardingAdminStatus, { label: string; color: string }> = {
  pending_review: { label: 'Pending review', color: '#facc15' },
  verified: { label: 'Verified', color: colors.emeraldLight },
  rejected: { label: 'Rejected', color: '#f87171' },
};

export function OnboardingStatusCard({ request }: { request: OnboardingRequest }) {
  const status = STATUS_COPY[request.admin_status];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.gymName}>{request.gym.name}</Text>
        <View style={[styles.badge, { backgroundColor: status.color }]}>
          <Text style={styles.badgeText}>{status.label}</Text>
        </View>
      </View>

      {request.admin_status === 'pending_review' ? (
        <Text style={styles.note}>
          Our team is reviewing your submission and will reach out to verify your details.
        </Text>
      ) : null}
      {request.admin_status === 'rejected' && request.admin_notes ? (
        <Text style={styles.note}>{request.admin_notes}</Text>
      ) : null}
      {request.admin_status === 'verified' ? (
        <Text style={styles.note}>Your gym is verified and live on GymTrust.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gymName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#020617',
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
