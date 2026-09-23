import { useRouter } from 'expo-router';

import { useAuth } from '../context/auth-context';

// Shared by any list that shows another user's name (reviews, team
// members, etc.) - tapping your own name goes to the Profile tab instead
// of the public profile screen, since that screen is for viewing others.
export function useProfileNavigation() {
  const { session } = useAuth();
  const router = useRouter();

  return function goToProfile(userId: string) {
    if (session?.user.id === userId) {
      router.push('/profile');
      return;
    }
    router.push({ pathname: '/user/[id]', params: { id: userId } });
  };
}
