import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import {
  CashbackIcon,
  IconBadge,
  SubscriptionIcon,
  YieldBoostIcon,
} from '@/components/Rewards/NewRewards/tierBenefitIcons';
import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import type { TierUpgradeBenefit } from './tierUpgradeBenefits';

/** The per-tier card texture. Already in the asset registry, unused until now. */
const TIER_TEXTURE: Record<RewardsTier, AssetPath> = {
  [RewardsTier.CORE]: 'images/rewards-tiers/core-summary.png',
  [RewardsTier.PRIME]: 'images/rewards-tiers/prime-summary.png',
  [RewardsTier.ULTRA]: 'images/rewards-tiers/ultra-summary.png',
};

/** The benefit glyphs, at the 33px the tier card draws them. */
const BENEFIT_ICON_SIZE = 33;

interface UpgradeTierHeroCardProps {
  tier: RewardsTier;
  benefits: TierUpgradeBenefit[];
  /** The pill in the top-right, e.g. "Renews on 10 Sep, 2027". Hidden when absent. */
  statusLabel?: string;
}

/**
 * The tier being bought, and what it gets you.
 *
 * The texture behind it is the tier's own, from the asset registry rather than
 * a gradient written here — Prime's silver sheen and Ultra's darker one are
 * design assets, and reproducing them in code is how they stop matching the
 * rest of the rewards screens.
 */
const UpgradeTierHeroCard = ({ tier, benefits, statusLabel }: UpgradeTierHeroCardProps) => (
  <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
    <Image
      source={getAsset(TIER_TEXTURE[tier])}
      contentFit="cover"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    <View className="p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-2">
          <TierStar tier={tier} size={28} />
          <Text className="text-[28px] font-medium leading-8 text-white">
            {getTierDisplayName(tier)}
          </Text>
        </View>

        {statusLabel ? (
          <View className="rounded-full bg-white/10 px-3 py-2">
            <Text className="text-[13px] leading-4 text-white/70">{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-1 text-[16px] leading-5 text-white/50">Membership</Text>

      <View className="mt-6 gap-3">
        {benefits.map(benefit => (
          <View key={benefit.key} className="flex-row items-center gap-3">
            <BenefitIcon benefitKey={benefit.key} />
            <Text className="flex-1 text-[16px] font-medium leading-5 text-white">
              {benefit.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  </View>
);

/**
 * The glyph for one benefit line.
 *
 * The cashback cap has no mark of its own in the icon set, so it borrows the
 * subscription badge's shape with a "$" in it — the design draws it as a
 * currency mark in the same circle, and a made-up SVG would be one more thing
 * to keep in step with the rest.
 */
const BenefitIcon = ({ benefitKey }: { benefitKey: TierUpgradeBenefit['key'] }) => {
  switch (benefitKey) {
    case 'cashback':
      return <CashbackIcon size={BENEFIT_ICON_SIZE} />;
    case 'yield-boost':
      return <YieldBoostIcon size={BENEFIT_ICON_SIZE} />;
    case 'subscription':
      return <SubscriptionIcon rate="%" size={BENEFIT_ICON_SIZE} />;
    case 'cashback-cap':
      return (
        <IconBadge size={BENEFIT_ICON_SIZE}>
          <Text className="text-[13px] font-medium text-white">$</Text>
        </IconBadge>
      );
  }
};

export default UpgradeTierHeroCard;
