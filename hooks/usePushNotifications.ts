import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

import { path } from '@/constants/path';
import { registerPushToken } from '@/lib/api';
import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';
import { useUserStore } from '@/store/useUserStore';

/**
 * Manages push notification lifecycle: token refresh and notification tap handling.
 * Must be mounted inside the root layout so listeners are active for the entire session.
 * Only activates when a user is authenticated (has a selected user with tokens).
 */
export function usePushNotifications() {
  const router = useRouter();
  const isAuthenticated = useUserStore(state =>
    state.users.some(u => u.selected && !!u.tokens?.accessToken),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    if (Platform.OS === 'web') return;

    // Ensure push notifications are registered for existing users who
    // may have missed the onboarding screen. This is a no-op if already granted.
    registerForPushNotificationsAsync().catch(err => {
      console.warn('Push notification registration failed:', err);
    });

    // Re-register token whenever FCM refreshes it (e.g., app reinstall, token expiry)
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
      try {
        await registerPushToken(newToken, Platform.OS as 'ios' | 'android');
      } catch (error) {
        console.warn('Failed to register refreshed push token:', error);
      }
    });

    // Handle notification taps (user taps a notification from the system tray)
    const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      _response => {
        // Future: read _response.notification.request.content.data.route for deep linking
        // e.g., router.replace(_response.notification.request.content.data.route as any);
        router.replace(path.HOME);
      },
    );

    return () => {
      unsubscribeTokenRefresh();
      notificationResponseSubscription.remove();
    };
  }, [isAuthenticated, router]);
}
