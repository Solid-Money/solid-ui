import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { KycStatus } from '@/lib/types';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function KycMobile() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      console.log('Deep link received:', event.url);

      try {
        const urlObj = new URL(event.url);

        if (urlObj.pathname.includes('kyc-complete')) {
          // Parse completion status from URL params if available
          const status = urlObj.searchParams.get('status');
          const inquiryId = urlObj.searchParams.get('inquiry-id');

          console.log('KYC completion detected:', { status, inquiryId });

          // Navigate to success regardless of specific status
          // The backend will validate the actual status
          router.replace({
            pathname: path.CARD_ACTIVATE_MOBILE,
            params: {
              kycStatus: KycStatus.APPROVED,
              inquiryId: inquiryId || '',
            },
          });
        }
      } catch (err) {
        console.error('Error parsing deep link:', err);
      }
    },
    [router],
  );

  const openKycWithCompletion = useCallback(async () => {
    try {
      // Set up deep link listener BEFORE opening browser
      const subscription = Linking.addEventListener('url', handleDeepLink);

      // Process the URL to add required parameters
      const urlObj = new URL(url);

      // If URL is from Persona and contains /verify, replace with /widget
      if (urlObj.hostname.includes('withpersona.com') && urlObj.pathname.includes('/verify')) {
        urlObj.pathname = urlObj.pathname.replace('/verify', '/widget');
      }

      // Add completion redirect URL
      urlObj.searchParams.set('redirect_uri', 'solid://kyc-complete');
      urlObj.searchParams.set('redirect-uri', 'solid://kyc-complete');
      urlObj.searchParams.set('environment', 'mobile');

      setLoading(false);

      const result = await WebBrowser.openBrowserAsync(urlObj.toString(), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#94F27F',
        toolbarColor: '#000000',
        showTitle: true,
        enableBarCollapsing: false,
      });

      // Clean up listener
      subscription?.remove();

      // Handle manual browser close (user cancelled)
      if (result.type === 'dismiss') {
        console.log('User manually closed KYC browser');
        // Optionally check status one more time
        setTimeout(() => {
          checkKycStatusFromAPI();
        }, 1000);
      }
    } catch (error) {
      console.error('Error opening KYC:', error);
      setError('Failed to open KYC verification');
      setLoading(false);
    }
  }, [url, handleDeepLink, checkKycStatusFromAPI]);

  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    openKycWithCompletion();
  }, [url, openKycWithCompletion]);

  const checkKycStatusFromAPI = useCallback(async () => {
    try {
      // Add your API call here to check KYC status
      // const response = await api.getKycStatus();
      // if (response.status === 'completed') {
      //   router.replace({
      //     pathname: path.CARD_ACTIVATE_MOBILE,
      //     params: {
      //       kycStatus: KycStatus.APPROVED,
      //     },
      //   });
      // }
      console.log('Checking KYC status from API...');
    } catch (error) {
      console.error('Error checking KYC status:', error);
    }
  }, []);

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
          <Text style={styles.loadingText}>Opening KYC verification...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>KYC verification opened in browser</Text>
        <Text style={styles.subText}>Complete the verification and return to the app</Text>
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
