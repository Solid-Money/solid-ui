import React from 'react';
import { View } from 'react-native';

import NeedHelp from '@/components/NeedHelp';
import ResponsiveModal from '@/components/ResponsiveModal';
import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import { getAsset } from '@/lib/assets';

import { WithdrawCardFundsModalProps } from './WithdrawCardFundsModal.types';
import { useDimension } from '@/hooks/useDimension';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useWithdrawCardToSafe } from '@/hooks/useWithdrawCardToSafe';
import { Alert } from 'react-native';
import { formatUSD } from '@/lib/utils';

export default function WithdrawCardFundsModal({
  isOpen: propsIsOpen,
  onOpenChange: propsOnOpenChange,
  trigger,
}: WithdrawCardFundsModalProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : internalIsOpen;
  const onOpenChange = propsOnOpenChange !== undefined ? propsOnOpenChange : setInternalIsOpen;

  const [showSuccess, setShowSuccess] = React.useState(false);

  // Reset success state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setShowSuccess(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const { isScreenMedium } = useDimension();
  const { data: cardDetails } = useCardDetails();
  const { withdraw, isPending: isWithdrawing } = useWithdrawCardToSafe();

  const availableBalance = cardDetails?.balances?.available?.amount || '0';

  const handleWithdrawPress = async () => {
    if (parseFloat(availableBalance) <= 0) {
      Alert.alert('No funds', 'You have no funds available to withdraw from your card.');
      return;
    }

    try {
      await withdraw(availableBalance, "I'm withdrawing from card to my wallet");
      setShowSuccess(true);
    } catch (error: any) {
      console.error('Withdrawal failed:', error);
    }
  };

  const handleTriggerPress = () => {
    onOpenChange(true);
  };

  return (
    <>
      {trigger && <SlotTrigger onPress={handleTriggerPress}>{trigger}</SlotTrigger>}
      <ResponsiveModal
        currentModal={{ name: 'card-upgrade', number: 1 }}
        previousModal={{ name: 'close', number: 0 }}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        trigger={null}
        title="Deposit to card"
        contentKey="card-upgrade"
      >
        <View className="items-center px-4">
          {showSuccess ? (
            <>
              {/* Success Icon/Image */}
              <View className="mb-4 mt-12 items-center justify-center">
                <Image
                  source={getAsset('images/withdraw_card_funds_with_shadow.png')}
                  style={{ width: 251, height: 197 }}
                  contentFit="cover"
                />
              </View>

              {/* Success Message */}
              <Text className="mb-4 text-center text-3xl font-semibold text-white">
                Withdraw request{'\n'}has been created!
              </Text>

              <Text
                className={`${isScreenMedium ? 'mb-32' : 'mb-48'} text-center text-base text-white/70`}
              >
                Withdrawing funds from your card to your safe address may take up to 10 mins.
              </Text>

              {/* Done Button */}
              <Button
                variant="brand"
                size="lg"
                onPress={() => onOpenChange(false)}
                className="w-full rounded-xl"
              >
                <Text className="text-base font-bold text-black">Done</Text>
              </Button>
            </>
          ) : (
            <>
              {/* Card Image */}
              <View className="mb-4 mt-12 items-center justify-center">
                <Image
                  source={getAsset('images/withdraw_card_funds_with_shadow.png')}
                  style={{ width: 251, height: 197 }}
                  contentFit="cover"
                />
              </View>

              {/* Upgrade Message */}
              <Text className="mb-4 text-center text-3xl font-semibold text-white">
                We're upgrading{'\n'}our card services!
              </Text>

              <Text
                className={`${isScreenMedium ? 'mb-32' : 'mb-48'} text-center text-base text-white/70`}
              >
                As part of a move to a new and improved vendor we are requiring all the card users
                to withdraw their funds from the card
              </Text>

              {/* Withdraw Button */}
              <Button
                variant="brand"
                size="lg"
                onPress={handleWithdrawPress}
                disabled={isWithdrawing || parseFloat(availableBalance) <= 0}
                className="w-full rounded-xl"
              >
                <Text className="text-base font-bold text-black">
                  {isWithdrawing
                    ? 'Withdrawing...'
                    : `Withdraw ${formatUSD(parseFloat(availableBalance))}`}
                </Text>
              </Button>
            </>
          )}

          {/* Need Help */}
          <View className="mt-6">
            <NeedHelp />
          </View>
        </View>
      </ResponsiveModal>
    </>
  );
}
