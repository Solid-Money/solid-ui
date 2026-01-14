import { View } from 'react-native';

import { getTierDisplayName, getTierIcon } from '@/constants/rewards';
import { RewardsTier } from '@/lib/types';
import TierBenefitsCard from './TierBenefitsCard';

interface TierBenefitsCardsProps {
  currentTier: RewardsTier;
  nextTier: RewardsTier | null;
  onCurrentTierPress: () => void;
  onNextTierPress: () => void;
}

const TierBenefitsCards = ({
  currentTier,
  nextTier,
  onCurrentTierPress,
  onNextTierPress,
}: TierBenefitsCardsProps) => {
  return (
    <View className="gap-6 md:flex-row md:gap-10">
      <TierBenefitsCard
        label={`Your ${getTierDisplayName(currentTier)} tier benefits`}
        onPress={onCurrentTierPress}
        icon={getTierIcon(currentTier)}
      />

      {nextTier && (
        <TierBenefitsCard
          label={`Next tier: ${getTierDisplayName(nextTier)}`}
          onPress={onNextTierPress}
          icon={getTierIcon(nextTier)}
        />
      )}
    </View>
  );
};

export default TierBenefitsCards;
