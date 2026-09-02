import { type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CASHBACK_PENDING_TEXT_COLOR } from '@/lib/cashbackProgress';
import { cn, formatBalanceUSD, formatNumber, formatWholeDollars } from '@/lib/utils';

import RewardsDiamondIcon from './RewardsDiamondIcon';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

interface CashbackDetailsContentProps extends CashbackDetailsData {
  onGetMoreCashback: () => void;
  animationSession: number;
  /**
   * Bottom-sheet presentation: adds the top padding that clears the sheet's drag
   * handle. False inside a modal, which brings its own padding.
   */
  isSheet?: boolean;
}

/** One "label — value" row of the stats block. */
const StatRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <View className="min-h-[58px] flex-row items-center justify-between px-[19px] py-3">
    <Text className="text-base font-medium text-white/70">{label}</Text>
    {children}
  </View>
);

const Divider = () => <View className="h-px bg-white/10" />;

const CashbackDetailsContent = ({
  cashbackRate,
  cashbackThisMonth,
  cashbackPendingThisMonth,
  maxCashbackMonthly,
  allTimeCashback,
  onGetMoreCashback,
  animationSession,
  isSheet = true,
}: CashbackDetailsContentProps) => (
  <View className={cn('items-center', isSheet && 'px-[34px] pt-[46px]')}>
    <RewardsDiamondIcon key={animationSession} />

    <Text
      className="mt-[31px] text-center text-[30px] text-white"
      style={{ fontFamily: 'MonaSans_600SemiBold', lineHeight: 36 }}
    >
      Cashback
    </Text>
    <Text
      className="mt-[7px] w-[284px] text-center text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Earn USDC back on eligible card spend, up to your monthly limit
    </Text>

    {/* The monthly cap is its own row rather than a "/ $150" suffix: earned and
        pending are both measured against it, and repeating it on each would read
        as two separate caps. */}
    <View className="mt-9 w-full overflow-hidden rounded-twice bg-[#2B2B2B]">
      <StatRow label="Your cashback rate">
        <Text className="text-lg font-bold text-[#94F27F]">
          {formatNumber(cashbackRate || 0, 0, 2)}%
        </Text>
      </StatRow>
      <Divider />
      <StatRow label="Cashback earned this month">
        <Text className="text-lg font-medium text-[#94F27F]">
          {formatWholeDollars(cashbackThisMonth)}
        </Text>
      </StatRow>
      {cashbackPendingThisMonth !== undefined && (
        <>
          <Divider />
          {/* Cents kept here, unlike the settled rows: a single purchase's
              cashback is usually under a dollar, and rounding it to $0 is the
              confusion this row exists to fix. */}
          <StatRow label="Cashback pending this month">
            <Text className="text-lg font-medium" style={{ color: CASHBACK_PENDING_TEXT_COLOR }}>
              {formatBalanceUSD(cashbackPendingThisMonth ?? 0)}
            </Text>
          </StatRow>
        </>
      )}
      <Divider />
      <StatRow label="Monthly cap">
        <Text className="text-lg font-medium text-white">
          {formatWholeDollars(maxCashbackMonthly)}
        </Text>
      </StatRow>
      <Divider />
      <StatRow label="All time cashback">
        <Text className="text-lg font-medium text-white">
          {formatWholeDollars(allTimeCashback)}
        </Text>
      </StatRow>
    </View>

    <Text
      className="mt-7 w-full text-base text-white/70"
      style={{ fontFamily: 'MonaSans_400Regular', lineHeight: 18 }}
    >
      Cashback is credited 14 days after the transaction settles and paid straight into your Savings{' '}
      <Text className="font-bold text-white/70 underline" onPress={onGetMoreCashback}>
        Learn more
      </Text>
    </Text>

    <Button
      variant="brand"
      accessibilityRole="button"
      onPress={onGetMoreCashback}
      className="mt-[35px] w-full transition-all active:scale-95 active:opacity-80"
    >
      <Text className="text-black">Get more cashback</Text>
    </Button>
  </View>
);

export default CashbackDetailsContent;
