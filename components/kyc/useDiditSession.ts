import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getCardStatus, getDiditVerificationStatus } from '@/lib/api';
import { KycStatus, RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export type SessionState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; verificationUrl: string; sessionToken: string }
  | { phase: 'started' }
  | { phase: 'completed' };

const POLL_INTERVAL_MS = 5000;

export function useDiditSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ phase: 'loading' });
  const sdkInitializedRef = useRef(false);

  const initSession = useCallback(async () => {
    setSession({ phase: 'loading' });
    sdkInitializedRef.current = false;

    try {
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'didit' });
      const res = await withRefreshToken(() => createDiditSession());
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
      const message = e?.message || 'Failed to create verification session';
      setSession({ phase: 'error', message });
      Toast.show({ type: 'error', text1: 'Error', text2: message, props: { badgeText: '' } });
    }
  }, []);

  const markStarted = useCallback(() => {
    setSession({ phase: 'started' });
  }, []);

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus) => {
      setSession({ phase: 'completed' });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

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
    [queryClient, router],
  );

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
          onVerificationError('Your identity verification was declined. Please try again.');
        } else if (status.kycStatus === KycStatus.APPROVED || status.status === 'Approved') {
          clearInterval(interval);
          onVerificationComplete();
        }
      } catch {
        // silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session.phase, onVerificationComplete, onVerificationError, onVerificationPending]);

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
    onVerificationError,
  };
}
