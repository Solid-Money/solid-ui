import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import SwipeableBanner from '@/components/Dashboard/SwipeableBanner';
import ReferralProgramModal from '@/components/Referral/ReferralProgramModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

/**
 * Refer & Earn banner shown to all users on the rewards and points screens.
 * Tapping opens the referral program popup ({@link ReferralProgramModal}).
 */
const ReferralProgramBanner = () => {
  const { isScreenMedium } = useDimension();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);

  return (
    <>
      <SwipeableBanner onPress={openModal}>
        <View className="flex-1 flex-row items-center justify-between bg-card pl-5 md:px-10">
          <View className="max-w-64 items-start justify-between gap-2 py-5 md:py-7">
            <Text className="text-lg font-medium leading-5 text-brand/70">Invite friends</Text>
            <Text className="text-3xl font-semibold">Refer & Earn</Text>
            <Text className="text-base font-semibold opacity-70">
              Earn $15 for you and $10 for friends for using the card
            </Text>
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-0 px-6"
              onPress={openModal}
            >
              <Text className="text-base font-bold text-primary">Refer friends</Text>
            </Button>
          </View>
          <View className="pointer-events-none -ml-6 md:ml-0">
            <Image
              source={getAsset('images/referral-3d.png')}
              contentFit="contain"
              style={{ width: isScreenMedium ? 160 : 110, height: isScreenMedium ? 160 : 110 }}
            />
          </View>
        </View>
      </SwipeableBanner>
      <ReferralProgramModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default ReferralProgramBanner;
