import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { formatTierCashbackRate } from '@/lib/tierCashback';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import SubscriptionBrandBadge from './SubscriptionBrandBadge';
import { SUBSCRIPTION_CATEGORIES } from './subscriptionBrands';
import { BOTTOM_RIGHT_WASH } from './tierGradients';

const TIER_PROMISE: Record<
  RewardsTier.PRIME | RewardsTier.ULTRA,
  { yieldBoost: string; aiCashback: string }
> = {
  [RewardsTier.PRIME]: { yieldBoost: '+2%', aiCashback: '25%' },
  [RewardsTier.ULTRA]: { yieldBoost: '+3%', aiCashback: '50%' },
};

const AI_BRANDS = SUBSCRIPTION_CATEGORIES.find(category => category.key === 'ai')!.brands;

interface JoinTierClubCardProps {
  tier: RewardsTier.PRIME | RewardsTier.ULTRA;
  onPress: () => void;
}

/** The compact membership teaser from Figma node 26080:20859. */
const JoinTierClubCard = ({ tier, onPress }: JoinTierClubCardProps) => {
  const tierName = getTierDisplayName(tier);
  const promise = TIER_PROMISE[tier];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Join ${tierName} Club`}
      onPress={onPress}
      className="min-h-[188px] overflow-hidden rounded-[23px] bg-[#1C1C1C] active:opacity-80"
    >
      <LinearGradient
        colors={['#3E3E3E', '#242424', '#1C1C1C']}
        locations={[0, 0.42, 1]}
        {...BOTTOM_RIGHT_WASH}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <View className="px-[21px] pb-[20px] pt-[17px]">
        <View className="flex-row items-center justify-between">
          <Text className="text-[18px] font-bold leading-[22px] text-white">
            Join {tierName} Club
          </Text>
          <ChevronRight color="rgba(255,255,255,0.8)" size={20} strokeWidth={2} />
        </View>
        <Text className="mt-[6px] text-[14px] leading-[18px] text-white/70">
          Unlock extra cashback and benefits
        </Text>

        <View className="mt-[21px] flex-row flex-wrap gap-[10px]">
          <View className="h-[37px] justify-center rounded-full bg-white/10 px-[14px]">
            <Text className="text-[16px] leading-[20px] text-white/70">
              {formatTierCashbackRate(tier)} Cashback
            </Text>
          </View>
          <View className="h-[37px] justify-center rounded-full bg-white/10 px-[14px]">
            <Text className="text-[16px] leading-[20px] text-white/70">
              {promise.yieldBoost} Yield boost
            </Text>
          </View>
        </View>

        <View className="mt-[10px] h-[37px] flex-row items-center self-start rounded-full bg-white/10 pl-[15px] pr-[14px]">
          <View className="mr-[8px] flex-row items-center">
            {AI_BRANDS.map((brand, index) => (
              <SubscriptionBrandBadge
                key={brand.name}
                brand={brand}
                size={22}
                overlap={index === 0 ? undefined : -3}
                ring={index > 0}
              />
            ))}
          </View>
          <Text className="text-[16px] leading-[20px] text-white/70">
            {promise.aiCashback} Cashback on AI
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export default JoinTierClubCard;
