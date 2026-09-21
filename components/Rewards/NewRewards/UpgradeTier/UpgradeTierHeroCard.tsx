import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import {
  CashbackIcon,
  IconBadge,
  SubscriptionIcon,
  YieldBoostIcon,
} from '@/components/Rewards/NewRewards/tierBenefitIcons';
import { TOP_RIGHT_WASH } from '@/components/Rewards/NewRewards/tierGradients';
import { Text } from '@/components/ui/text';
import { getTierIcon } from '@/constants/rewards';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import type { TierUpgradeBenefit } from './tierUpgradeBenefits';

/**
 * The card's backdrop, per tier.
 *
 * Was `rewards-tiers/*-summary.png`, which is the wrong asset: those are the
 * finished marketing cards, with "+2% Yield boost" and the rest set into the
 * artwork. Behind this card's own benefit list they showed as a second, larger
 * copy of the same words, half-covered.
 *
 * The design asks for a plain grey gradient, so it is a gradient — two stops,
 * grey at the top-right corner falling to near-black at the bottom-left, which
 * is the direction every v3 wash runs (see `tierGradients`). It lifts slightly
 * for the higher tiers so Prime and Ultra still read as distinct without
 * spelling anything out.
 */
const TIER_BACKDROP: Record<RewardsTier, readonly [string, string]> = {
  [RewardsTier.CORE]: ['#3A3A3A', '#141414'],
  [RewardsTier.PRIME]: ['#454545', '#151515'],
  [RewardsTier.ULTRA]: ['#505050', '#161616'],
};

/** The benefit glyphs, at the 33px the tier card draws them. */
const BENEFIT_ICON_SIZE = 33;

/** The tier mark, at the size the heading beside it is set in. */
const TIER_ICON_SIZE = 28;

interface UpgradeTierHeroCardProps {
  tier: RewardsTier;
  benefits: TierUpgradeBenefit[];
  /** The pill in the top-right, e.g. "Renews on 10 Sep, 2027". Hidden when absent. */
  statusLabel?: string;
}

/** The tier being bought, and what it gets you. */
const UpgradeTierHeroCard = ({ tier, benefits, statusLabel }: UpgradeTierHeroCardProps) => (
  <View className="overflow-hidden rounded-[20px] bg-[#1C1C1C]">
    <LinearGradient
      colors={TIER_BACKDROP[tier]}
      {...TOP_RIGHT_WASH}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    <View className="p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-2">
          {/* The rewards screen's mark, tinted white rather than the benefits
              screen's outline, which is stroked at half opacity and reads grey
              against this heading. Still artwork either way: the animated star
              is a 235px hero's worth of bundle and decoding for a 28px glyph. */}
          <Image
            source={getTierIcon(tier)}
            alt=""
            style={{ width: TIER_ICON_SIZE, height: TIER_ICON_SIZE }}
            contentFit="contain"
            tintColor="#FFFFFF"
          />
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
