import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import {
  CASHBACK_PENDING_COLOR,
  CASHBACK_PENDING_TEXT_COLOR,
  resolveCashbackProgress,
} from '@/lib/cashbackProgress';
import { formatBalanceUSD, formatNumber } from '@/lib/utils';

interface CashbackCardProps {
  cashbackThisMonth: number;
  /** Earned this month but still escrowed; absent hides the pending parts. */
  cashbackPendingThisMonth?: number;
  cashbackRate: number;
  maxCashbackMonthly: number;
}

const CashbackCard = ({
  cashbackThisMonth,
  cashbackPendingThisMonth,
  cashbackRate,
  maxCashbackMonthly,
}: CashbackCardProps) => {
  const { isScreenMedium } = useDimension();
  const pending = cashbackPendingThisMonth ?? 0;
  const { earnedPct, pendingPct } = resolveCashbackProgress({
    earned: cashbackThisMonth,
    pending,
    cap: maxCashbackMonthly,
  });

  // Calculate remaining spending needed to hit the cashback cap
  // Formula: (cap - earned - pending) * 100 / percentage
  // e.g., ($20 - $9 - $1) * 100 / 2 = $500 more spending needed
  // Escrowed cashback draws down the same cap when it matures, so it counts
  // against the target too — otherwise this asks for spend that will be capped.
  const remainingCashback = Math.max(0, maxCashbackMonthly - cashbackThisMonth - pending);
  const remainingSpend = cashbackRate > 0 ? (remainingCashback * 100) / cashbackRate : 0;
  const showPending = cashbackPendingThisMonth !== undefined && cashbackPendingThisMonth > 0;

  return (
    <View className="flex-1 justify-between overflow-hidden rounded-twice bg-card px-6 pb-10 pt-6 md:p-6">
      <View className="relative flex-row items-center justify-between">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-medium text-brand/70">Cashback</Text>
          <Text className="text-3xl font-bold">
            ${formatNumber(cashbackThisMonth, 0, 0)} this month
          </Text>
          {/* Cashback settles days after the purchase, so this is what a
              cardholder who just spent is looking for. */}
          {showPending && (
            <Text className="text-base font-medium" style={{ color: CASHBACK_PENDING_TEXT_COLOR }}>
              {formatBalanceUSD(pending)} pending
            </Text>
          )}
        </View>
        <View className="pointer-events-none absolute right-0 top-0">
          <Image
            source={getAsset('images/diamond.png')}
            contentFit="contain"
            style={{ width: isScreenMedium ? 140 : 60, height: isScreenMedium ? 140 : 60 }}
          />
        </View>
      </View>
      <View>
        <Text className="text-base font-medium opacity-70">
          You are receiving {cashbackRate}% cashback
        </Text>
        {maxCashbackMonthly > 0 && (
          <View className="gap-4">
            <Text className="text-base font-medium opacity-70">
              Spend ${formatNumber(remainingSpend, 0, 0)} more for max cashback this month
            </Text>
            <View className="h-2.5 w-full flex-row overflow-hidden rounded-full bg-white/10">
              <View className="h-full bg-brand" style={{ width: `${earnedPct}%` }} />
              {/* Same line, dimmer: the pending stretch continues where the
                  settled one stops. */}
              <View
                className="h-full"
                style={{ backgroundColor: CASHBACK_PENDING_COLOR, width: `${pendingPct}%` }}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default CashbackCard;
