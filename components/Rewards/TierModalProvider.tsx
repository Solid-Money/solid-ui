import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { useRewardsUserData, useTierBenefits } from '@/hooks/useRewards';
import { TierBenefits } from '@/lib/types';
import { useRewards } from '@/store/useRewardsStore';

import RewardBenefit from './RewardBenefit';

const MODAL_STATE: ModalState = { name: 'tier-benefits', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

// Extended type to support both icon images and text-based icons
interface ModalBenefitItem {
  icon?: string;
  iconText?: string;
  title: string;
  description: string;
}

/**
 * Transform tier benefits from API format to display format
 */
const transformTierBenefitsToItems = (
  tierBenefits: TierBenefits | undefined,
): ModalBenefitItem[] => {
  if (!tierBenefits) {
    return [];
  }

  const items: ModalBenefitItem[] = [];

  // APY benefit - use depositBoost title from API
  items.push({
    icon: 'images/dollar-yellow.png',
    title: tierBenefits.depositBoost.title,
    description: 'On your savings',
  });

  // Cashback benefit - use dynamic percentage as icon text
  const cashbackPercent = tierBenefits.cardCashback.title; // e.g., "2%" or "3%"

  items.push({
    iconText: cashbackPercent,
    title: `${cashbackPercent} Cashback`,
    description: 'for every purchase',
  });

  // Virtual card benefit
  items.push({
    icon: 'images/rocket-yellow.png',
    title: 'Free virtual card',
    description: '200M+ Visa merchants',
  });

  return items;
};

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
  const { data: rewardsData } = useRewardsUserData();
  const { data: allTierBenefits, isLoading: isLoadingBenefits } = useTierBenefits();

  const isOpen = selectedTierModalId !== null;
  const currentTier = rewardsData?.currentTier;
  const modalTitle =
    selectedTierModalId && currentTier && selectedTierModalId === currentTier
      ? 'Your Tier'
      : 'Next Tier';

  // Find the selected tier's benefits from the API data
  const selectedTierBenefits = allTierBenefits?.find(tb => tb.tier === selectedTierModalId);

  // Transform API data to display format
  const tierBenefitItems = transformTierBenefitsToItems(selectedTierBenefits);

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
      title={modalTitle}
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
          {isLoadingBenefits ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator />
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-6 md:pr-10">
              {tierBenefitItems.map((benefit, index) => (
                <RewardBenefit
                  key={index}
                  icon={benefit.icon}
                  iconText={benefit.iconText}
                  title={benefit.title}
                  description={benefit.description}
                  iconSize={48}
                />
              ))}
            </View>
          )}
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
