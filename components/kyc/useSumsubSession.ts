import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useReinitOnRefocus } from '@/components/kyc/useReinitOnRefocus';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_STATUS_QUERY_KEY } from '@/hooks/useCardStatus';
import { TRANSFI_STATUS_KEY } from '@/hooks/useTransfi';
import { track } from '@/lib/analytics';
import { createSumsubSession, getSumsubVerificationStatus } from '@/lib/api';
import { KycStatus, SumsubSessionFlow } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

import type { KycHandoffOutcome } from '@/components/kyc/KycStatusViews';

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
  /**
   * Hand-off: the user is being routed off the Sumsub screen. `destination` is
   * retained so a navigation that does not land can be retried, and so the
   * interstitial can offer a manual button instead of stranding the user.
   */
  | { phase: 'completed'; outcome: KycHandoffOutcome; destination?: string };

const POLL_INTERVAL_MS = 5000;
/** Re-issue the hand-off navigation once if we are still sitting on it. */
const REDIRECT_RETRY_MS = 2500;

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

  /**
   * The country to offer the backend for a CARD session, read at call time.
   *
   * A fallback only: the backend prefers the user's stored residence country
   * and consults this for a user who has none — and then accepts it only when
   * the user picked it themselves, so `source` is passed through rather than
   * flattened. Reading the store here rather than through a selector matches
   * `resolveKycProvider`: the country gate persists its answer a tick before
   * this screen mounts, so a country captured in a render closure can still be
   * the pre-gate `null`.
   *
   * `undefined` is a legitimate answer — the backend then refuses with
   * COUNTRY_REQUIRED and we send the user to pick one, which is the point.
   */
  const readDeclaredCountry = useCallback(() => {
    if (sumsubFlow === 'onramp') return undefined;
    const info = useCountryStore.getState().countryInfo;
    if (!info?.countryCode) return undefined;
    return { countryCode: info.countryCode, source: info.source };
  }, [sumsubFlow]);

  /** Where this KYC outcome should land the user. No navigation, just the href. */
  const resolveDestination = useCallback(
    (kycStatus: KycStatus): string => {
      // The TransFi buy-crypto flow is not a card journey: the verification is
      // shared with TransFi and the user resumes in the Add-funds modal, which
      // is mounted on the home screen.
      if (kycFlow === 'transfi') return String(path.HOME);
      // Wirex has no virtual-account flow — this is card KYC only. Sumsub GREEN
      // hands off to Wirex, which then adjudicates. So:
      //  - APPROVED (Wirex approved) → activate, where the user issues the card.
      //  - UNDER_REVIEW (Sumsub passed, Wirex still deciding) → pending.
      //  - anything else → activate with the status so step 1 renders correctly.
      if (kycStatus === KycStatus.APPROVED) return String(path.CARD_ACTIVATE);
      if (kycStatus === KycStatus.UNDER_REVIEW) return String(path.CARD_PENDING);
      return `${String(path.CARD_ACTIVATE)}?kycStatus=${kycStatus}`;
    },
    [kycFlow],
  );

  const redirectBasedOnKycStatus = useCallback(
    async (kycStatus: KycStatus, outcome?: KycHandoffOutcome) => {
      const handoff =
        outcome ?? (kycStatus === KycStatus.APPROVED ? 'approved' : ('submitted' as const));
      const destination = resolveDestination(kycStatus);
      setSession({ phase: 'completed', outcome: handoff, destination });
      queryClient.invalidateQueries({ queryKey: [CARD_STATUS_QUERY_KEY] });

      // TransFi buy-crypto flow: this verification exists to be shared with
      // TransFi. Re-enter the Add-funds modal at the buy-crypto KYC pending step
      // (which fires the share and polls) and return to the home screen where
      // that modal is mounted. Invalidating the gating query first stops the
      // pending screen mounting against a stale needs_kyc.
      if (kycFlow === 'transfi') {
        queryClient.invalidateQueries({ queryKey: [TRANSFI_STATUS_KEY] });
        useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_KYC_PENDING);
      }

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

  /**
   * Fetch a fresh access token — also used as the WebSDK expiration handler,
   * which is why it must pass the same flow: a mid-session refresh that flipped
   * to 'card' would re-run the card-side bookkeeping.
   */
  const fetchAccessToken = useCallback(async (): Promise<string> => {
    const res = await withRefreshToken(() =>
      createSumsubSession(sumsubFlow, readDeclaredCountry()),
    );
    if (!res?.token) throw new Error('No Sumsub access token in session response');
    return res.token;
  }, [readDeclaredCountry, sumsubFlow]);

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
        setSession({ phase: 'completed', outcome: 'approved' });
        return;
      case 'existing':
        setSession({ phase: 'completed', outcome: 'existing' });
        return;
    }

    setSession({ phase: 'loading' });

    try {
      track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, { mode: 'sumsub', flow: sumsubFlow });
      const res = await withRefreshToken(() =>
        createSumsubSession(sumsubFlow, readDeclaredCountry()),
      );
      if (!res?.token) {
        setSession({ phase: 'error', message: 'Failed to create verification session' });
        return;
      }
      setSession({ phase: 'ready', accessToken: res.token, levelName: res.levelName });
    } catch (e: any) {
      // An identity check is already on file (a provider consumer exists), so
      // the backend refuses a new session. That is not a pass — the record may
      // be in review or awaiting a resubmission — so route on the real status
      // and label the hand-off 'existing' rather than claiming completion.
      const hasExistingKyc =
        e?.code === 'KYC_ALREADY_EXISTS' || e?.status === 409 || e?.statusCode === 409;
      if (hasExistingKyc) {
        try {
          const status = await withRefreshToken(() => getSumsubVerificationStatus());
          await redirectBasedOnKycStatus(status?.kycStatus ?? KycStatus.UNDER_REVIEW, 'existing');
        } catch {
          await redirectBasedOnKycStatus(KycStatus.UNDER_REVIEW, 'existing');
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
      /**
       * COUNTRY_REQUIRED (400): the backend will not open a card verification
       * without knowing where the user lives — it has no stored country and we
       * either sent none or sent one we only guessed from their IP. Send them to
       * pick it; the selection screen persists the choice and re-enters the flow,
       * and the next session establishes it server-side.
       *
       * This is a redirect rather than an error state because there is nothing
       * wrong to report: the flow is missing an answer only the user has. Left
       * as a generic error, it presented as "Failed to create verification
       * session" with no way forward — and before the backend required a
       * country at all, it silently produced a verified user with no card.
       */
      if (e?.code === 'COUNTRY_REQUIRED') {
        track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
          action: 'country_required',
          kycProvider: 'sumsub',
        });
        router.replace(path.CARD_COUNTRY_SELECTION as any);
        return;
      }
      /**
       * CARD_PROVIDER_MISMATCH (400): the user's country is known and it is not
       * Wirex's, so Sumsub is the wrong widget for them — a stale build, or a
       * country that has moved between issuers since this screen was routed to.
       * Back to the country screen, which re-asks routing on the way through and
       * lands them on Didit. Refusing beats minting an applicant Wirex will
       * never be told about.
       */
      if (e?.code === 'CARD_PROVIDER_MISMATCH') {
        track(TRACKING_EVENTS.CARD_KYC_FLOW_TRIGGERED, {
          action: 'provider_mismatch',
          kycProvider: 'sumsub',
        });
        router.replace(path.CARD_COUNTRY_SELECTION as any);
        return;
      }
      const message = e?.message || 'Failed to create verification session';
      setSession({ phase: 'error', message });
      Toast.show({ type: 'error', text1: 'Error', text2: message, props: { badgeText: '' } });
    }
  }, [debugState, readDeclaredCountry, redirectBasedOnKycStatus, router, sumsubFlow]);

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
    redirectBasedOnKycStatus(KycStatus.REJECTED, 'declined');
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

  // ...and again when the screen is re-entered on a spent session. This is a
  // tab route that is frozen rather than unmounted, so without this the mount
  // effect above never runs a second time.
  useReinitOnRefocus(session.phase, initSession);

  return {
    session,
    initSession,
    markStarted,
    retryRedirect,
    fetchAccessToken,
    onVerificationComplete,
    onVerificationPending,
    onVerificationDeclined,
    onVerificationCancelled,
    onVerificationRetry,
    onVerificationError,
  };
}
