import { View } from 'react-native';

import { useTierTable } from '@/hooks/useRewards';
import { useTierTableData } from '@/hooks/useTierTableData';
import { getAsset } from '@/lib/assets';
import { TierTableCategory } from '@/lib/types';
import { toTitleCase } from '@/lib/utils';

import TierBenefitsCard from './TierBenefitsCard';

interface TierBenefitsCardsProps {
  currentTier: string;
  nextTier: string | null;
  onCurrentTierPress: () => void;
  onNextTierPress: () => void;
}

const TierBenefitsCards = ({
  currentTier,
  nextTier,
  onCurrentTierPress,
  onNextTierPress,
}: TierBenefitsCardsProps) => {
  const { data: tierTable } = useTierTable(TierTableCategory.COMPARE);
  const { getTierInfo } = useTierTableData(tierTable);

  const currentTierInfo = getTierInfo(currentTier);
  const nextTierInfo = nextTier ? getTierInfo(nextTier) : null;

  return (
    <View className="gap-6 md:flex-row md:gap-10">
      <TierBenefitsCard
        label={`Your ${currentTierInfo?.title || toTitleCase(currentTier)} tier benefits`}
        onPress={onCurrentTierPress}
        icon={
          currentTierInfo?.image
            ? getAsset(currentTierInfo.image as keyof typeof getAsset)
            : undefined
        }
      />

      {nextTier && (
        <TierBenefitsCard
          label={`Next tier: ${nextTierInfo?.title || toTitleCase(nextTier)}`}
          onPress={onNextTierPress}
          icon={
            nextTierInfo?.image ? getAsset(nextTierInfo.image as keyof typeof getAsset) : undefined
          }
        />
      )}
    </View>
  );
};

export default TierBenefitsCards;
