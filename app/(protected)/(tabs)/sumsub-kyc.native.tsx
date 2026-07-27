import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
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
 * Native Sumsub KYC screen (Wirex / EU flow). Uses the native Sumsub mobile SDK
 * (@sumsub/react-native-mobilesdk-module) — a full-screen native flow, launched
 * with the backend access token. Requires a custom dev client (this app already
 * ships native modules via EAS, e.g. the Didit SDK); the Android Maven repo and
 * iOS permissions are wired in app.config.ts.
 *
 * The backend kycStatus (polled by useSumsubSession) is the source of truth —
 * it reflects the Sumsub review AND the downstream Wirex hand-off — so the SDK
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
    onVerificationError,
  } = useSumsubSession();
  const launchedRef = useRef(false);

  const accessToken = session.phase === 'ready' ? session.accessToken : null;

  useEffect(() => {
    if (!accessToken || launchedRef.current) return;
    launchedRef.current = true;

    let cancelled = false;

    // init(accessToken, expirationHandler): the handler returns a Promise that
    // resolves to a fresh token when the current one expires.
    const instance = SNSMobileSDK.init(accessToken, () => fetchAccessToken())
      .withHandlers({
        onStatusChanged: (event: { prevStatus?: string; newStatus?: string }) => {
          if (cancelled) return;
          if (event?.newStatus === 'Approved') onVerificationComplete();
          else if (event?.newStatus === 'FinallyRejected') onVerificationDeclined();
        },
      })
      .withLocale('en')
      .build();

    markStarted();

    instance
      .launch()
      .then((result: { success?: boolean; status?: string }) => {
        if (cancelled) return;
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
          // Closed before submitting (Initial/Ready) → let them retry.
          launchedRef.current = false;
          initSession();
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        launchedRef.current = false;
        onVerificationError(e instanceof Error ? e.message : 'Verification failed');
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    fetchAccessToken,
    markStarted,
    initSession,
    onVerificationComplete,
    onVerificationDeclined,
    onVerificationError,
  ]);

  return (
    <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
