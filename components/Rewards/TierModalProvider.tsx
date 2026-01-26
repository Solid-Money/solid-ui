import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useTierTable } from '@/hooks/useRewards';
import { useTierTableData } from '@/hooks/useTierTableData';
import { getAsset } from '@/lib/assets';
import { TierTableCategory } from '@/lib/types';
import { toTitleCase } from '@/lib/utils';
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
  const { data: tierTable } = useTierTable(TierTableCategory.COMPARE);
  const { getTierBenefits, getTierInfo } = useTierTableData(tierTable);

  const isOpen = selectedTierModalId !== null;

  const benefits = useMemo(() => {
    if (!selectedTierModalId) return [];
    return getTierBenefits(selectedTierModalId, 3);
  }, [getTierBenefits, selectedTierModalId]);

  const selectedTierInfo = useMemo(() => {
    if (!selectedTierModalId) return null;
    return getTierInfo(selectedTierModalId);
  }, [getTierInfo, selectedTierModalId]);

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
                {selectedTierInfo?.title || toTitleCase(selectedTierModalId)}
              </Text>
              {selectedTierInfo?.image && (
                <Image
                  source={getAsset(selectedTierInfo.image as keyof typeof getAsset)}
                  contentFit="contain"
                  style={{ width: 24, height: 24 }}
                />
              )}
            </View>
          </View>
        )}

        <View className="gap-6">
          <Text className="text-lg font-medium opacity-70">Your benefits</Text>
          <View className="flex-row flex-wrap justify-between gap-6 md:pr-10">
            {benefits.map((benefit, index) => (
              <RewardBenefit
                key={index}
                icon={benefit.image}
                title={benefit.title}
                description={benefit.description}
                iconSize={48}
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
