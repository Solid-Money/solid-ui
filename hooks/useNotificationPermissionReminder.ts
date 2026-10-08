import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useOnboardingStore } from '@/store/useOnboardingStore';

export const NOTIFICATION_REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const HOME_SETTLE_DELAY_MS = 5000;

/** Reuses the notification sheet on a settled Home screen, at most every 30 days. */
export function useNotificationPermissionReminder(enabled: boolean) {
  const lastPromptAt = useOnboardingStore(state => state.lastNotificationPromptAt);
  const recordPrompt = useOnboardingStore(state => state.recordNotificationPrompt);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      if (visible) setVisible(false);
      return;
    }

    let cancelled = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      const checkGeneration = ++generation;
      clearTimeout(timer);
      const now = Date.now();

      // Older installs have no timestamp and are eligible on their first Home
      // visit. Only an invalid timestamp or a backwards clock resets the window.
      if (lastPromptAt !== null && (!Number.isFinite(lastPromptAt) || lastPromptAt > now)) {
        recordPrompt();
        return;
      }
      if (
        visible ||
        (lastPromptAt !== null && now - lastPromptAt < NOTIFICATION_REMINDER_INTERVAL_MS)
      ) {
        return;
      }

      try {
        const permission = await Notifications.getPermissionsAsync();
        if (
          cancelled ||
          checkGeneration !== generation ||
          permission.granted ||
          permission.status === 'granted'
        ) {
          return;
        }

        timer = setTimeout(() => {
          if (cancelled || checkGeneration !== generation || AppState.currentState !== 'active') {
            return;
          }
          // Record presentation as well as dismissal, so a restart cannot show
          // the same reminder again before the cooldown expires.
          recordPrompt();
          setVisible(true);
        }, HOME_SETTLE_DELAY_MS);
      } catch {
        // A failed permission read isn't permission to interrupt the user.
        // Returning to Home or foregrounding the app retries the check.
      }
    };

    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
      else {
        generation += 1;
        clearTimeout(timer);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, lastPromptAt, recordPrompt, visible]);

  const dismiss = useCallback(() => {
    recordPrompt();
    setVisible(false);
  }, [recordPrompt]);

  return { visible: enabled && Platform.OS !== 'web' && visible, dismiss };
}
