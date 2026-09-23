import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../context/auth-context';
import type { TodayCheckInState } from '../../hooks/useTodayCheckInState';
import type { MyStaffStatus } from '../../lib/trainer';
import type { MembershipState } from '../../types/database';
import { formatShortDate, formatWaitShort } from '../../lib/time';
import { colors } from '../../theme/colors';

type TrainerButton = {
  label: string;
  icon: 'award' | 'clock' | 'check-circle' | 'users' | 'refresh-cw' | 'slash';
  disabled: boolean;
  active: boolean;
  // Looks unavailable but stays tappable (see the rejected case below).
  muted?: boolean;
};

// The trainer button reflects the caller's own staff row for this gym, so it
// never offers "Join" when a request is already on file. Rejected is the one
// state that can become actionable: the server lets a user clear their own
// rejected row and re-request - but only after a cooldown. During it the
// button shows the countdown and is muted yet still tappable, so trying early
// explains exactly how long is left rather than silently doing nothing.
// Removed/suspended can't be cleared by the user, so they show as blocked.
function trainerButtonFor(status: MyStaffStatus | null): TrainerButton {
  if (!status) return { label: 'Join as Trainer', icon: 'award', disabled: false, active: false };

  switch (status.status) {
    case 'pending':
      return { label: 'Request pending', icon: 'clock', disabled: true, active: false };
    case 'active':
      return status.role === 'trainer'
        ? { label: "You're a Trainer", icon: 'check-circle', disabled: true, active: true }
        : { label: 'On the Team', icon: 'users', disabled: true, active: true };
    case 'rejected': {
      const waitSeconds = status.retryAt !== null ? Math.ceil((status.retryAt - Date.now()) / 1000) : 0;
      return waitSeconds > 0
        ? {
            label: `Retry in ${formatWaitShort(waitSeconds)}`,
            icon: 'clock',
            disabled: false,
            active: false,
            muted: true,
          }
        : { label: 'Request again', icon: 'refresh-cw', disabled: false, active: false };
    }
    case 'suspended':
      return { label: 'Suspended', icon: 'slash', disabled: true, active: false };
    default:
      // 'removed'. Left on your own -> you may come back (the DB lets you clear
      // your own row); removed by an owner/admin -> that was the gym's call.
      return status.removedBySelf
        ? { label: 'Rejoin as Trainer', icon: 'refresh-cw', disabled: false, active: false }
        : { label: 'Removed from team', icon: 'slash', disabled: true, active: false };
  }
}

type CheckInButton = {
  label: string;
  icon: 'map-pin' | 'check-circle' | 'info';
  disabled: boolean;
  active: boolean;
};

// checkin_to_gym enforces once-per-day GLOBALLY (any valid check-in today, at
// any gym, blocks a new one) - 'elsewhere' must read as merely unavailable
// (muted, like "Request pending"), NOT as a positive "you did this here"
// state, since no check-in happened at THIS gym.
function checkInButtonFor(state: TodayCheckInState): CheckInButton {
  switch (state) {
    case 'here':
      return { label: 'Checked in today', icon: 'check-circle', disabled: true, active: true };
    case 'elsewhere':
      return { label: 'Checked in elsewhere today', icon: 'info', disabled: true, active: false };
    default:
      return { label: 'Check In', icon: 'map-pin', disabled: false, active: false };
  }
}

type MemberButton = {
  label: string;
  icon: 'users' | 'clock' | 'slash';
  disabled: boolean;
  // Current and expired members don't get a join button at all: the membership
  // card on the page already says where they stand.
  hidden: boolean;
};

// The join button follows the caller's own membership state, so it never
// offers "Join" to someone who is already a member, has a request pending, or
// whose membership merely expired (they renew at the gym, not by re-joining).
function memberButtonFor(state: MembershipState | null): MemberButton {
  switch (state) {
    case 'pending':
      return { label: 'Request pending', icon: 'clock', disabled: true, hidden: false };
    case 'removed':
      return { label: 'Membership removed', icon: 'slash', disabled: true, hidden: false };
    case 'active':
    case 'expiring_soon':
    case 'no_plan':
    case 'expired':
      return { label: 'Join as Member', icon: 'users', disabled: true, hidden: true };
    default:
      // none, or a previously declined request (which may be re-sent)
      return { label: 'Join as Member', icon: 'users', disabled: false, hidden: false };
  }
}

// There are no push notifications, so someone who left or was removed is told
// here, on the gym's own page, with the date - not left looking at a stale UI.
function endedNoteFor(status: MyStaffStatus | null): string | null {
  if (!status || status.status !== 'removed') return null;
  const when = status.removedAt ? ` on ${formatShortDate(status.removedAt)}` : '';
  return status.removedBySelf
    ? `You left this gym's team${when}.`
    : `You were removed from this gym's team${when}.`;
}

