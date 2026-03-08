import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { KycStatus } from '@/lib/types';
import {
  useDiditSession,
  KycLoading,
  KycError,
  KycNativeWaiting,
  KycCompleted,
} from '@/components/kyc';

export default function KycNative() {
  const router = useRouter();
  const { session, initSession, markStarted } = useDiditSession();

  const sessionToken = session.phase === 'ready' ? session.sessionToken : null;

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      try {
        const urlObj = new URL(event.url);
        if (urlObj.pathname.includes('kyc-complete')) {
          router.replace({
            pathname: '/card/activate',
            params: { kycStatus: KycStatus.APPROVED },
          });
        }
      } catch (err) {
        console.error('Error parsing deep link:', err);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!sessionToken) return;

    const subscription = Linking.addEventListener('url', handleDeepLink);

    async function startNativeVerification() {
      if (!sessionToken) return;

      const DiditSdk = await import('@didit-protocol/sdk-react-native');
      const sdk = DiditSdk.DiditSdk ?? DiditSdk.default ?? DiditSdk;

      if (sdk?.startVerification) {
        await sdk.startVerification({ token: sessionToken });
        markStarted();
      }
    }

    startNativeVerification().catch(() => {
      initSession();
    });

    return () => {
      subscription.remove();
    };
  }, [sessionToken, handleDeepLink, markStarted, initSession]);

  return (
    <View style={styles.container}>
      {session.phase === 'loading' && <KycLoading />}
      {session.phase === 'error' && (
        <KycError message={session.message} onRetry={initSession} />
      )}
      {(session.phase === 'ready' || session.phase === 'started') && (
        <KycNativeWaiting />
      )}
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
