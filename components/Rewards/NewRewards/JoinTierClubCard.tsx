import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getTierDisplayName } from '@/lib/tierNames';
import { RewardsTier } from '@/lib/types';

import { BOTTOM_RIGHT_WASH } from './tierGradients';

import type { TierUpgradeBenefit } from './UpgradeTier/tierUpgradeBenefits';

const CHEVRON_COLOR = 'rgba(255,255,255,0.4)';

/**
 * The tier's own tint, lit from the bottom-right and falling away to black.
 *
 * Deliberately stronger than it was. At 0.16 over `#1C1C1C` the brand green
 * lands on rgb(47,62,44) — a couple of points off the card it sits on, which
 * read as grey rather than as the tier's colour. A third of the way up it is
 * unmistakably green and the white copy on top still clears contrast easily.
 *
 * The third stop is what makes the far corner black rather than merely
 * untinted: the heading sits there, and black behind it is the most legible
 * thing to put under white text.
 */
const TIER_GRADIENT: Record<RewardsTier, readonly [string, string, string]> = {
  [RewardsTier.CORE]: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.45)'],
  [RewardsTier.PRIME]: ['rgba(148,242,127,0.30)', 'rgba(148,242,127,0.07)', 'rgba(0,0,0,0.45)'],
  [RewardsTier.ULTRA]: ['rgba(148,242,127,0.36)', 'rgba(148,242,127,0.09)', 'rgba(0,0,0,0.45)'],
};

/** Tint held through the first stretch, then given over to the black. */
const TIER_GRADIENT_STOPS = [0, 0.4, 1] as const;

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
        locations={TIER_GRADIENT_STOPS}
        {...BOTTOM_RIGHT_WASH}
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
