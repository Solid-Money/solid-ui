import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Text } from '@/components/ui/text';
import { createDiditSession, getDiditVerificationStatus } from '@/lib/api';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';

export default function KycMobile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

  const pollForCompletion = useCallback(async () => {
    try {
      const status = await withRefreshToken(() => getDiditVerificationStatus());
      if (status?.status === 'Approved' || status?.kycStatus === 'approved') {
        router.replace({
          pathname: '/card/activate',
          params: { kycStatus: KycStatus.APPROVED },
        });
      }
    } catch {
      // silently ignore
    }
  }, [router]);

  const openDiditVerification = useCallback(async () => {
    try {
      const subscription = Linking.addEventListener('url', handleDeepLink);

      // Create Didit session via backend
      const session = await withRefreshToken(() => createDiditSession());
      if (!session) {
        setError('Failed to create verification session');
        setLoading(false);
        return;
      }

      // Try native SDK first
      try {
        const DiditSdk = await import('@didit-protocol/sdk-react-native');
        const sdk = DiditSdk.DiditSdk ?? DiditSdk.default ?? DiditSdk;
        if (sdk?.startVerification) {
          setLoading(false);
          await sdk.startVerification({ token: session.session_token });
          setTimeout(pollForCompletion, 1000);
          subscription?.remove();
          return;
        }
      } catch {
        // Native SDK not available, fall back to browser
      }

      // Fallback: open verification URL in browser
      setLoading(false);
      const result = await WebBrowser.openBrowserAsync(
        session.verification_url,
        {
          presentationStyle:
            WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: '#94F27F',
          toolbarColor: '#000000',
          showTitle: true,
          enableBarCollapsing: false,
        },
      );

      subscription?.remove();

      if (result.type === 'dismiss') {
        setTimeout(pollForCompletion, 1000);
      }
    } catch (err) {
      console.error('Error opening Didit verification:', err);
      setError('Failed to open identity verification');
      setLoading(false);
    }
  }, [handleDeepLink, pollForCompletion]);

  useEffect(() => {
    openDiditVerification();
  }, [openDiditVerification]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#94F27F" />
          <Text style={styles.loadingText}>
            Preparing identity verification...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Identity verification opened
        </Text>
        <Text style={styles.subText}>
          Complete the verification and return to the app
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    marginTop: 16,
  },
  subText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: 'red',
    fontSize: 16,
    lineHeight: 24,
  },
});
