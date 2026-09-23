import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { IconBadge } from '@/components/Rewards/NewRewards/tierBenefitIcons';
import { Text } from '@/components/ui/text';
import { getTierIcon } from '@/constants/rewards';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import UpgradeTierCashbackIcon from './UpgradeTierCashbackIcon';

import type { TierUpgradeBenefit } from './tierUpgradeBenefits';

const BENEFIT_ICON_SIZE = 33;
const cardTexture = require('@/assets/images/rewards-welcome-texture.png');
const tierStar = require('@/assets/images/rewards-tiers/upgrade-card-star.svg');
const yieldIcon = require('@/assets/images/rewards-tiers/upgrade-card-yield.svg');
const subscriptionIcon = require('@/assets/images/rewards-tiers/upgrade-card-subscription.svg');
const cashbackCapIcon = require('@/assets/images/rewards-tiers/upgrade-card-cap.svg');

interface UpgradeTierHeroCardProps {
  tier: RewardsTier;
  benefits: TierUpgradeBenefit[];
  /** The pill in the top-right, e.g. "Renews on 10 Sep, 2027". Hidden when absent. */
  statusLabel?: string;
}

/** The tier being bought, and what it gets you. */
const UpgradeTierHeroCard = ({ tier, benefits, statusLabel }: UpgradeTierHeroCardProps) => (
  <View className="min-h-[303px] overflow-hidden rounded-[23px] bg-[#1C1C1C]">
    <LinearGradient
      colors={['#505050', '#1C1C1C']}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
    <Image
      source={cardTexture}
      alt=""
      contentFit="fill"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: -86,
        width: 848,
        height: 565,
        opacity: 0.06,
        transform: [{ translateX: -424 }],
      }}
    />
    <LinearGradient
      colors={['rgba(28,28,28,0)', '#1C1C1C', '#1C1C1C']}
      locations={[0, 0.7, 1]}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />

    <View className="px-[23px] pb-6 pt-[23px]">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Image
            source={tier === RewardsTier.PRIME ? tierStar : getTierIcon(tier)}
            alt=""
            style={{ width: 24.7275, height: 23.5172 }}
            contentFit="contain"
            tintColor={tier === RewardsTier.PRIME ? undefined : '#FFFFFF'}
          />
          <Text className="text-[26px] font-medium leading-[31px] text-white">
            {getTierDisplayName(tier)}
          </Text>
        </View>

        {statusLabel ? (
          <View className="-mr-[6px] rounded-full bg-white/10 px-[11px] py-2">
            <Text className="text-[14px] font-medium leading-[14px] text-white">{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-[7px] text-[16px] leading-5 text-white/70">Membership</Text>

      <View className="mt-[35px] gap-[10px]">
        {benefits.map(benefit => (
          <View key={benefit.key} className="flex-row items-center gap-2">
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
      return <UpgradeTierCashbackIcon />;
    case 'yield-boost':
      return (
        <Image
          source={yieldIcon}
          alt=""
          contentFit="contain"
          style={{ width: 33, height: 32.3774 }}
        />
      );
    case 'subscription':
      return (
        <Image
          source={subscriptionIcon}
          alt=""
          contentFit="contain"
          style={{ width: 33, height: 32.3774 }}
        />
      );
    case 'cashback-cap':
      return (
        <IconBadge size={BENEFIT_ICON_SIZE}>
          <Image
            source={cashbackCapIcon}
            alt=""
            contentFit="contain"
            style={{ width: 19, height: 18.6604 }}
          />
        </IconBadge>
      );
  }
};

export default UpgradeTierHeroCard;
