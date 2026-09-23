import { Feather } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';

import { useAuth } from '../../src/context/auth-context';
import { useUnreadNotificationCount } from '../../src/hooks/useUnreadNotificationCount';

export default function TabsLayout() {
  const { session } = useAuth();
  const router = useRouter();
  const isLoggedIn = !!session;
  // There's no shared header to hang a bell on, so unread notifications badge
  // the Profile tab - which is also where the Notifications button lives.
  const { count: unreadNotifications } = useUnreadNotificationCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Feather name="compass" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="check-in"
        options={{
          title: 'Check In',
          tabBarIcon: ({ color, size }) => <Feather name="map-pin" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Feather name="heart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isLoggedIn ? 'Profile' : 'Account',
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
          tabBarBadge: isLoggedIn && unreadNotifications > 0 ? unreadNotifications : undefined,
        }}
        listeners={{
          tabPress: (event) => {
            if (!isLoggedIn) {
              event.preventDefault();
              router.push('/login');
            }
          },
        }}
      />
    </Tabs>
  );
}
