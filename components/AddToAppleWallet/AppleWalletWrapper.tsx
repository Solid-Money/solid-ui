import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useCardDetails } from '@/hooks/useCardDetails';
import { checkCanAddToAppleWallet } from '@/lib/inAppPushProvisioning/apple';
import { CardStatus } from '@/lib/types';
import { AppleWalletCardStatus, AppleWalletConfig } from '@/lib/types/apple-wallet';
import { AddToAppleWallet } from './AddToAppleWallet';

interface AppleWalletWrapperProps {
  style?: any;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const AppleWalletWrapper: React.FC<AppleWalletWrapperProps> = ({
  style,
  onSuccess,
  onError,
}) => {
  const { data: cardDetails } = useCardDetails();
  const [appleWalletStatus, setAppleWalletStatus] = useState<AppleWalletCardStatus>(
    AppleWalletCardStatus.UNKNOWN,
  );
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const isCardActive = cardDetails?.status === CardStatus.ACTIVE;

  // Check Apple Wallet status when card details are available
  useEffect(() => {
    const checkAppleWalletStatus = async () => {
      if (!cardDetails || Platform.OS !== 'ios' || !isCardActive) {
        setIsCheckingStatus(false);
        return;
      }

      setIsCheckingStatus(true);
      try {
        const config: AppleWalletConfig = {
          network: 'VISA', // Default to VISA as network info not available in CardResponse
          lastDigits: cardDetails.card_details?.last_4 || '****',
          cardHolderName: 'Card Holder', // Cardholder name not available in CardResponse
          cardDescription: 'Solid Card',
        };

        const status = await checkCanAddToAppleWallet(config);
        setAppleWalletStatus(status);
      } catch (error) {
        console.error('Error checking Apple Wallet status:', error);
        setAppleWalletStatus(AppleWalletCardStatus.UNKNOWN);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkAppleWalletStatus();
  }, [cardDetails, isCardActive]);

  const handleSuccess = () => {
    setAppleWalletStatus(AppleWalletCardStatus.ADDED);
    onSuccess?.();
  };

  // Don't render on non-iOS platforms
  if (Platform.OS !== 'ios') {
    return null;
  }

  // Don't render if card is not active
  if (!isCardActive) {
    return null;
  }

  // Show loading state while checking card status
  if (isCheckingStatus) {
    return (
      <View style={style}>
        <Text className="text-center text-gray-500">Checking Apple Wallet status...</Text>
      </View>
    );
  }

  // Show already added status
  if (appleWalletStatus === AppleWalletCardStatus.ADDED) {
    return (
      <View style={style}>
        <Text className="text-center text-green-600">✓ Added to Apple Wallet</Text>
      </View>
    );
  }

  // Show add button if card can be added
  if (appleWalletStatus === AppleWalletCardStatus.NOT_ADDED) {
    return <AddToAppleWallet style={style} onSuccess={handleSuccess} onError={onError} />;
  }

  // Don't show anything if status is unknown
  return null;
};

export default AppleWalletWrapper;
