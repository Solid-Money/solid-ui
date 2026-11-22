import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { formatCashbackFigures } from '@/lib/formatMonthlyCashback';
import { formatBalance } from '@/lib/utils';

import CashbackDetailsSheet from './CashbackDetailsSheet';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

/**
 * The two green washes from Figma node 26080:21244.
 *
 * This is intentionally an SVG rather than a full-card `LinearGradient`: the
 * design uses an oversized, partly off-canvas circle plus a shallow rotated
 * strip. A corner-to-corner gradient keeps gaining colour down the right edge,
 * which is why the native card looked much greener than the Figma reference.
 */
const RewardsGradient = () => (
  <Svg
    width="100%"
    height="100%"
    viewBox="0 0 385 160"
    preserveAspectRatio="none"
    pointerEvents="none"
    style={StyleSheet.absoluteFill}
  >
    <Defs>
      <SvgLinearGradient
        id="rewardsCircleGradient"
        x1={134.378}
        y1={75.1874}
        x2={194.367}
        y2={187.969}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset={0} stopColor="#94F27F" stopOpacity={0} />
        <Stop offset={1} stopColor="#94F27F" stopOpacity={1} />
      </SvgLinearGradient>
      <SvgLinearGradient
        id="rewardsStripGradient"
        x1={0}
        y1={0}
        x2={0}
        y2={87.569}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset={0} stopColor="#94F27F" stopOpacity={0} />
        <Stop offset={1} stopColor="#94F27F" stopOpacity={0.1} />
      </SvgLinearGradient>
    </Defs>

    <G transform="translate(371.5585 -100.2615) rotate(12.27) scale(1 -1) translate(-219.1635 -219.1635)">
      <Circle
        cx={219.1635}
        cy={219.1635}
        r={219.1635}
        fill="url(#rewardsCircleGradient)"
        opacity={0.2}
      />
    </G>
    <G transform="translate(252.2925 -16.8275) rotate(10.46) scale(1 -1) translate(-221.0165 -43.7845)">
      <Rect width={442.033} height={87.569} fill="url(#rewardsStripGradient)" />
    </G>
  </Svg>
);

interface RewardsSummaryCardProps {
  /** Everything earned from referrals so far. */
  referrals: number;
  /**
   * What the cashback sheet shows. The card's own figure is its
   * `lifetimeCashback`, formatted the same way as the sheet's row, so the card
   * and the sheet it opens can't disagree.
   */
  cashbackDetails: CashbackDetailsData;
  onGetMoreCashback: () => void;
  onReferralsPress: () => void;
}

const RewardsIcon = () => (
  <View className="h-[31px] w-[31px] items-center justify-center">
    <Svg width={18.5004} height={20.5} viewBox="0 0 18.5004 20.5" fill="none">
      <Path
        d="M17.278 5.69833L9.25022 10.25M9.25022 10.25L1.22241 5.69833M9.25022 10.25V19.4068M5.00022 3.02092L13.5002 7.8403M17.7502 14.8966L9.98405 19.4726C9.7162 19.6246 9.58228 19.7004 9.44052 19.7302C9.31491 19.7566 9.18552 19.7566 9.06 19.7302C8.91815 19.7004 8.78423 19.6246 8.51638 19.4726L1.52746 15.5101C1.24459 15.3497 1.10314 15.2695 1.00014 15.1554C0.909033 15.0545 0.840079 14.9349 0.797891 14.8046C0.750215 14.6573 0.750215 14.4922 0.750215 14.1619V6.33805C0.750215 6.00779 0.750215 5.84266 0.797891 5.69538C0.840079 5.56508 0.909033 5.44548 1.00014 5.34458C1.10314 5.23051 1.24458 5.15032 1.52746 4.98993L8.51638 1.02733C8.78423 0.875465 8.91815 0.799531 9.06 0.769757C9.18552 0.743414 9.31491 0.743414 9.44052 0.769757C9.58228 0.799531 9.7162 0.875465 9.98405 1.02733L16.9729 4.98993C17.2559 5.15032 17.3973 5.23051 17.5003 5.34458C17.5914 5.44548 17.6604 5.56508 17.7025 5.69538C17.7502 5.84266 17.7502 6.00779 17.7502 6.33805V14.8966Z"
        stroke="#94F27F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

interface SummaryStatProps {
  label: string;
  value: string;
  onPress?: () => void;
}

/** One column of the card: what the reward is, and how much of it there is. */
const SummaryStat = ({ label, value, onPress }: SummaryStatProps) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}. ${value}`}
    disabled={!onPress}
    onPress={onPress}
    className="flex-1 items-center justify-center gap-2.5 transition-all active:opacity-70"
    style={Platform.OS === 'web' ? { minHeight: 96 } : undefined}
  >
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      className="text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 20 }}
    >
      {label}
    </Text>
    <Text
      className="text-center text-[26px] text-white"
      // Native clips glyphs to the line box, and Mona Sans needs ~1.15em to fit.
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 32 }}
    >
      {value}
    </Text>
  </Pressable>
);

/**
 * "Rewards" summary card: Lifetime cashback and Referrals split into two
 * columns.
 *
 * Both are totals over everything earned so far, so the two columns measure the
 * same thing. The cashback figure counts what is still in escrow alongside what
 * has been paid — see `resolveLifetimeCashback`, which the caller applies — and
 * is the same figure as the sheet's "Lifetime cashback" row. Cashback in the
 * cardholder's other currency is printed beside it, never added in.
 */
const RewardsSummaryCard = ({
  referrals,
  cashbackDetails,
  onGetMoreCashback,
  onReferralsPress,
}: RewardsSummaryCardProps) => {
  return (
    <View className="relative mx-4 min-h-40 overflow-hidden rounded-twice bg-card">
      <RewardsGradient />

      <View className="h-16 flex-row items-center px-3">
        <RewardsIcon />
        <Text
          className="ml-[3px] text-lg text-white"
          style={{ fontFamily: 'MonaSans_500Medium', lineHeight: 22 }}
        >
          Rewards
        </Text>
      </View>

      <View className="min-h-24 flex-row">
        <CashbackDetailsSheet
          trigger={
            <SummaryStat
              label="Lifetime cashback"
              value={formatCashbackFigures(cashbackDetails.lifetimeCashback)}
            />
          }
          {...cashbackDetails}
          onGetMoreCashback={onGetMoreCashback}
        />
        <View className="w-px bg-white/10" />
        <SummaryStat
          label="Referrals"
          value={formatBalance(referrals)}
          onPress={onReferralsPress}
        />
      </View>

      <View className="absolute left-0 right-0 top-16 h-px bg-white/10" />
    </View>
  );
};

export default RewardsSummaryCard;
