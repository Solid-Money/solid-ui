import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getCardStatus, getDiditVerificationStatus } from '@/lib/api';
import { KycStatus, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useKycStore } from '@/store/useKycStore';

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'unavailable'; message: string }
  | { phase: 'ready'; verificationUrl: string; sessionToken: string }
  | { phase: 'started' }
  | { phase: 'completed' };

const POLL_INTERVAL_MS = 5000;

export function useDiditSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const kycFlow = useKycStore(state => state.kycFlow);
  // Debug deep-link: /kyc?state=<phase> previews a static screen (see switch in
  // initSession). Read once here so initSession can branch on it.
  const debugState = useLocalSearchParams<{ state?: string }>().state;
  const [session, setSession] = useState<SessionState>({ phase: 'loading' });
  const sdkInitializedRef = useRef(false);

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus) => {
      setSession({ phase: 'completed' });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      // VA flow: KYC is just a gate for opening the virtual account. Always
      // surface the pending submission page after KYC — the user re-enters
      // the VA flow via Deposit when their KYC + Rain status is approved.
      if (kycFlow === 'va') {
        router.replace(path.CARD_PENDING as any);
        return;
      }

      if (kycStatus === KycStatus.APPROVED) {
        // Didit KYC approved: route by Rain status. Approved -> ready.
        // Manual review (Rain pending/manualReview, which maps to backend
        // kycStatus = under_review) -> pending so the user sees the review
        // state. Anything else (needsInformation/needsVerification) ->
        // activate so they see the step-one button.
        try {
          const cardStatusResponse = await withRefreshToken(() => getCardStatus());
          if (cardStatusResponse?.rainApplicationStatus === RainApplicationStatus.APPROVED) {
            router.replace(path.CARD_READY as any);
            return;
          }
          if (cardStatusResponse?.kycStatus === KycStatus.UNDER_REVIEW) {
            router.replace(path.CARD_PENDING as any);
            return;
          }
        } catch {
          // On error fall through to activate page as a safe default
        }
        router.replace(path.CARD_ACTIVATE as any);
      } else if (kycStatus === KycStatus.UNDER_REVIEW) {
        router.replace(path.CARD_PENDING as any);
      } else {
        router.replace(`${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}` as any);
      }
    },
    [kycFlow, queryClient, router],
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
        setSession({ phase: 'completed' });
        return;
    }

    setSession({ phase: 'loading' });
    sdkInitializedRef.current = false;

    try {
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'didit' });
      const res = await withRefreshToken(() => createDiditSession(undefined, kycFlow ?? 'card'));
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
      // detached the user's existing card. This isn't a failure: they're
      // already verified (or in review). Resolve their current status and route
      // them to the right card screen instead of the red error/retry loop.
      const isAlreadyVerified =
        e?.code === 'KYC_ALREADY_EXISTS' || e?.status === 409 || e?.statusCode === 409;
      if (isAlreadyVerified) {
        try {
          const status = await withRefreshToken(() => getDiditVerificationStatus());
          await redirectBasedOnKycStatus(status?.kycStatus ?? KycStatus.APPROVED);
        } catch {
          // Status lookup failed — still treat as verified and let the card
          // status page resolve the final destination.
          await redirectBasedOnKycStatus(KycStatus.APPROVED);
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
    redirectBasedOnKycStatus(KycStatus.REJECTED);
  }, [redirectBasedOnKycStatus]);

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

  return {
    session,
    initSession,
    markStarted,
    onVerificationComplete,
    onVerificationPending,
    onVerificationDeclined,
    onVerificationError,
  };
}
