import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { RainApplicationStatus } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';

const ICON_SIZE = 36;
const ICON_OVERLAP = 10;

const CASH_FLAG_ICONS = [
  { key: 'us', source: getAsset('images/us.png') },
  { key: 'eu', source: getAsset('images/eu.png') },
];

const CRYPTO_CHAIN_ICONS = [
  { key: 'eth', source: getAsset('images/eth.png') },
  { key: 'fuse', source: getAsset('images/fuse.png') },
  { key: 'base', source: getAsset('images/base.png') },
  { key: 'arbitrum', source: getAsset('images/arbitrum.png') },
  { key: 'bsc', source: getAsset('images/bsc.png') },
];

const CircleIcon = ({
  source,
  index,
}: {
  source: ReturnType<typeof getAsset>;
  index: number;
}) => (
  <View
    className="items-center justify-center overflow-hidden rounded-full border-[1.5px] border-card bg-card"
    style={[
      { width: ICON_SIZE, height: ICON_SIZE },
      index > 0 ? { marginLeft: -ICON_OVERLAP } : undefined,
    ]}
  >
    <Image
      source={source}
      style={{ width: ICON_SIZE, height: ICON_SIZE }}
      contentFit="cover"
    />
  </View>
);

const DepositTypeSelection = () => {
  const setModal = useDepositStore(state => state.setModal);
  const { data: cardStatus } = useCardStatus();
  const isRainApproved = cardStatus?.rainApplicationStatus === RainApplicationStatus.APPROVED;
  const { data: existingAutomation } = useOnrampAutomation(isRainApproved);

  const handleCashPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'bank_transfer' });
    if (existingAutomation) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_DETAILS);
    } else {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_APPLY);
    }
  };

  const handleCryptoPress = () => {
    track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, { deposit_method: 'crypto' });
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  return (
    <View className="gap-y-2.5">
      <Pressable
        className="rounded-2xl bg-card px-5 py-5 web:hover:bg-card-hover"
        onPress={handleCashPress}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="mb-3 flex-row items-center">
              {CASH_FLAG_ICONS.map(({ key, source }, index) => (
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
              {CRYPTO_CHAIN_ICONS.map(({ key, source }, index) => (
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
  );
};

export default DepositTypeSelection;
