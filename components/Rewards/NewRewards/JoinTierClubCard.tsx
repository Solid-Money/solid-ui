import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import type { TierUpgradeBenefit } from './UpgradeTier/tierUpgradeBenefits';

const CHEVRON_COLOR = 'rgba(255,255,255,0.4)';

/** The tier's own tint, dissolved off the top-right corner. */
const TIER_GRADIENT: Record<RewardsTier, readonly [string, string]> = {
  [RewardsTier.CORE]: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'],
  [RewardsTier.PRIME]: ['rgba(148,242,127,0.16)', 'rgba(148,242,127,0)'],
  [RewardsTier.ULTRA]: ['rgba(148,242,127,0.22)', 'rgba(148,242,127,0)'],
};

interface JoinTierClubCardProps {
  tier: RewardsTier;
  /** The benefits to advertise, as chips. Shown in order; three fit a phone. */
  benefits: TierUpgradeBenefit[];
  onPress: () => void;
}

/**
 * "Join Prime Club" — the v3 route to the next tier.
 *
 * Replaces `TierUpgradeCard`, which offers two things v3 no longer sells: a
 * points bar climbing to a tier points no longer unlock, and a "skip the line"
 * FUSE deposit that is now a year-long lock with a price on it. Leaving that
 * card up while `pointsUnlockEnabled` is false advertises a route the backend
 * will refuse.
 *
 * Deliberately a teaser and not a form: the decision has a price, a term and a
 * choice of how to pay, and all of that belongs on the upgrade screen this
 * opens rather than in a card on a page about something else.
 */
const JoinTierClubCard = ({ tier, benefits, onPress }: JoinTierClubCardProps) => {
  const tierName = getTierDisplayName(tier);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Join ${tierName} Club`}
      onPress={onPress}
      className="overflow-hidden rounded-[23px] bg-[#1C1C1C] transition-all active:opacity-80"
    >
      <LinearGradient
        colors={TIER_GRADIENT[tier]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[18px] font-bold leading-[22px] text-white">
              Join {tierName} Club
            </Text>
            <Text className="mt-1 text-[14px] leading-5 text-white/70">
              Unlock extra cashback and benefits
            </Text>
          </View>

          <ChevronRight color={CHEVRON_COLOR} size={20} />
        </View>

        {benefits.length > 0 ? (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {benefits.map(benefit => (
              <View key={benefit.key} className="rounded-full bg-white/10 px-3 py-2">
                <Text className="text-[13px] font-medium leading-4 text-white">
                  {benefit.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

export default JoinTierClubCard;
