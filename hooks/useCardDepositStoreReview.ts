import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useStoreReview } from '@/hooks/useStoreReview';
import { getAmplitudeDeviceId } from '@/lib/analytics';
import { markStoreReviewPrompted, recordAppOpen } from '@/lib/api';
import { StoreReviewDecisionReason } from '@/lib/types';
import { nextAppOpenState, shouldRecordAppOpen } from '@/lib/utils/appOpen';
import { useUserStore } from '@/store/useUserStore';

// Small settle delay so the rating sheet lands at a resting moment rather than
// on top of a still-rendering home screen. Matches the cashback trigger.
const REVIEW_PROMPT_DELAY_MS = 2000;

// The backend owns the real spacing between prompts for this trigger (30 days
// plus "a new deposit since last time"), so the local guard only needs to be
// loose enough not to override it — the default 120 days would.
const REVIEW_REQUEST_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Records every app open on the backend and asks for an in-app store review when
 * the backend says this open qualifies — today that means the user has funded
 * their card at least twice and has come back to the app.
 *
 * Eligibility deliberately lives server-side: it needs the card deposit count
 * from `rainCollateralTransactions`, and keeping the prompt history in the
 * `appOpens` collection means a reinstall (which wipes device storage) can't
 * reset the cooldown. This hook only decides *when* an open happened, and
 * surfaces the sheet when told to.
 *
 * Runs headlessly (renders nothing) and is a no-op on web, which has no native
 * review sheet.
 */
export const useCardDepositStoreReview = () => {
  const { requestReview } = useStoreReview();

  const isAuthenticated = useUserStore(state =>
    state.users.some(u => u.selected && !!u.tokens?.accessToken),
  );

  // Epoch ms of when the app last left the foreground; null while in front.
  const backgroundedAtRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  // Guards against two opens being reported at once (e.g. a foreground event
  // landing while the launch request is still in flight).
  const isRecordingRef = useRef(false);
  // Epoch ms of the last open we reported, so a re-mount or a brief blip in the
  // auth state can't book a second open for the same session. A genuine
  // foreground open is always at least one session gap after the last one.
  const lastRecordedAtRef = useRef<number | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAppOpen = useCallback(async () => {
    const now = Date.now();
    if (isRecordingRef.current) return;
    if (!shouldRecordAppOpen(lastRecordedAtRef.current, now)) return;
    isRecordingRef.current = true;
    lastRecordedAtRef.current = now;

    try {
      const { shouldRequestReview, reason } = await recordAppOpen(
        Platform.OS,
        getAmplitudeDeviceId(),
      );

      if (!shouldRequestReview || reason !== StoreReviewDecisionReason.ELIGIBLE) return;

      promptTimerRef.current = setTimeout(() => {
        promptTimerRef.current = null;

        void (async () => {
          const wasPrompted = await requestReview({
            trigger: 'card_deposits',
            cooldownMs: REVIEW_REQUEST_COOLDOWN_MS,
          });

          // Only start the server-side cooldown if the sheet really was
          // invoked; the OS quota can swallow it, and a prompt the user never
          // saw shouldn't silence the trigger for a month.
          if (!wasPrompted) return;

          try {
            await markStoreReviewPrompted(Platform.OS);
          } catch {
            console.warn('Failed to record store review prompt');
          }
        })();
      }, REVIEW_PROMPT_DELAY_MS);
    } catch {
      // Passive telemetry behind a rating prompt — never surface this.
      console.warn('Failed to record app open');
    } finally {
      isRecordingRef.current = false;
    }
  }, [requestReview]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isAuthenticated) return;

    // The mount itself is an open: this hook is mounted once the user is
    // authenticated, either at launch or right after signing in.
    void handleAppOpen();

    const subscription = AppState.addEventListener('change', nextAppState => {
      const { backgroundedAt, isNewOpen } = nextAppOpenState({
        previousState: appStateRef.current,
        nextState: nextAppState,
        backgroundedAt: backgroundedAtRef.current,
        now: Date.now(),
      });

      appStateRef.current = nextAppState;
      backgroundedAtRef.current = backgroundedAt;

      if (isNewOpen) {
        void handleAppOpen();
      }
    });

    return () => {
      subscription.remove();
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [isAuthenticated, handleAppOpen]);
};
