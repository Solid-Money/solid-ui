import { useCallback, useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { TRANSFI_STATUS_KEY } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { createSumsubSession, getSumsubVerificationStatus } from '@/lib/api';
import { KycStatus, SumsubSessionFlow } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

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
 * Drives the Sumsub KYC flow. Mirrors useDiditSession: creates the session,
 * polls the backend for the canonical status, and routes accordingly. Reused by
 * both the web and native Sumsub screens.
 *
 * Serves two products, selected by the active `kycFlow`:
 *  - card ('card'): the Wirex (EU/EEA) card flow. Sumsub GREEN hands off to
 *    Wirex, which adjudicates, so the backend kycStatus is the source of truth.
 *  - buy-crypto ('transfi'): identity for the TransFi onramp. Verification is
 *    later imported by share token, and the user returns to the Add-funds modal.
 */
export function useSumsubSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const kycFlow = useKycStore(state => state.kycFlow);
  const debugState = useLocalSearchParams<{ state?: string }>().state;
  const [session, setSession] = useState<SumsubSessionState>({ phase: 'loading' });

  // The backend needs to know which product asked for the session so it doesn't
  // record onramp users as Wirex card customers.
  const sumsubFlow: SumsubSessionFlow = kycFlow === 'transfi' ? 'onramp' : 'card';

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus) => {
      setSession({ phase: 'completed' });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      // TransFi buy-crypto flow: this verification exists to be shared with
      // TransFi. Re-enter the Add-funds modal at the buy-crypto KYC pending step
      // (which fires the share and polls) and return to the home screen where
      // that modal is mounted. Invalidating the gating query first stops the
      // pending screen mounting against a stale needs_kyc.
      if (kycFlow === 'transfi') {
        queryClient.invalidateQueries({ queryKey: [TRANSFI_STATUS_KEY] });
        useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
        router.replace(path.HOME as any);
        return;
      }

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
    [kycFlow, queryClient, router],
  );

  /**
   * Fetch a fresh access token — also used as the WebSDK expiration handler,
   * which is why it must pass the same flow: a mid-session refresh that flipped
   * to 'card' would re-run the card-side bookkeeping.
   */
  const fetchAccessToken = useCallback(async (): Promise<string> => {
    const res = await withRefreshToken(() => createSumsubSession(sumsubFlow));
    if (!res?.token) throw new Error('No Sumsub access token in session response');
    return res.token;
  }, [sumsubFlow]);

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
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'sumsub', flow: sumsubFlow });
      const res = await withRefreshToken(() => createSumsubSession(sumsubFlow));
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
  }, [debugState, redirectBasedOnKycStatus, sumsubFlow]);

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
    // Sumsub done → the partner hand-off (Wirex for the card, TransFi for
    // buy-crypto) is in progress on the backend, so land on the review/pending
    // screen for whichever flow we're in.
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

  /**
   * Sumsub asked for a resubmission (RED + reviewRejectType RETRY, i.e. the
   * mobile SDK's `TemporarilyDeclined`). The user must stay INSIDE the widget —
   * that is where Sumsub renders the "re-upload your document" step. Redirecting
   * away here is what previously made a re-upload request impossible to action.
   */
  const onVerificationRetry = useCallback((reason?: string) => {
    Toast.show({
      type: 'info',
      text1: 'More information needed',
      text2: reason || 'Please re-upload the requested document to continue.',
      props: { badgeText: '' },
    });
    setSession({ phase: 'started' });
  }, []);

  /**
   * User closed the Sumsub SDK before submitting anything. There is no outcome to
   * poll for, so staying here leaves them watching the "Complete it and return
   * here" spinner forever. Re-initialising instead would immediately relaunch the
   * SDK and trap them in a loop, so send them back to where KYC started.
   */
  const onVerificationCancelled = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(path.CARD_ACTIVATE as any);
  }, [router]);

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

        // Only the canonical kycStatus may eject the user. A raw
        // `reviewAnswer === 'RED'` check would also fire for a RETRY (a
        // resubmission request), throwing the user out of the widget exactly when
        // they need to stay in it. The backend already encodes RETRY as
        // INCOMPLETE and FINAL as REJECTED.
        if (status.kycStatus === KycStatus.REJECTED) {
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
    onVerificationCancelled,
    onVerificationRetry,
    onVerificationError,
  };
}
