import { Alert } from 'react-native';

import { cooldownMessage, requestJoinAsTrainer } from './trainer';

// Every prompt in the trainer-request flow names the gym, so the user always
// knows exactly which gym they're applying to before anything is submitted.
// Shared so the gym page and the trainer profile screen read identically.

export function confirmTrainerRequest(
  gymName: string,
  onConfirm: () => void,
  options: { previouslyDeclined?: boolean } = {}
): void {
  Alert.alert(
    `Request to join ${gymName} as a trainer?`,
    options.previouslyDeclined
      ? `${gymName} declined your earlier request. You can send a new one - it may help to update your trainer profile and certifications first. They'll be sent to ${gymName}'s owner for review.`
      : `Your trainer profile, including your certifications, will be sent to ${gymName}'s owner for review.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send request', onPress: onConfirm },
    ]
  );
}

// Shown when someone tries to re-request a gym that declined them, before the
// waiting period is over. The remaining time is the server's figure.
export function alertTrainerCooldown(gymName: string, remainingSeconds: number): void {
  Alert.alert(
    'Please wait before requesting again',
    `${gymName} declined your earlier request. ${cooldownMessage(remainingSeconds)}`
  );
}

export function promptCreateTrainerProfile(gymName: string, onCreate: () => void): void {
  Alert.alert(
    'Create your trainer profile first',
    `To request to join ${gymName} as a trainer, you need a trainer profile so the gym can review your background. Create it now, then confirm your request to ${gymName}.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Create profile', onPress: onCreate },
    ]
  );
}

// Resolves true once the request is settled (sent, or already on file) so a
// caller can clear its "applying to..." context; false when the user still has
// something to fix (missing profile, an error) and should stay put.
export async function sendTrainerRequest({
  gymId,
  gymName,
  userId,
  onNeedsProfile,
}: {
  gymId: number;
  gymName: string;
  userId: string;
  onNeedsProfile: () => void;
}): Promise<boolean> {
  try {
    const result = await requestJoinAsTrainer(gymId, userId);
    switch (result.kind) {
      case 'success':
        Alert.alert(
          'Request sent',
          `Your request to join ${gymName} as a trainer has been sent to the gym's owner for approval.`
        );
        return true;
      case 'needs_profile':
        onNeedsProfile();
        return false;
      case 'duplicate':
        Alert.alert(`Already requested - ${gymName}`, result.message);
        return true;
      case 'cooldown':
        alertTrainerCooldown(gymName, result.remainingSeconds);
        return true;
      default:
        Alert.alert('Something went wrong', result.message);
        return false;
    }
  } catch (err) {
    Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    return false;
  }
}
