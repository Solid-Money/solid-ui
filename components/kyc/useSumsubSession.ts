import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createSumsubSession, getSumsubVerificationStatus } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

/**
 * Session state machine for the Sumsub WebSDK. Unlike Didit (which hands back a
 * verification URL), Sumsub gives an *access token* that the WebSDK is
 * initialised with.
 */
export type SumsubSessionState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'unavailable'; message: string }
  | { phase: 'ready'; accessToken: string; levelName: string }
  | { phase: 'started' }
  | { phase: 'completed' };

const POLL_INTERVAL_MS = 5000;

/**
 * Drives the Sumsub KYC flow for the Wirex (EU/EEA) jurisdiction. Mirrors
 * useDiditSession: creates the session, polls the backend for the canonical
 * kycStatus (which reflects Sumsub review + the downstream Wirex adjudication),
 * and routes accordingly. Reused by both the web and native Sumsub screens.
 */
export function useSumsubSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const debugState = useLocalSearchParams<{ state?: string }>().state;
  const [session, setSession] = useState<SumsubSessionState>({ phase: 'loading' });

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus) => {
      setSession({ phase: 'completed' });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      // Wirex has no virtual-account flow — this is card KYC only. Sumsub GREEN
      // hands off to Wirex, which then adjudicates. So:
      //  - APPROVED (Wirex approved) → activate, where the user issues the card.
      //  - UNDER_REVIEW (Sumsub passed, Wirex still deciding) → pending.
      //  - anything else → activate with the status so step 1 renders correctly.
      if (kycStatus === KycStatus.APPROVED) {
        router.replace(path.CARD_ACTIVATE as any);
      } else if (kycStatus === KycStatus.UNDER_REVIEW) {
        router.replace(path.CARD_PENDING as any);
      } else {
        router.replace(`${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}` as any);
      }
    },
    [queryClient, router],
  );

  /** Fetch a fresh access token — also used as the WebSDK expiration handler. */
  const fetchAccessToken = useCallback(async (): Promise<string> => {
    const res = await withRefreshToken(() => createSumsubSession());
    if (!res?.token) throw new Error('No Sumsub access token in session response');
    return res.token;
  }, []);

  const initSession = useCallback(async () => {
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

    try {
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'sumsub' });
      const res = await withRefreshToken(() => createSumsubSession());
      if (!res?.token) {
        setSession({ phase: 'error', message: 'Failed to create verification session' });
        return;
      }
      setSession({ phase: 'ready', accessToken: res.token, levelName: res.levelName });
    } catch (e: any) {
      // Already verified (or registered with Wirex): resolve status and route on
      // instead of showing an error/retry loop.
      const isAlreadyVerified =
        e?.code === 'KYC_ALREADY_EXISTS' || e?.status === 409 || e?.statusCode === 409;
      if (isAlreadyVerified) {
        try {
          const status = await withRefreshToken(() => getSumsubVerificationStatus());
          await redirectBasedOnKycStatus(status?.kycStatus ?? KycStatus.UNDER_REVIEW);
        } catch {
          await redirectBasedOnKycStatus(KycStatus.UNDER_REVIEW);
        }
        return;
      }
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
  }, [debugState, redirectBasedOnKycStatus]);

  const markStarted = useCallback(() => {
    setSession({ phase: 'started' });
  }, []);

  const onVerificationComplete = useCallback(() => {
    Toast.show({
      type: 'success',
      text1: 'Verification submitted',
      text2: 'Your identity is being finalised.',
      props: { badgeText: '' },
    });
    // Sumsub done → hand-off to Wirex is in progress (backend), so land on the
    // review/pending screen until Wirex approves.
    redirectBasedOnKycStatus(KycStatus.UNDER_REVIEW);
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

  const onVerificationDeclined = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: 'Verification declined',
      text2: 'Review the details and try again with a valid document.',
      props: { badgeText: '' },
    });
    redirectBasedOnKycStatus(KycStatus.REJECTED);
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

  // Poll the backend for the canonical status while the SDK is active.
  useEffect(() => {
    if (session.phase !== 'started') return;

    const interval = setInterval(async () => {
      try {
        const status = await withRefreshToken(() => getSumsubVerificationStatus());
        if (!status) return;

        if (status.kycStatus === KycStatus.REJECTED || status.reviewAnswer === 'RED') {
          clearInterval(interval);
          onVerificationDeclined();
        } else if (status.kycStatus === KycStatus.APPROVED) {
          clearInterval(interval);
          redirectBasedOnKycStatus(KycStatus.APPROVED);
        } else if (status.kycStatus === KycStatus.UNDER_REVIEW || status.reviewAnswer === 'GREEN') {
          clearInterval(interval);
          onVerificationComplete();
        }
      } catch {
        // silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session.phase, onVerificationComplete, onVerificationDeclined, redirectBasedOnKycStatus]);

  // Auto-init on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  return {
    session,
    initSession,
    markStarted,
    fetchAccessToken,
    onVerificationComplete,
    onVerificationPending,
    onVerificationDeclined,
    onVerificationError,
  };
}
