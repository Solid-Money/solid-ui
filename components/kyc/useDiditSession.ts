import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getDiditVerificationStatus } from '@/lib/api';
import { KycStatus } from '@/lib/types';
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
      Toast.show({ type: 'error', text1: 'Error', text2: message });
    }
  }, []);

  const markStarted = useCallback(() => {
    setSession({ phase: 'started' });
  }, []);

  const redirectToActivate = useCallback(
    (kycStatus: KycStatus) => {
      setSession({ phase: 'completed' });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });
      router.replace(`${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}` as any);
    },
    [queryClient, router],
  );

  const onVerificationComplete = useCallback(() => {
    Toast.show({
      type: 'success',
      text1: 'Verification complete',
      text2: 'Your identity has been verified.',
    });
    redirectToActivate(KycStatus.UNDER_REVIEW);
  }, [redirectToActivate]);

  const onVerificationPending = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Verification submitted',
      text2: 'Your verification is being processed.',
    });
    redirectToActivate(KycStatus.UNDER_REVIEW);
  }, [redirectToActivate]);

  const onVerificationError = useCallback((message: string) => {
    Toast.show({
      type: 'error',
      text1: 'Verification failed',
      text2: message,
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

        if (status.status === 'Approved' || status.kycStatus === 'approved') {
          clearInterval(interval);
          onVerificationComplete();
        } else if (status.status === 'Declined' || status.kycStatus === 'rejected') {
          clearInterval(interval);
          onVerificationError('Your identity verification was declined. Please try again.');
        }
      } catch {
        // silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session.phase, onVerificationComplete, onVerificationError]);

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
