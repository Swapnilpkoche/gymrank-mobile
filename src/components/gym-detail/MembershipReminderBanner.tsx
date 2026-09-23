import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { planLabel } from '../../lib/memberships';
import { formatDayMonth } from '../../lib/time';
import { colors } from '../../theme/colors';
import type { MyMembership } from '../../types/database';

// Dismissal is a per-viewer convenience, so it lives in local storage (never
// required to work - every access is guarded). It's keyed by gym AND end date:
// once the gym records a renewal the end date changes, so the banner comes back
// the next time that new term enters its reminder window.
function dismissKey(membership: MyMembership): string {
  return `membership-reminder-dismissed:${membership.gymId}:${membership.endDate}`;
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

// Shown on the member's own gym page while their membership is inside its
// plan's reminder window (the server decides that - state === 'expiring_soon').
// Says "renew at the gym": GymTrust takes no payment.
export function MembershipReminderBanner({ membership }: { membership: MyMembership }) {
  const key = dismissKey(membership);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));

  useEffect(() => {
    setDismissed(readDismissed(key));
  }, [key]);

  if (membership.state !== 'expiring_soon' || !membership.endDate || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Best-effort: worst case it reappears next visit.
    }
  }

  return (
    <View style={styles.banner}>
      <Feather name="clock" size={18} color="#fbbf24" />
      <Text style={styles.text}>
        Your {planLabel(membership.planType).toLowerCase()} membership at {membership.gymName} ends
        on {formatDayMonth(membership.endDate)}. Renew at the gym to keep your member access.
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={10} accessibilityLabel="Dismiss reminder">
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fbbf2414',
    borderWidth: 1,
    borderColor: '#fbbf2466',
    borderRadius: 12,
    padding: 12,
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
});
