import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { endsLabel, isCurrentMemberState, planLabel } from '../../lib/memberships';
import { colors, fontSize, radius, spacing } from '../../theme';
import type { MyMembership } from '../../types/database';

// A member's own view of their membership (plan + end date are private to them
// and the gym's owners/admins). An expired member sees that it ended and where
// to renew - instead of member features. Renewal happens AT THE GYM: the owner
// records it after payment, GymTrust takes no payment.
export function MyMembershipCard({ membership }: { membership: MyMembership }) {
  const isExpired = membership.state === 'expired';
  if (!isCurrentMemberState(membership.state) && !isExpired) return null;

  const isExpiringSoon = membership.state === 'expiring_soon';
  const noPlan = membership.state === 'no_plan';

  const tone = isExpired ? styles.cardBad : isExpiringSoon ? styles.cardWarn : styles.cardOk;
  const iconName = isExpired ? 'alert-circle' : isExpiringSoon ? 'clock' : 'check-circle';
  const iconColor = isExpired ? colors.danger : isExpiringSoon ? colors.warning : colors.emeraldLight;

  return (
    <View style={[styles.card, tone]}>
      <Feather name={iconName} size={20} color={iconColor} />
      <View style={styles.body}>
        {isExpired ? (
          <>
            <Text style={styles.title}>Membership ended - renew at the gym</Text>
            <Text style={styles.detail}>
              {planLabel(membership.planType)} · {endsLabel(membership.endDate, membership.daysLeft)}
            </Text>
            <Text style={styles.subDetail}>
              Once the gym records your renewal, your member access comes back.
            </Text>
          </>
        ) : noPlan ? (
          <>
            <Text style={styles.title}>You&apos;re a member</Text>
            <Text style={styles.detail}>No plan set</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Your membership</Text>
            <Text style={styles.detail}>
              {planLabel(membership.planType)} · {endsLabel(membership.endDate, membership.daysLeft)}
            </Text>
            {isExpiringSoon ? (
              <Text style={styles.subDetail}>Renew at the gym to keep your member access.</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardOk: {
    backgroundColor: colors.emeraldTint,
    borderColor: colors.emerald,
  },
  cardWarn: {
    backgroundColor: colors.warningTint,
    borderColor: colors.warningBorder,
  },
  cardBad: {
    backgroundColor: '#f8717114',
    borderColor: colors.dangerBorder,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  detail: {
    color: colors.textPrimary,
    fontSize: fontSize.base,
  },
  subDetail: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 17,
  },
});
