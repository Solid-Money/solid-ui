import { Pressable, StyleSheet, View } from 'react-native';

import { CashbackDiamondIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { useRewardsUserData } from '@/hooks/useRewards';
import { formatNumber } from '@/lib/utils';

/**
 * "Cashback earned: $38 / $150" card with the progress track and the spend-more
 * hint (Figma 21843:872). Numbers come from the rewards user data, the same
 * source the Rewards tab's cashback card reads.
 */
interface CardCashbackCardProps {
  onPress?: () => void;
}

const CardCashbackCard = ({ onPress }: CardCashbackCardProps) => {
  const { data: rewardsData } = useRewardsUserData();

  const earned = rewardsData?.cashbackThisMonth ?? 0;
  const cap = rewardsData?.maxCashbackMonthly ?? 0;
  const rate = rewardsData?.cashbackRate ?? 0;

  const progress = cap > 0 ? Math.min(100, Math.max(0, (earned / cap) * 100)) : 0;
  // Spend needed to reach the monthly cap: (cap - earned) * 100 / rate%.
  const remainingSpend = rate > 0 ? (Math.max(0, cap - earned) * 100) / rate : 0;

  return (
    <Pressable
      accessibilityLabel="View cashback details"
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      className="overflow-hidden rounded-twice bg-card"
    >
      <View style={styles.titleRow}>
        <CashbackDiamondIcon />
        <Text className="ml-[6px] text-[18px] font-medium text-white">
          Cashback earned:{' '}
          <Text className="text-[18px] font-medium text-[#94F27F]" style={styles.earnedAmount}>
            ${formatNumber(earned, 0, 0)}
          </Text>{' '}
          / ${formatNumber(cap, 0, 0)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
      {/* Reserved height so the card doesn't resize once the rewards data lands
          (the hint would otherwise read "Spend $0 more" while it loads). */}
      <View style={styles.hint}>
        {cap > 0 && (
          <Text className="text-[14px] font-normal text-white/70">
            Spend ${formatNumber(remainingSpend, 0, 0)} more for max cashback this month
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  earnedAmount: { position: 'relative', top: -2 },
  // Figma: icon left edge at 21, title baseline block starting at y=23.
  titleRow: { alignItems: 'center', flexDirection: 'row', paddingLeft: 21, paddingTop: 21 },
  // 5pt rounded track, inset 21 on both sides, 16 below the title.
  track: {
    backgroundColor: '#464646',
    borderRadius: 2.5,
    height: 5,
    marginHorizontal: 21,
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { backgroundColor: '#94F27F', borderRadius: 2.5, height: 5 },
  // 19 + one 17pt line + 21, so the row keeps its height before the data lands.
  hint: { minHeight: 57, paddingBottom: 21, paddingHorizontal: 20, paddingTop: 19 },
});

export default CardCashbackCard;
