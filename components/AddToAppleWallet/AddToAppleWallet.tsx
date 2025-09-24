import * as Sentry from '@sentry/react-native';
import React, { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardDetails } from '@/hooks/useCardDetails';
import { track } from '@/lib/analytics';
import { addToAppleWallet, AddToWalletButton } from '@/lib/inAppPushProvisioning/apple';
import { AppleWalletConfig } from '@/lib/types/apple-wallet';

interface AddToAppleWalletProps {
  style?: any;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const AddToAppleWallet: React.FC<AddToAppleWalletProps> = ({
  style,
  onSuccess,
  onError,
}) => {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const { data: cardDetails } = useCardDetails();

  const handleAddToWallet = useCallback(async () => {
    if (!cardDetails) {
      const error = 'Card details not available';

      Sentry.captureMessage(error, {
        tags: {
          type: 'apple_wallet_error',
          component: 'AddToAppleWallet',
        },
      });

      onError?.(error);
      Toast.show({
        type: 'error',
        text1: 'Unable to add to Apple Wallet',
        text2: error,
      });
      return;
    }

    // Add breadcrumb for Apple Wallet flow start
    Sentry.addBreadcrumb({
      message: 'Apple Wallet provisioning started',
      category: 'apple_wallet',
      level: 'info',
      data: {
        customer_id: cardDetails.customer_id,
        card_account_id: cardDetails.id,
        last_4: cardDetails.card_details?.last_4,
      },
    });

    // Track button click
    track(TRACKING_EVENTS.ADD_TO_APPLE_PAY_CLICK, {
      customer_id: cardDetails.customer_id,
      card_account_id: cardDetails.id,
    });

    setIsProvisioning(true);

    const cardHolder = cardDetails.cardholder_name;
    const cardHolderName = `${cardHolder.first_name} ${cardHolder.last_name}`;

    try {
      const config: AppleWalletConfig = {
        network: 'VISA',
        lastDigits: cardDetails.card_details?.last_4 || '****',
        cardHolderName,
        cardDescription: 'Solid Card',
      };

      const result = await addToAppleWallet(config, track);

      if (result.success) {
        Sentry.addBreadcrumb({
          message: 'Apple Wallet provisioning completed successfully',
          category: 'apple_wallet',
          level: 'info',
          data: {
            customer_id: cardDetails.customer_id,
            card_account_id: cardDetails.id,
            last_4: cardDetails.card_details?.last_4,
          },
        });

        onSuccess?.();
        Toast.show({
          type: 'success',
          text1: 'Added to Apple Wallet',
          text2: 'Your card is now available in Apple Wallet',
        });
      } else {
        throw new Error(result.error || 'Failed to add card to Apple Wallet');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      Sentry.captureException(error, {
        tags: {
          type: 'apple_wallet_provisioning_error',
          customer_id: cardDetails.customer_id,
        },
        extra: {
          card_account_id: cardDetails.id,
          last_4: cardDetails.card_details?.last_4,
          cardholder_name: cardHolderName,
          error_message: errorMessage,
        },
        user: {
          id: cardDetails.customer_id,
        },
      });

      onError?.(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Failed to add to Apple Wallet',
        text2: errorMessage,
      });
    } finally {
      setIsProvisioning(false);
    }
  }, [cardDetails, onSuccess, onError]);

  // Don't render on non-iOS platforms
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Don't render if customer or card details are not available
  if (!cardDetails) {
    return null;
  }

  return (
    <View style={style}>
      <AddToWalletButton
        onPress={isProvisioning ? undefined : handleAddToWallet}
        style={{
          height: 50,
          opacity: isProvisioning ? 0.6 : 1,
        }}
      />
      {isProvisioning && (
        <Text className="text-center text-gray-500 mt-2">Adding to Apple Wallet...</Text>
      )}
    </View>
  );
};

export default AddToAppleWallet;
