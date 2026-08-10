import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import SNSMobileSDK from '@sumsub/react-native-mobilesdk-module';

import {
  KycCompleted,
  KycError,
  KycLoading,
  KycNativeWaiting,
  KycUnavailable,
  useSumsubSession,
} from '@/components/kyc';

/**
 * Native Sumsub KYC screen. Uses the native Sumsub mobile SDK
 * (@sumsub/react-native-mobilesdk-module) — a full-screen native flow, launched
 * with the backend access token. Requires a custom dev client (this app already
 * ships native modules via EAS, e.g. the Didit SDK); the Android Maven repo and
 * iOS permissions are wired in app.config.ts.
 *
 * Serves both Sumsub products (Wirex card, TransFi buy-crypto); useSumsubSession
 * handles the difference. The backend status it polls is the source of truth —
 * it reflects the Sumsub review AND the downstream partner hand-off — so the SDK
 * status events here are best-effort accelerators.
 */
export default function SumsubKycNative() {
  const {
    session,
    initSession,
    markStarted,
    fetchAccessToken,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationCancelled,
    onVerificationError,
  } = useSumsubSession();
  const launchedRef = useRef(false);
  const isMountedRef = useRef(true);

  const accessToken = session.phase === 'ready' ? session.accessToken : null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken || launchedRef.current) return;
    launchedRef.current = true;

    // init(accessToken, expirationHandler): the handler returns a Promise that
    // resolves to a fresh token when the current one expires.
    const instance = SNSMobileSDK.init(accessToken, () => fetchAccessToken())
      .withHandlers({
        onStatusChanged: (event: { prevStatus?: string; newStatus?: string }) => {
          if (!isMountedRef.current) return;
          if (event?.newStatus === 'Approved') onVerificationComplete();
          else if (event?.newStatus === 'FinallyRejected') onVerificationDeclined();
        },
      })
      .withLocale('en')
      .build();

    // Flips the phase to 'started', which clears accessToken and re-runs this
    // effect. Guarding the callbacks below on the mounted ref rather than an
    // effect-scoped `cancelled` flag is what keeps the launch result from being
    // discarded by that re-run — dropping it left the user stranded on the
    // "Complete it and return here" spinner after closing the SDK.
    markStarted();

    instance
      .launch()
      .then((result: { success?: boolean; status?: string }) => {
        if (!isMountedRef.current) return;
        const status = result?.status;
        if (status === 'Approved') {
          onVerificationComplete();
        } else if (status === 'FinallyRejected') {
          onVerificationDeclined();
        } else if (
          status === 'Pending' ||
          status === 'Incomplete' ||
          status === 'TemporarilyDeclined' ||
          status === 'ActionCompleted'
        ) {
          // Submitted → Wirex adjudicates; land on the pending/review screen.
          onVerificationComplete();
        } else {
          // Closed before submitting (Initial/Ready) → nothing to poll for.
          onVerificationCancelled();
        }
      })
      .catch((e: unknown) => {
        if (!isMountedRef.current) return;
        launchedRef.current = false;
        onVerificationError(e instanceof Error ? e.message : 'Verification failed');
      });
  }, [
    accessToken,
    fetchAccessToken,
    markStarted,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationCancelled,
    onVerificationError,
  ]);

  return (
    <View className="flex-1 bg-background">
      {session.phase === 'loading' && <KycLoading />}
      {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}
      {session.phase === 'unavailable' && (
        <KycUnavailable message={session.message} onRetry={initSession} />
      )}
      {(session.phase === 'ready' || session.phase === 'started') && <KycNativeWaiting />}
      {session.phase === 'completed' && <KycCompleted />}
    </View>
  );
}
