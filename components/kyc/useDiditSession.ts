import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { track } from '@/lib/analytics';
import { createDiditSession, getDiditVerificationStatus } from '@/lib/api';
import { path } from '@/constants/path';
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
        setSession({ phase: 'error', message: 'Failed to create verification session' });
        return;
      }
      setSession({
        phase: 'ready',
        verificationUrl: res.verification_url,
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

  // Poll for verification status after SDK started
  useEffect(() => {
    if (session.phase !== 'started') return;

    const interval = setInterval(async () => {
      try {
        const status = await withRefreshToken(() =>
          getDiditVerificationStatus(),
        );
        if (!status) return;

        if (
          status.status === 'Approved' ||
          status.kycStatus === 'approved'
        ) {
          clearInterval(interval);
          setSession({ phase: 'completed' });
          queryClient.invalidateQueries({
            queryKey: [CARD_STATUS_QUERY_KEY],
          });
          Toast.show({
            type: 'success',
            text1: 'Verification complete',
            text2: 'Your identity has been verified.',
          });
          router.replace(String(path.CARD_ACTIVATE) as any);
        } else if (
          status.status === 'Declined' ||
          status.kycStatus === 'rejected'
        ) {
          clearInterval(interval);
          Toast.show({
            type: 'error',
            text1: 'Verification failed',
            text2:
              'Your identity verification was declined. Please try again.',
          });
          setSession({
            phase: 'error',
            message: 'Verification declined',
          });
        }
      } catch {
        // silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session.phase, queryClient, router]);

  // Auto-init on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  return {
    session,
    sdkInitializedRef,
    initSession,
    markStarted,
  };
}
