import { Alert } from 'react-native';

// Shared so the unfollow prompt reads identically wherever it's triggered
// from - a gym's Follow button, the Saved tab's row action, another
// member's public profile, etc. "Unfollow" works the same for a gym or a
// person, so one generic name/message covers both.
export function confirmUnfollow(name: string, onConfirm: () => void): void {
  Alert.alert(`Unfollow ${name}?`, "You'll stop seeing updates from them.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unfollow', style: 'destructive', onPress: onConfirm },
  ]);
}

// Owner/admin removing someone from the team. Says what actually happens: the
// person is marked removed (not erased), loses their role, and is told next
// time they view their gym affiliations - there are no push notifications.
export function confirmRemoveTeamMember(
  personName: string,
  role: string,
  gymName: string,
  onConfirm: () => void
): void {
  Alert.alert(
    'Remove from team?',
    `${personName} will lose their ${role} role at ${gymName} immediately. They'll see that they were removed the next time they view their gym affiliations.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove from team', style: 'destructive', onPress: onConfirm },
    ]
  );
}

// A team member leaving. The way back only exists for trainers (requesting to
// join is trainer-only), so anyone with a bigger role is told they can't just
// pick it back up.
export function confirmLeaveGym(gymName: string, role: string, onConfirm: () => void): void {
  const wayBack =
    role === 'trainer'
      ? 'You can send a new request to join later.'
      : `You won't get your ${role} role back by requesting - you'd only be able to request to join as a trainer.`;

  Alert.alert(`Leave ${gymName}?`, `You'll be removed from the team right away. ${wayBack}`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave this gym', style: 'destructive', onPress: onConfirm },
  ]);
}

// Same Cancel/destructive-action pattern as confirmUnfollow, for deleting a
// user's own content (album photos/videos, etc).
export function confirmDelete(itemLabel: string, onConfirm: () => void): void {
  Alert.alert(`Delete this ${itemLabel}?`, 'This action cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
