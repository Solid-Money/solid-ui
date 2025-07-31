import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { createMercuryoTransaction, getClientIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

const BuyCrypto = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>('');

  const { user } = useUser();

  // Handle iframe load events
  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load Mercuryo widget. Please try again later.');
    setLoading(false);
  };

  // Create Mercuryo transaction and get widget URL
  useEffect(() => {
    const buildUrl = async () => {
      // Reset error when user data changes
      setError(null);

      // If user object doesn't exist yet, keep loading
      if (!user) {
        return;
      }

      try {
        const userIp = await getClientIp();
        const transactionId = Crypto.randomUUID();

        const widgetUrl = await withRefreshToken(() =>
          createMercuryoTransaction(userIp, transactionId),
        );

        if (!widgetUrl) {
          throw new Error('Failed to create Mercuryo transaction');
        }

        setFinalUrl(widgetUrl);
      } catch (err) {
        console.error('Error creating Mercuryo transaction:', err);
        setError('Failed to initialize widget');
        setLoading(false);
      }
    };

    buildUrl();
  }, [user]);

  return (
    <View className="flex-1 md:max-h-[65vh] lg:max-h-[70vh] 2xl:max-h-[75vh] overflow-y-auto">
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-center mt-5 text-red-500 text-base">{error}</Text>
        </View>
      ) : finalUrl ? (
        <iframe
          src={finalUrl}
          className="w-full min-h-[100vh]"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="camera; microphone; geolocation; payment"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
        />
      ) : null}
    </View>
  );
};

// Add type declaration
declare global {
  interface Window {
    mercuryoWidget: any;
  }
}

export default BuyCrypto;
