import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { useTierBenefits } from '@/hooks/useRewards';
import { useRewards } from '@/store/useRewardsStore';

import RewardBenefit from './RewardBenefit';

const MODAL_STATE: ModalState = { name: 'tier-benefits', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Global tier modal provider that renders a single ResponsiveModal instance.
 * This prevents multiple overlays from stacking when multiple TierModal
 * components are mounted across different screens.
 *
 * Add this component once at the app root level.
 * Use setSelectedTierModalId() from useRewards to open the modal.
 */
const TierModalProvider = () => {
  const { selectedTierModalId, setSelectedTierModalId } = useRewards();
  const { data: tierBenefitsData } = useTierBenefits();

  const isOpen = selectedTierModalId !== null;
  const tierBenefits = selectedTierModalId && tierBenefitsData 
    ? tierBenefitsData.find(tier => tier.tier === selectedTierModalId)
    : null;

  const benefits = useMemo(() => {
    if (!tierBenefits) return [];

    return [
      {
        icon: 'images/dollar-yellow.png',
        title: tierBenefits.depositBoost.title,
        description: tierBenefits.depositBoost.subtitle || 'On your savings',
        iconSize: 48,
      },
      {
        icon: 'images/two-percent-yellow.png',
        title: tierBenefits.cardCashback.title,
        description: tierBenefits.cardCashbackCap.title,
        iconSize: 48,
      },
      {
        icon: 'images/rocket-yellow.png',
        title: 'Free virtual card',
        description: '200M+ Visa merchants',
        iconSize: 48,
      },
    ];
  }, [tierBenefits]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedTierModalId(null);
    }
  };

  return (
    <ResponsiveModal
      currentModal={isOpen ? MODAL_STATE : CLOSE_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      trigger={null}
      title="Your Tier"
      contentKey="tier-benefits"
      contentClassName="md:max-w-xl"
    >
      <View className="gap-6">
        {selectedTierModalId && (
          <View className="items-center gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-4.5xl font-semibold text-rewards">
                {getTierDisplayName(selectedTierModalId)}
              </Text>
              <Image
                source={getTierIcon(selectedTierModalId)}
                contentFit="contain"
                style={{ width: 24, height: 24 }}
              />
            </View>
          </View>
        )}

        <View className="gap-6">
          <Text className="text-lg font-medium opacity-70">Your benefits</Text>
          <View className="flex-row flex-wrap justify-between gap-6 md:pr-10">
            {benefits.map((benefit, index) => (
              <RewardBenefit
                key={index}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.description}
                iconSize={benefit.iconSize}
              />
            ))}
          </View>
        </View>

        <Button
          variant="secondary"
          className="mt-auto h-12 rounded-xl border-0 bg-card web:hover:bg-card-hover md:mt-20"
          onPress={() => {
            setSelectedTierModalId(null);
            router.push(path.REWARDS_BENEFITS);
          }}
        >
          <Text className="text-base font-semibold text-rewards">View all benefits</Text>
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default TierModalProvider;
