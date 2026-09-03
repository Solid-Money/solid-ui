import { StyleSheet, View } from 'react-native';

import { HOME_BANNER_RADIUS } from '@/components/Home/NewHome/homeBannerStyle';
import { Text } from '@/components/ui/text';
import { useRewardsUserData } from '@/hooks/useRewards';
import { IS_TIER_CASHBACK_HARDCODED } from '@/lib/config';
import { resolveTierCashbackRate, TIER_CASHBACK_RATES } from '@/lib/tierCashback';
import { RewardsTier } from '@/lib/types';
import { formatBalanceUSD } from '@/lib/utils';

/**
 * The terminal banner of the home CTA ladder (Figma 25141:7292): the user has a
 * card, has funded it and has spent on it, so there is no next step left to
 * nudge — just what the card is earning them.
 *
 * Unlike every banner before it this one has no ✕ and no CTA. It is not a nudge
 * that can be satisfied, so there is nothing to dismiss it *for*; it stays put
 * once the user has finished the funnel. See `HomePromptKey`.
 *
 * The rate is the one the rest of the app quotes (`resolveTierCashbackRate`), so
 * this cannot contradict the cashback sheet or the tier screens. It falls back
 * to the Core rate the design was drawn at rather than printing "Earn 0%" while
 * the rewards data is still in flight.
 */
const HomeCashbackCtaBanner = ({ className }: { className?: string }) => {
  const { data: rewardsData } = useRewardsUserData();

  const rate =
    resolveTierCashbackRate(
      rewardsData?.currentTier,
      rewardsData?.cashbackRate,
      IS_TIER_CASHBACK_HARDCODED,
    ) || TIER_CASHBACK_RATES[RewardsTier.CORE];
  const earnedThisMonth = rewardsData?.cashbackThisMonth ?? 0;

  return (
    <View className={className}>
      <View style={styles.card}>
        <Text style={styles.title}>Earn {rate}% cashback on everything</Text>
        <View style={styles.earned}>
          <Text style={styles.earnedLabel}>Earned this month</Text>
          <Text style={styles.earnedAmount}>{formatBalanceUSD(earnedThisMonth)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Figma: 387x94 with 21pt side padding; laid out with flex rather than the
  // design's absolute offsets so a five-figure month still fits on the right.
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: HOME_BANNER_RADIUS,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 21,
    paddingVertical: 20,
  },
  // Wraps to two lines at the design's width, which is what sets the card's height.
  title: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontFamily: 'MonaSans_500Medium',
    fontSize: 22,
    lineHeight: 24,
    maxWidth: 201,
  },
  earned: { alignItems: 'flex-end', gap: 4 },
  earnedLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
  },
  earnedAmount: {
    color: '#94F27F',
    fontFamily: 'MonaSans_600SemiBold',
    fontSize: 22,
  },
});

export default HomeCashbackCtaBanner;
