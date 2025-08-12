import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export type KycParams = {
  onSuccess?: () => void;
};

export default function Kyc({ onSuccess }: KycParams = {}) {
  const router = useRouter();
  const { url, returnTo } = useLocalSearchParams<{ url: string; returnTo?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>('');

  // Handle iframe load events
  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load content. Please try again later.');
    setLoading(false);
  };

  // Setup message listener for KYC completion
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log('Message received:', event.data);

      try {
        // Check for completion events
        if (
          typeof event.data === 'object' &&
          (event.data.status === 'completed' || event.data.event === 'verification.complete')
        ) {
          // If a returnTo is provided, resume the calling flow (e.g., bank-transfer)
          // by replacing the current route. Accepts either a string path or a
          // serialized object with pathname/params.
          if (returnTo) {
            try {
              if (returnTo.startsWith('{')) {
                const returnToAsJson = JSON.parse(returnTo) as {
                  pathname: string;
                  params?: Record<string, string>;
                };

                router.replace({
                  pathname: returnToAsJson.pathname as any,
                  params: returnToAsJson.params,
                });
              } else {
                router.replace(returnTo as any);
              }
            } catch (_) {
              router.replace('/');
            }
          } else {
            onSuccess?.();
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, returnTo, router]);

  // Process the URL to add required parameters
  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    try {
      const urlObj = new URL(url);

      // If URL is from Persona and contains /verify, replace with /widget
      if (urlObj.hostname.includes('withpersona.com') && urlObj.pathname.includes('/verify')) {
        urlObj.pathname = urlObj.pathname.replace('/verify', '/widget');
      }

      // Add iframe-origin parameter for postMessage security and routing
      urlObj.searchParams.set('iframe-origin', window.location.origin);

      setFinalUrl(urlObj.toString());
    } catch (_e) {
      setError('Invalid URL format');
      setLoading(false);
    }
  }, [url]);

  return (
    <View style={styles.container}>
      {loading && <Text style={styles.loadingText}>Loading...</Text>}

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : finalUrl ? (
        <iframe
          src={finalUrl}
          style={styles.iframe}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
        />
      ) : null}
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
