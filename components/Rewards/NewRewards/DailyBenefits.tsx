import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { TIER_BENEFITS } from '@/constants/rewards';
import { type AssetPath, getAsset } from '@/lib/assets';
import { RewardsTier, TierBenefitItem } from '@/lib/types';

const BenefitCard = ({ benefit }: { benefit: TierBenefitItem }) => (
  <View className="flex-1 items-center gap-2 rounded-twice bg-card p-4">
    {/* The benefit images already include their own (yellow) background + padding. */}
    <Image
      source={getAsset(benefit.icon as AssetPath)}
      style={{ width: 48, height: 48 }}
      contentFit="contain"
    />
    <Text className="text-center text-sm font-bold text-white" numberOfLines={2}>
      {benefit.title}
    </Text>
    <Text className="text-center text-xs leading-tight text-muted-foreground" numberOfLines={2}>
      {benefit.description}
    </Text>
  </View>
);

interface DailyBenefitsProps {
  tier: RewardsTier;
}

/**
 * "Your daily benefits" — the three benefits of the user's CURRENT tier only
 * (per-tier config in constants/rewards.ts). Full tier comparison lives on the
 * rewards benefits screen (reached via the "Explore tiers" button).
 */
const DailyBenefits = ({ tier }: DailyBenefitsProps) => {
  const benefits = TIER_BENEFITS[tier] ?? [];

  return (
    <View className="gap-3 px-4">
      <Text className="text-lg font-semibold text-muted-foreground">Your daily benefits</Text>
      <View className="flex-row gap-3">
        {benefits.map((benefit, index) => (
          <BenefitCard key={`${benefit.title}-${index}`} benefit={benefit} />
        ))}
      </View>
    </View>
  );
};

export default DailyBenefits;
