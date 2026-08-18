import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import useOnramperClient from '@/hooks/useOnramperClient';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

import VirtualAccountApplyDialog from './VirtualAccountDetails/VirtualAccountApplyDialog';

const ICON_SIZE = 40;
const ICON_OVERLAP = 4;

const CASH_ICONS = [
  { key: 'us', source: getAsset('images/deposit-cash-us.png') },
  { key: 'usd', source: getAsset('images/deposit-cash-usd.png') },
];

const CRYPTO_ICONS = [
  { key: 'usdc', source: getAsset('images/deposit-crypto-usdc.png') },
  { key: 'usdt', source: getAsset('images/deposit-crypto-usdt.png') },
];

const CircleIcon = ({ source, index }: { source: ReturnType<typeof getAsset>; index: number }) => (
  <View
    className="items-center justify-center overflow-hidden rounded-full"
    style={[
      { width: ICON_SIZE, height: ICON_SIZE, zIndex: index === 0 ? 1 : 0 },
      index > 0 ? { marginLeft: -ICON_OVERLAP } : undefined,
    ]}
  >
    <Image source={source} style={{ width: ICON_SIZE, height: ICON_SIZE }} contentFit="cover" />
    {index > 0 && (
      <View
        pointerEvents="none"
        className="absolute inset-0 rounded-full border-[1.5px] border-card"
      />
    )}
  </View>
);

const DepositTypeSelection = () => {
  const setModal = useDepositStore(state => state.setModal);
  const [isVirtualAccountApplyOpen, setIsVirtualAccountApplyOpen] = useState(false);
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);
  const { client: onramperClient } = useOnramperClient();
  const [button, setButton] = React.useState<React.ReactNode | null>(null);
  const [, setQuote] = React.useState<any>(null);

  const handleCashPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'bank_transfer' });
    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    } else {
      setIsVirtualAccountApplyOpen(true);
    }
  };

  const handleCryptoPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'crypto' });
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  useEffect(() => {
    if (onramperClient) {
      onramperClient
        .getCheckoutRequirements({
          source: 'usd',
          destination: 'sol',
          amount: 100,
          type: 'buy',
          paymentMethod: 'applepay',
          wallet: { network: 'ethereum', address: '0x7FA96603d18f5708AFDC0d9E3C53ae4E0Cb877a4' },
        })
        .then(({ button, quote }) => {
          if (button) {
            setButton(button);
          }
          if (quote) {
            setQuote(quote);
          }
        });
    }
  }, [onramperClient]);

  return (
    <>
      <View className="gap-y-2.5">
        <Pressable
          className="rounded-2xl bg-card px-5 py-5 web:hover:bg-card-hover"
          onPress={handleCashPress}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="mb-3 flex-row items-center">
                {CASH_ICONS.map(({ key, source }, index) => (
                  <CircleIcon key={key} source={source} index={index} />
                ))}
              </View>
              <Text className="text-lg font-semibold text-primary">Cash</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">Bank transfers · No fees</Text>
            </View>
            <ChevronRight color="white" size={20} />
          </View>
        </Pressable>

        <Pressable
          className="rounded-2xl bg-card px-5 py-5 web:hover:bg-card-hover"
          onPress={handleCryptoPress}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="mb-3 flex-row items-center">
                {CRYPTO_ICONS.map(({ key, source }, index) => (
                  <CircleIcon key={key} source={source} index={index} />
                ))}
              </View>
              <Text className="text-lg font-semibold text-primary">Crypto</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">Linked wallets, DEXs</Text>
            </View>
            <ChevronRight color="white" size={20} />
          </View>
        </Pressable>
      </View>

      <View>{button}</View>

      <VirtualAccountApplyDialog
        isOpen={isVirtualAccountApplyOpen}
        onClose={() => setIsVirtualAccountApplyOpen(false)}
      />
    </>
  );
};

export default DepositTypeSelection;
