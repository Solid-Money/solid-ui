import { Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { CASHBACK_PENDING_TEXT_COLOR } from '@/lib/cashbackProgress';
import { formatBalanceUSD } from '@/lib/utils';

import CashbackDetailsSheet from './CashbackDetailsSheet';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

interface RewardsSummaryCardProps {
  cashback: number;
  /** Cashback earned this month but still escrowed; absent hides the line. */
  cashbackPending?: number;
  referrals: number;
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

const FOOTNOTE_LINE_HEIGHT = 12;

interface SummaryStatProps {
  label: string;
  value: number;
  /** Secondary line under the figure. */
  footnote?: string;
  /**
   * Hold the footnote's height even without one, so a footnote on one column
   * doesn't push its label and figure out of line with the other's.
   */
  reserveFootnote?: boolean;
  onPress?: () => void;
}

/** One column of the card: what the reward is, and how much of it there is. */
const SummaryStat = ({ label, value, footnote, reserveFootnote, onPress }: SummaryStatProps) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}. ${formatBalanceUSD(value)}${footnote ? `. ${footnote}` : ''}`}
    disabled={!onPress}
    onPress={onPress}
    className="flex-1 items-center justify-center gap-2.5 transition-all active:opacity-70"
    style={Platform.OS === 'web' ? { minHeight: 96 } : undefined}
  >
    <Text
      className="text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 16 }}
    >
      {label}
    </Text>
    <Text
      className="text-[26px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 26 }}
    >
      {formatBalanceUSD(value)}
    </Text>
    {footnote ? (
      <Text
        className="text-xs"
        style={{
          color: CASHBACK_PENDING_TEXT_COLOR,
          fontFamily: 'MonaSans_500Medium',
          lineHeight: FOOTNOTE_LINE_HEIGHT,
        }}
      >
        {footnote}
      </Text>
    ) : (
      // A blank spacer rather than blank text, so a screen reader doesn't read
      // an empty line where the other column has a footnote.
      reserveFootnote && <View style={{ height: FOOTNOTE_LINE_HEIGHT }} />
    )}
  </Pressable>
);

/**
 * "Rewards" summary card: Cashback and Referrals split into two columns.
 */
const RewardsSummaryCard = ({
  cashback,
  cashbackPending,
  referrals,
  cashbackDetails,
  onGetMoreCashback,
  onReferralsPress,
}: RewardsSummaryCardProps) => {
  // Cashback settles days after the purchase, so the settled figure alone reads
  // as $0 for the fortnight an escrow takes to mature — which is exactly when a
  // fresh purchase is on the cardholder's mind.
  const showPending = cashbackPending !== undefined && cashbackPending > 0;

  return (
    <View className="relative mx-4 h-40 overflow-hidden rounded-twice bg-card">
      <View className="h-16 flex-row items-center px-3">
        <RewardsIcon />
        <Text
          className="ml-[3px] text-lg text-white"
          style={{ fontFamily: 'MonaSans_500Medium', lineHeight: 22 }}
        >
          Rewards
        </Text>
      </View>

      <View className="h-24 flex-row">
        <CashbackDetailsSheet
          trigger={
            <SummaryStat
              label="Cashback"
              value={cashback}
              footnote={
                showPending ? `+${formatBalanceUSD(cashbackPending ?? 0)} pending` : undefined
              }
            />
          }
          {...cashbackDetails}
          onGetMoreCashback={onGetMoreCashback}
        />
        <View className="w-px bg-white/10" />
        <SummaryStat
          label="Referrals"
          value={referrals}
          reserveFootnote={showPending}
          onPress={onReferralsPress}
        />
      </View>

      <View className="absolute left-0 right-0 top-16 h-px bg-white/10" />
    </View>
  );
};

export default RewardsSummaryCard;
