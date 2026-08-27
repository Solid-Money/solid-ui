import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useReinitOnRefocus } from '@/components/kyc/useReinitOnRefocus';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getCardStatus, getDiditVerificationStatus } from '@/lib/api';
import { KycStatus, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';
import { useUserStore } from '@/store/useUserStore';

import type { KycHandoffOutcome } from '@/components/kyc/KycStatusViews';

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'unavailable'; message: string }
  | { phase: 'ready'; verificationUrl: string; sessionToken: string }
  | { phase: 'started' }
  /**
   * Hand-off: the user is being routed off /kyc. `destination` is retained so a
   * navigation that does not land can be retried, and so the interstitial can
   * offer a manual button instead of stranding the user on "Redirecting...".
   */
  | { phase: 'completed'; outcome: KycHandoffOutcome; destination?: string };

const POLL_INTERVAL_MS = 5000;
/** Re-issue the hand-off navigation once if we are still sitting on it. */
const REDIRECT_RETRY_MS = 2500;

export function useDiditSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const kycFlow = useKycStore(state => state.kycFlow);
  // Debug deep-link: /kyc?state=<phase> previews a static screen (see switch in
  // initSession). Read once here so initSession can branch on it.
  const debugState = useLocalSearchParams<{ state?: string }>().state;
  const [session, setSession] = useState<SessionState>({ phase: 'loading' });
  const sdkInitializedRef = useRef(false);

  /** Where this KYC outcome should land the user. No navigation, just the href. */
  const resolveDestination = useCallback(
    async (kycStatus: KycStatus): Promise<string> => {
      // VA flow: KYC is just a gate for opening the virtual account. Always
      // surface the pending submission page after KYC — the user re-enters
      // the VA flow via Deposit when their KYC + Rain status is approved.
      if (kycFlow === 'va') return String(path.CARD_PENDING);

      // TransFi buy-crypto flow: KYC (Didit) is a gate for sharing identity with
      // TransFi. The user resumes in the Add-funds modal, which is mounted on
      // the home screen — see redirectBasedOnKycStatus, which re-opens that
      // modal at the buy-crypto KYC pending step before navigating here.
      if (kycFlow === 'transfi') return String(path.HOME);

      if (kycStatus === KycStatus.APPROVED) {
        // Didit KYC approved: route by Rain status. Approved -> ready.
        // Manual review (Rain pending/manualReview, which maps to backend
        // kycStatus = under_review) -> pending so the user sees the review
        // state. Anything else (needsInformation/needsVerification) ->
        // activate so they see the step-one button.
        try {
          const cardStatusResponse = await withRefreshToken(() => getCardStatus());
          if (cardStatusResponse?.rainApplicationStatus === RainApplicationStatus.APPROVED) {
            return String(path.CARD_READY);
          }
          if (cardStatusResponse?.kycStatus === KycStatus.UNDER_REVIEW) {
            return String(path.CARD_PENDING);
          }
        } catch {
          // On error fall through to activate page as a safe default
        }
        return String(path.CARD_ACTIVATE);
      }
      if (kycStatus === KycStatus.UNDER_REVIEW) return String(path.CARD_PENDING);
      return `${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}`;
    },
    [kycFlow],
  );

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus, outcome?: KycHandoffOutcome) => {
      const handoff =
        outcome ?? (kycStatus === KycStatus.APPROVED ? 'approved' : ('submitted' as const));
      // Render the hand-off before resolving the destination: that resolution
      // can make a network call, and this screen must not sit blank while it
      // runs (nor silently hang if the call never settles).
      setSession({ phase: 'completed', outcome: handoff });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      const destination = await resolveDestination(kycStatus);

      // TransFi buy-crypto flow: re-enter the Add-funds modal at the buy-crypto
      // KYC pending step, which forwards the freshly-approved Didit KYC to
      // TransFi and polls. Set before navigating so the modal is already staged
      // when the home screen that mounts it comes into focus.
      if (kycFlow === 'transfi') {
        useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
      }

      setSession({ phase: 'completed', outcome: handoff, destination });
      router.replace(destination as any);
    },
    [kycFlow, queryClient, resolveDestination, router],
  );

  /**
   * Manual escape from the hand-off interstitial, wired to its Continue button.
   * Falls back to the activate page when the destination never resolved. Read
   * through a ref so this callback stays referentially stable — the
   * interstitial keys its "looks stuck" timer on it, and a changing identity
   * would keep restarting that timer.
   */
  const destinationRef = useRef<string | null>(null);
  destinationRef.current =
    session.phase === 'completed' ? (session.destination ?? null) : destinationRef.current;
  const retryRedirect = useCallback(() => {
    router.replace((destinationRef.current ?? String(path.CARD_ACTIVATE)) as any);
  }, [router]);

  /**
   * One automatic retry, because the hand-off is only ever a pass-through: if we
   * are still focused on it a beat after navigating, the navigation did not
   * take. `useFocusEffect` cleans up on blur, so a redirect that *did* land can
   * never be yanked back by a late retry.
   */
  useFocusEffect(
    useCallback(() => {
      if (session.phase !== 'completed' || !session.destination) return;
      const destination = session.destination;
      const timer = setTimeout(() => router.replace(destination as any), REDIRECT_RETRY_MS);
      return () => clearTimeout(timer);
    }, [router, session]),
  );

  const initSession = useCallback(async () => {
    // Debug deep-link: /kyc?state=<phase> renders a static screen without
    // creating a real Didit session — handy for previewing these states
    // directly (e.g. /kyc?state=unavailable). Dynamic phases (ready/started)
    // need a live session and are intentionally not deep-linkable.
    switch (debugState) {
      case 'unavailable':
        setSession({
          phase: 'unavailable',
          message: 'Identity verification is temporarily unavailable. Please try again shortly.',
        });
        return;
      case 'error':
        setSession({ phase: 'error', message: 'Failed to create verification session' });
        return;
      case 'loading':
        setSession({ phase: 'loading' });
        return;
      case 'completed':
        setSession({ phase: 'completed', outcome: 'approved' });
        return;
      case 'existing':
        setSession({ phase: 'completed', outcome: 'existing' });
        return;
    }

    setSession({ phase: 'loading' });
    sdkInitializedRef.current = false;

    try {
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'didit' });
      // The TransFi buy-crypto flow reuses the standard 'card' identity
      // workflow — only 'va' has its own Didit workflow. We later forward the
      // completed session to TransFi regardless of which workflow ran.
      const diditFlow = kycFlow === 'va' ? 'va' : 'card';
      const res = await withRefreshToken(() => createDiditSession(undefined, diditFlow));
      if (!res) {
        setSession({
          phase: 'error',
          message: 'Failed to create verification session',
        });
        return;
      }
      const verificationUrl = res.verification_url ?? res.url;
      if (!verificationUrl) {
        setSession({
          phase: 'error',
          message: 'No verification URL in session response',
        });
        return;
      }
      setSession({
        phase: 'ready',
        verificationUrl,
        sessionToken: res.session_token,
      });
    } catch (e: any) {
      // KYC_ALREADY_EXISTS (409): the user already has an established KYC
      // record (a provider consumer), so the backend refuses to create a new
      // Didit session rather than overwrite it — overwriting previously
      // detached the user's existing card. This is NOT a pass: the record may
      // be expired, in review, or awaiting a resubmission. Resolve the real
      // status, route on it, and label the hand-off 'existing' rather than
      // claiming "Verification complete!" over a rejected selfie.
      const hasExistingKyc =
        e?.code === 'KYC_ALREADY_EXISTS' || e?.status === 409 || e?.statusCode === 409;
      if (hasExistingKyc) {
        try {
          const status = await withRefreshToken(() => getDiditVerificationStatus());
          await redirectBasedOnKycStatus(status?.kycStatus ?? KycStatus.APPROVED, 'existing');
        } catch {
          // Status lookup failed — let the card status page resolve the final
          // destination, still without claiming the check passed.
          await redirectBasedOnKycStatus(KycStatus.APPROVED, 'existing');
        }
        return;
      }
      // VERIFICATION_UNAVAILABLE (503): the org-wide Didit credit balance is
      // depleted, so no session can be created for anyone. Surface a calm,
      // branded "temporarily unavailable" page rather than the red hard-error
      // state + toast — it's transient and not the user's fault.
      const isUnavailable =
        e?.code === 'VERIFICATION_UNAVAILABLE' || e?.status === 503 || e?.statusCode === 503;
      if (isUnavailable) {
        setSession({
          phase: 'unavailable',
          message:
            e?.message ||
            'Identity verification is temporarily unavailable. Please try again shortly.',
        });
        return;
      }
      const message = e?.message || 'Failed to create verification session';
      setSession({ phase: 'error', message });
      Toast.show({ type: 'error', text1: 'Error', text2: message, props: { badgeText: '' } });
    }
  }, [debugState, kycFlow, redirectBasedOnKycStatus]);

  const markStarted = useCallback(() => {
    // Persisted so the home screen can tell "started verification and walked
    // away" from "never started" — the two look identical on /cards/status for
    // a while, and only the former should be nudged to finish.
    const userId = useUserStore.getState().users.find(user => user.selected)?.userId;
    if (userId) useKycStore.getState().markKycStarted(userId);
    setSession({ phase: 'started' });
  }, []);

  const onVerificationComplete = useCallback(() => {
    Toast.show({
      type: 'success',
      text1: 'Verification complete',
      text2: 'Your identity has been verified.',
      props: { badgeText: '' },
    });
    redirectBasedOnKycStatus(KycStatus.APPROVED);
  }, [redirectBasedOnKycStatus]);

  const onVerificationPending = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Verification submitted',
      text2: 'Your verification is being processed.',
      props: { badgeText: '' },
    });
    redirectBasedOnKycStatus(KycStatus.UNDER_REVIEW);
  }, [redirectBasedOnKycStatus]);

  /**
   * Didit terminal Declined: ID failed validation (e.g. expired doc, missing DOB, blocklist).
   * Bounce back to /card/activate?kycStatus=rejected so the step-1 description renders the
   * specific warnings (formatted via DIDIT_WARNING_DESCRIPTIONS / short_description) and the
   * user clicks "Retry KYC" — which spins up a fresh Didit session via initSession. Without
   * this redirect the user gets stuck on /kyc with a generic error and a "Try again" button
   * that loops the same broken document.
   */
  const onVerificationDeclined = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: 'Verification declined',
      text2: 'Review the details and try again with a valid document.',
      props: { badgeText: '' },
    });
    redirectBasedOnKycStatus(KycStatus.REJECTED, 'declined');
  }, [redirectBasedOnKycStatus]);

  /**
   * User closed the provider SDK before submitting anything. There is no outcome to
   * poll for, so staying on /kyc leaves them watching the "Complete it and return
   * here" spinner forever. Re-initialising instead would immediately relaunch the
   * SDK and trap them in a loop, so send them back to the screen that started KYC.
   */
  const onVerificationCancelled = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace((kycFlow === 'va' ? path.HOME : path.CARD_ACTIVATE) as any);
  }, [kycFlow, router]);

  /**
   * Hard failure (network error, session creation failed, SDK reported `failed`). Stays on
   * /kyc and shows the error UI with a Try-again button — distinct from Declined, which is a
   * KYC outcome we want surfaced on /card/activate alongside the warnings.
   */
  const onVerificationError = useCallback((message: string) => {
    Toast.show({
      type: 'error',
      text1: 'Verification failed',
      text2: message,
      props: { badgeText: '' },
    });
    setSession({ phase: 'error', message });
  }, []);

  // Poll for verification status while SDK is active
  useEffect(() => {
    if (session.phase !== 'started') return;

    const interval = setInterval(async () => {
      try {
        const status = await withRefreshToken(() => getDiditVerificationStatus());
        if (!status) return;

        // Backend kycStatus is the canonical source — it reflects the full
        // pipeline (Didit + Rain) so check it before the Didit-only
        // status.status. A Didit `Approved` with kycStatus `under_review`
        // means manual review is in progress and should route to pending.
        if (status.kycStatus === KycStatus.UNDER_REVIEW || status.status === 'In Review') {
          clearInterval(interval);
          onVerificationPending();
        } else if (status.kycStatus === KycStatus.REJECTED || status.status === 'Declined') {
          clearInterval(interval);
          onVerificationDeclined();
        } else if (status.kycStatus === KycStatus.APPROVED || status.status === 'Approved') {
          clearInterval(interval);
          onVerificationComplete();
        }
      } catch {
        // silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    session.phase,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationError,
    onVerificationPending,
  ]);

  // Auto-init on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  // ...and again when the screen is re-entered on a spent session. This is a
  // tab route that is frozen rather than unmounted, so without this the mount
  // effect above never runs a second time.
  useReinitOnRefocus(session.phase, initSession);

  return {
    session,
    initSession,
    markStarted,
    retryRedirect,
    onVerificationComplete,
    onVerificationPending,
    onVerificationDeclined,
    onVerificationCancelled,
    onVerificationError,
  };
}
