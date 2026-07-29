import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { startVerification, VerificationStatus } from '@didit-protocol/sdk-react-native';

import {
  KycCompleted,
  KycError,
  KycLoading,
  KycNativeWaiting,
  KycUnavailable,
  useDiditSession,
} from '@/components/kyc';

export default function KycNative() {
  const {
    session,
    initSession,
    markStarted,
    onVerificationComplete,
    onVerificationPending,
    onVerificationDeclined,
    onVerificationCancelled,
    onVerificationError,
  } = useDiditSession();

  const sessionToken = session.phase === 'ready' ? session.sessionToken : null;
  // Which token the SDK has already been launched with, so a re-render can't
  // reopen verification on top of a flow that is already running.
  const launchedTokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionToken || launchedTokenRef.current === sessionToken) return;
    launchedTokenRef.current = sessionToken;

    async function verify(token: string) {
      // Flips the phase to 'started', which clears sessionToken and re-runs this
      // effect. Guarding on the mounted ref rather than an effect-scoped
      // `cancelled` flag is what keeps the awaited result below from being
      // discarded by that re-run — dropping it left the user stranded on the
      // "Complete it and return here" spinner after closing the SDK.
      markStarted();
      const result = await startVerification(token);

      if (!isMountedRef.current) return;

      switch (result.type) {
        case 'completed':
          if (result.session.status === VerificationStatus.Approved) {
            onVerificationComplete();
          } else if (result.session.status === VerificationStatus.Declined) {
            // Redirect to /card/activate so the user sees specific Didit warnings
            // (DOCUMENT_EXPIRED, DATE_OF_BIRTH_NOT_DETECTED, ...) instead of a
            // generic declined screen with a retry button that loops.
            onVerificationDeclined();
          } else {
            // 'Pending', 'In Review', etc. — redirect back to activate page
            // so user sees "Under Review" state instead of blank page
            onVerificationPending();
          }
          break;
        case 'cancelled':
          onVerificationCancelled();
          break;
        case 'failed':
          onVerificationError(result.error?.message ?? 'Verification failed');
          break;
      }
    }

    verify(sessionToken).catch(() => {
      if (isMountedRef.current) {
        launchedTokenRef.current = null;
        onVerificationError('Failed to start verification');
      }
    });
  }, [
    sessionToken,
    markStarted,
    onVerificationComplete,
    onVerificationPending,
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
