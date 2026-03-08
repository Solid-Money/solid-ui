import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

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

  // Open Didit verification when session is ready
  useEffect(() => {
    if (session.phase !== 'ready') return;

    let subscription: ReturnType<typeof Linking.addEventListener> | undefined;

    async function startNativeVerification() {
      if (session.phase !== 'ready') return;

      subscription = Linking.addEventListener('url', handleDeepLink);

      // Try native SDK first
      try {
        const DiditSdk = await import('@didit-protocol/sdk-react-native');
        const sdk = DiditSdk.DiditSdk ?? DiditSdk.default ?? DiditSdk;
        if (sdk?.startVerification) {
          await sdk.startVerification({ token: session.sessionToken });
          markStarted();
          return;
        }
      } catch {
        // Native SDK not available, fall back to browser
      }

      // Fallback: open verification URL in browser
      const result = await WebBrowser.openBrowserAsync(
        session.verificationUrl,
        {
          presentationStyle:
            WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: '#94F27F',
          toolbarColor: '#000000',
          showTitle: true,
          enableBarCollapsing: false,
        },
      );

      if (result.type === 'dismiss') {
        markStarted();
      }
    }

    startNativeVerification();

    return () => {
      subscription?.remove();
    };
  }, [session, handleDeepLink, markStarted]);

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
