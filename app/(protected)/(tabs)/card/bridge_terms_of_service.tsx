import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TermsOfServiceStatus } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function BridgeTermsOfServiceIframe() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Handle iframe load events
  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load content. Please try again later.');
    setLoading(false);
  };

  // Setup message listener for TOS acceptance
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only handle messages from the TOS iframe origin
      // Replace with your actual TOS origin if needed, or remove this check
      if (url && new URL(url).origin !== event.origin) {
        return;
      }

      try {
        if (
          event?.data &&
          typeof event.data === 'object' &&
          event.data.signedAgreementId &&
          event.data.signedAgreementId.length > 0
        ) {
          router.replace({
            pathname: path.CARD_ACTIVATE,
            params: {
              tosStatus: TermsOfServiceStatus.APPROVED,
            },
          });
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [url, router]);

  // Safety check for URL
  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
    }
  }, [url]);

  return (
    <View style={styles.container}>
      {loading && <Text className="text-base" style={styles.loadingText}>Loading...</Text>}

      {error ? (
        <Text className="text-base" style={styles.errorText}>{error}</Text>
      ) : (
        <iframe
          src={url}
          style={styles.iframe}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    color: 'red',
    fontSize: 16,
  },
  iframe: {
    width: '100%',
    height: '100%',
  },
});
