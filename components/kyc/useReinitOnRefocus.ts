import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Session phases that have nothing left to run: the KYC widget is closed and
 * the hook is only waiting to hand the user off or offer a retry button.
 *
 * `started` and `ready` are deliberately absent — a verification is in flight
 * there, and restarting it under a running SDK would discard the user's work.
 */
const TERMINAL_PHASES: readonly string[] = ['completed', 'error', 'unavailable'];

/**
 * Whether re-focusing a KYC screen should start a fresh session.
 *
 * Both KYC screens (`kyc`, `sumsub-kyc`) are tab routes with `href: null` and
 * `freezeOnBlur`, so they are frozen on exit but never unmounted. Their session
 * state therefore survives, and the mount-only `initSession()` never runs again.
 * A user who was asked to re-upload a document (Sumsub RED + rejectType RETRY,
 * which the backend records as `kycStatus: incomplete`) pressed "Continue
 * verification", landed back on the previous visit's hand-off interstitial —
 * "Verification submitted / Taking you to the next step..." — and was bounced
 * straight back to `/card/pending` by the redirect retry. The SDK never
 * reopened, so the re-upload was impossible without killing the app.
 *
 * Split out as a pure function because the app has no react renderer in tests.
 */
export function shouldRestartKycSession(phase: string, hasLeftScreen: boolean): boolean {
  return hasLeftScreen && TERMINAL_PHASES.includes(phase);
}

/**
 * Re-run `reinit` when the screen is re-entered holding a spent session.
 *
 * Everything is read through refs so the focus callback keeps a stable identity:
 * `useFocusEffect` re-runs its callback whenever that identity changes, which
 * would fire the cleanup (marking the screen as left) and then the body again —
 * a plain re-render would read as a re-entry and restart a live session.
 */
export function useReinitOnRefocus(phase: string, reinit: () => void): void {
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const reinitRef = useRef(reinit);
  reinitRef.current = reinit;
  const hasLeftScreenRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const hasLeftScreen = hasLeftScreenRef.current;
      hasLeftScreenRef.current = false;
      if (shouldRestartKycSession(phaseRef.current, hasLeftScreen)) reinitRef.current();
      return () => {
        hasLeftScreenRef.current = true;
      };
    }, []),
  );
}
