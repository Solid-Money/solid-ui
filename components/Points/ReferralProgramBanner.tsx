import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import SwipeableBanner from '@/components/Dashboard/SwipeableBanner';
import ReferralProgramModal from '@/components/Referral/ReferralProgramModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { useReferralSummary } from '@/hooks/useRewards';
import { getAsset } from '@/lib/assets';

/** Whole-dollar formatting for the program copy, e.g. "$15". */
const formatUsdWhole = (value: number) => `$${Math.round(value || 0).toLocaleString('en-US')}`;

/**
 * Referral program banner, shown to all users. Tapping (the banner or the
 * "Refer friends" button) opens the referral program popup.
 *
 * The amounts come from the referral summary (admin-managed on the rewards
 * config dashboard) so the banner never advertises a stale offer. The same
 * query backs the popup this opens, so it is served from cache there.
 */
const ReferralProgramBanner = () => {
  const { isScreenMedium } = useDimension();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: summary } = useReferralSummary();

  // Fallbacks mirror the backend's shipped defaults.
  const referrerUsd = summary?.rewards.referrerUsd ?? 15;
  const newUserUsd = summary?.rewards.newUserUsd ?? 15;

  const openModal = () => setIsModalOpen(true);

  return (
    <>
      <SwipeableBanner onPress={openModal}>
        <View className="flex-1 flex-row items-center justify-between bg-card pl-5 md:px-10">
          <View className="max-w-64 items-start justify-between gap-2 py-5 md:py-7">
            <Text className="text-lg font-medium leading-5 text-brand/70">Invite friends</Text>
            <Text className="text-3xl font-semibold">Refer & Earn</Text>
            <Text className="text-base font-semibold opacity-70">
              Earn {formatUsdWhole(referrerUsd)} for you and {formatUsdWhole(newUserUsd)} for
              friends for using the card
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
