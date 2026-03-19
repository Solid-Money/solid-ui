import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

type PermissionStatusLabel = 'authorized' | 'denied' | 'undetermined' | 'not supported';

const STATUS_MAP: Record<Notifications.PermissionStatus, PermissionStatusLabel> = {
  [Notifications.PermissionStatus.GRANTED]: 'authorized',
  [Notifications.PermissionStatus.DENIED]: 'denied',
  [Notifications.PermissionStatus.UNDETERMINED]: 'undetermined',
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
} {
  const [status, setStatus] = useState<PermissionStatusLabel>(
    Platform.OS === 'web' ? 'not supported' : 'undetermined',
  );
  const [loading, setLoading] = useState(Platform.OS !== 'web');
  const appStateRef = useRef(AppState.currentState);

  const fetchStatus = useCallback(async () => {
    if (Platform.OS === 'web') return;

    try {
      setLoading(true);
      const { status: permissionStatus } = await Notifications.getPermissionsAsync();
      setStatus(STATUS_MAP[permissionStatus] ?? 'undetermined');
    } catch {
      console.warn('Failed to read notification permission status');
    } finally {
      setLoading(false);
    }
  }, []);

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
    return { status: 'not supported', loading: false, refetch: () => {} };
  }

  return { status, loading, refetch: fetchStatus };
}
