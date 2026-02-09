import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

type TrackingStatus = PermissionStatus | 'unavailable';

/**
 * Hook to manage App Tracking Transparency (ATT) on iOS.
 *
 * On iOS: checks the current ATT status on mount and provides requestPermission()
 * to show the native ATT dialog (only shown once per install by iOS).
 *
 * On Android/Web: ATT doesn't exist, so returns granted immediately.
 *
 * Fails open: if the ATT check errors, the app proceeds without IDFA (isTrackingAllowed = false).
 */
export function useTrackingTransparency() {
  const [status, setStatus] = useState<TrackingStatus>(
    Platform.OS === 'ios' ? PermissionStatus.UNDETERMINED : PermissionStatus.GRANTED,
  );
  const [isReady, setIsReady] = useState(Platform.OS !== 'ios');

  // Check current ATT status on mount (iOS only)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let mounted = true;

    getTrackingPermissionsAsync()
      .then(({ status: currentStatus }) => {
        if (mounted) {
          setStatus(currentStatus);
          // If already determined (granted or denied), no dialog needed
          if (currentStatus !== PermissionStatus.UNDETERMINED) {
            setIsReady(true);
          }
        }
      })
      .catch(() => {
        // Fail open: if we can't check, mark as ready with tracking disabled
        if (mounted) {
          setStatus('unavailable');
          setIsReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Request ATT permission (shows the native dialog on iOS)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') {
      return true;
    }

    try {
      const { status: newStatus } = await requestTrackingPermissionsAsync();
      setStatus(newStatus);
      setIsReady(true);
      return newStatus === PermissionStatus.GRANTED;
    } catch {
      // Fail open: mark as ready, tracking stays disabled
      setStatus('unavailable');
      setIsReady(true);
      return false;
    }
  }, []);

  const isTrackingAllowed = status === PermissionStatus.GRANTED;

  return {
    /** Whether the ATT check is complete and analytics can be initialized */
    isReady,
    /** Whether the user granted tracking permission (always true on Android/Web) */
    isTrackingAllowed,
    /** Current ATT permission status */
    status,
    /** Show the ATT dialog (iOS only, no-op on other platforms). Returns whether granted. */
    requestPermission,
  };
}
