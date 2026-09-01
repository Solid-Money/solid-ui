import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { registerForPushNotificationsAsync } from '@/lib/registerForPushNotifications';

type PermissionStatusLabel = 'Authorized' | 'Denied' | 'Undetermined' | 'Not Supported';

const STATUS_MAP: Record<Notifications.PermissionStatus, PermissionStatusLabel> = {
  [Notifications.PermissionStatus.GRANTED]: 'Authorized',
  [Notifications.PermissionStatus.DENIED]: 'Denied',
  [Notifications.PermissionStatus.UNDETERMINED]: 'Undetermined',
};

/**
 * Reads the current notification permission status on native platforms.
 * Automatically refetches when the app returns to the foreground (e.g., after
 * the user changes permission in system Settings).
 *
 * On web, returns a static "not supported" status.
 */
export default function useNotificationPermissionStatus(): {
  status: PermissionStatusLabel;
  loading: boolean;
  refetch: () => void;
  request: () => Promise<void>;
} {
  const [status, setStatus] = useState<PermissionStatusLabel>(
    Platform.OS === 'web' ? 'Not Supported' : 'Undetermined',
  );
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const appStateRef = useRef(AppState.currentState);

  const fetchStatus = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      setLoading(true);
      const { status: permissionStatus } = await Notifications.getPermissionsAsync();
      setStatus(STATUS_MAP[permissionStatus] ?? 'Undetermined');
    } catch {
      console.warn('Failed to read notification permission status');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Put the OS permission prompt up, then re-read the answer.
   *
   * The only thing that works from an `Undetermined` state. iOS shows an app's
   * Notifications page in Settings only once the app has asked at least once, so
   * a user who has never been prompted cannot enable notifications from Settings
   * at all — there is no row there to turn on. Asking is the only route, and
   * iOS grants exactly one prompt per install, so this is also the only chance.
   *
   * Registering the FCM token is part of the same step: permission with no token
   * on file still means the backend has nowhere to send.
   */
  const request = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      await registerForPushNotificationsAsync();
    } catch (error) {
      console.warn('Notification permission request failed:', error);
    } finally {
      await fetchStatus();
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    fetchStatus();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchStatus();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchStatus]);

  if (Platform.OS === 'web') {
    return {
      status: 'Not Supported',
      loading: false,
      refetch: () => {},
      request: async () => {},
    };
  }

  return { status, loading, refetch: fetchStatus, request };
}
