import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Crypto from 'expo-crypto';

import ExchangeDisclaimer from '@/components/Compliance/ExchangeDisclaimer';
import GeoRestrictionNotice from '@/components/Compliance/GeoRestrictionNotice';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useGeoCompliance from '@/hooks/useGeoCompliance';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { createMercuryoTransaction, getClientIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useComplianceStore } from '@/store/useComplianceStore';

const BuyCrypto = () => {
  const { isBuyCryptoAvailable } = useGeoCompliance();
  const hasAcceptedBuyCryptoDisclaimer = useComplianceStore(state =>
    state.hasAcceptedDisclaimer('buyCrypto'),
  );
  const acceptDisclaimer = useComplianceStore(state => state.acceptDisclaimer);

  const handleAcceptBuyCryptoDisclaimer = useCallback(() => {
    acceptDisclaimer('buyCrypto');
  }, [acceptDisclaimer]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string>('');
  const loadStartTime = useRef<number | null>(null);
  const transactionId = useRef<string | null>(null);

  const { user } = useUser();

  // Track widget loading on mount
  useEffect(() => {
    loadStartTime.current = Date.now();
    track(TRACKING_EVENTS.DEPOSIT_CARD_WIDGET_LOADING, {
      deposit_method: 'credit_card',
    });
  }, []);

  // Handle iframe load events
  const handleIframeLoad = () => {
    const loadTime = loadStartTime.current ? Date.now() - loadStartTime.current : null;

    track(TRACKING_EVENTS.DEPOSIT_CARD_WIDGET_LOADED, {
      deposit_method: 'credit_card',
      transaction_id: transactionId.current,
      widget_load_time: loadTime ? Math.floor(loadTime / 1000) : undefined,
    });

    setLoading(false);
  };

  const handleIframeError = () => {
    track(TRACKING_EVENTS.DEPOSIT_CARD_WIDGET_LOAD_FAILED, {
      deposit_method: 'credit_card',
      transaction_id: transactionId.current,
      error: 'Failed to load Mercuryo widget',
    });

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

        if (!userIp) throw new Error('Could not get user IP address');

        const txId = Crypto.randomUUID();
        transactionId.current = txId;

        const widgetUrl = await withRefreshToken(() => createMercuryoTransaction(userIp, txId));

        if (!widgetUrl) {
          throw new Error('Failed to create Mercuryo transaction');
        }

        track(TRACKING_EVENTS.DEPOSIT_CARD_TRANSACTION_CREATED, {
          deposit_method: 'credit_card',
          transaction_id: txId,
        });

        setFinalUrl(widgetUrl);
      } catch (err) {
        console.error('Error creating Mercuryo transaction:', err);

        track(TRACKING_EVENTS.DEPOSIT_CARD_TRANSACTION_CREATION_FAILED, {
          deposit_method: 'credit_card',
          error: err instanceof Error ? err.message : String(err),
          error_type: err instanceof Error ? err.name : 'Unknown',
        });

        setError('Failed to initialize widget');
        setLoading(false);
      }
    };

    buildUrl();
  }, [user]);

  if (!isBuyCryptoAvailable) return <GeoRestrictionNotice feature="buyCrypto" />;

  if (!hasAcceptedBuyCryptoDisclaimer) {
    return <ExchangeDisclaimer feature="buyCrypto" onAccept={handleAcceptBuyCryptoDisclaimer} />;
  }

  return (
    <View className="flex-1 overflow-y-auto md:max-h-[65vh] lg:max-h-[70vh] 2xl:max-h-[75vh]">
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      {error ? (
        <View className="flex-1 items-center justify-center">
          <Text className="mt-5 text-center text-base text-red-500">{error}</Text>
        </View>
      ) : finalUrl ? (
        <iframe
          src={finalUrl}
          className="min-h-[100vh] w-full"
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