export function ActionGrid({
  isFollowing,
  myStaffStatus,
  memberState,
  isGymStaff,
  onWriteReview,
  onFollow,
  onJoinAsMember,
  onJoinAsTrainer,
  canLeave,
  onLeave,
  todayCheckInState,
  onCheckIn,
  onCompare,
}: {
  isFollowing: boolean;
  myStaffStatus: MyStaffStatus | null;
  // The caller's own membership state at this gym (null = no membership row).
  memberState: MembershipState | null;
  // Active staff of this gym, in any role. They can't review it (that would
  // undermine verified reviews) or request membership at it, so those two
  // actions are left out entirely.
  isGymStaff: boolean;
  onWriteReview: () => void;
  onFollow: () => void;
  onJoinAsMember: () => void;
  onJoinAsTrainer: () => void;
  // Whether to offer "Leave this gym" at all: false for a sole owner, who could
  // never succeed (the server refuses), so the link is hidden rather than shown
  // and failing. Everyone else on the team keeps it.
  canLeave: boolean;
  onLeave: () => void;
  // Where today's GLOBAL once-per-day check-in cap leaves THIS gym: 'here' if
  // the caller's valid check-in today was at this gym, 'elsewhere' if it was
  // at a different gym (so the button must not claim it happened here), or
  // 'none' for the normal active button.
  todayCheckInState: TodayCheckInState;
  onCheckIn: () => void;
  onCompare: () => void;
}) {
  const trainerButton = trainerButtonFor(myStaffStatus);
  const memberButton = memberButtonFor(memberState);
  const checkInButton = checkInButtonFor(todayCheckInState);
  const endedNote = endedNoteFor(myStaffStatus);
  const { session } = useAuth();
  const router = useRouter();

  function runGated(action: () => void) {
    if (!session) {
      router.push('/login');
      return;
    }
    action();
  }

  const actions = [
    { key: 'review', icon: 'edit-3' as const, label: 'Write a Review', onPress: () => runGated(onWriteReview) },
    {
      key: 'follow',
      icon: 'heart' as const,
      label: isFollowing ? 'Following' : 'Follow',
      onPress: () => runGated(onFollow),
      active: isFollowing,
    },
    {
      key: 'join',
      icon: memberButton.icon,
      label: memberButton.label,
      onPress: () => runGated(onJoinAsMember),
      disabled: memberButton.disabled,
    },
    {
      key: 'trainer',
      icon: trainerButton.icon,
      label: trainerButton.label,
      onPress: () => runGated(onJoinAsTrainer),
      active: trainerButton.active,
      disabled: trainerButton.disabled,
      muted: trainerButton.muted,
    },
    {
      key: 'checkin',
      icon: checkInButton.icon,
      label: checkInButton.label,
      onPress: () => runGated(onCheckIn),
      active: checkInButton.active,
      disabled: checkInButton.disabled,
    },
    // Comparing is read-only, so it isn't login-gated like the others.
    { key: 'compare', icon: 'bar-chart-2' as const, label: 'Compare', onPress: onCompare },
  ];

  // Hidden rather than disabled: a greyed-out "Write a Review" would suggest
  // it could become available, and it never will for this gym. Follow and
  // Check In still make sense for staff, so they stay. The trainer button
  // already says "You're a Trainer" / "On the Team", so it doubles as the
  // affiliation indicator.
  const visibleActions = actions.filter((action) => {
    if (isGymStaff && (action.key === 'review' || action.key === 'join')) return false;
    if (action.key === 'join' && memberButton.hidden) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {visibleActions.map((action) => (
          <Pressable
            key={action.key}
            style={[
              styles.button,
              action.active && styles.buttonActive,
              (action.disabled || action.muted) && !action.active && styles.buttonDisabled,
            ]}
            onPress={action.onPress}
            disabled={action.disabled}
          >
            <Feather
              name={action.icon}
              size={18}
              color={
                action.active
                  ? '#fff'
                  : action.disabled || action.muted
                    ? colors.textMuted
                    : colors.emerald
              }
            />
            <Text
              style={[
                styles.buttonText,
                action.active && styles.buttonTextActive,
                (action.disabled || action.muted) && !action.active && styles.buttonTextDisabled,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isGymStaff ? (
        <>
          <Text style={styles.teamNote}>
            You&apos;re on this gym&apos;s team, so reviews and member requests aren&apos;t available.
          </Text>
          {canLeave ? (
            <Pressable style={styles.leaveLink} onPress={onLeave} hitSlop={8}>
              <Feather name="log-out" size={13} color="#f87171" />
              <Text style={styles.leaveLinkText}>Leave this gym</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {endedNote ? <Text style={styles.endedNote}>{endedNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  teamNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    textAlign: 'center',
  },
  endedNote: {
    fontSize: 12,
    color: '#fbbf24',
    lineHeight: 17,
    textAlign: 'center',
  },
  leaveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  leaveLinkText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
  buttonTextActive: {
    color: '#fff',
  },
});
