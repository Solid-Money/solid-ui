import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { startVerification, VerificationStatus } from '@didit-protocol/sdk-react-native';

import {
  KycCompleted,
  KycError,
  KycLoading,
  KycNativeWaiting,
  useDiditSession,
} from '@/components/kyc';

export default function KycNative() {
  const { session, initSession, markStarted, onVerificationComplete, onVerificationError } =
    useDiditSession();

  const sessionToken = session.phase === 'ready' ? session.sessionToken : null;

  useEffect(() => {
    if (!sessionToken) return;

    let cancelled = false;

    async function verify() {
      if (!sessionToken) return;

      markStarted();
      const result = await startVerification(sessionToken);

      if (cancelled) return;

      switch (result.type) {
        case 'completed':
          if (result.session.status === VerificationStatus.Approved) {
            onVerificationComplete();
          } else if (result.session.status === VerificationStatus.Declined) {
            onVerificationError('Your identity verification was declined.');
          }
          // Pending — polling will handle the final status
          break;
        case 'cancelled':
          initSession();
          break;
        case 'failed':
          onVerificationError(result.error?.message ?? 'Verification failed');
          break;
      }
    }

    verify().catch(() => {
      if (!cancelled) {
        onVerificationError('Failed to start verification');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sessionToken, markStarted, initSession, onVerificationComplete, onVerificationError]);

  return (
    <View style={styles.container}>
      {session.phase === 'loading' && <KycLoading />}
      {session.phase === 'error' && <KycError message={session.message} onRetry={initSession} />}
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
