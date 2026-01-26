import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { formatNumber } from '@/lib/utils';

interface CashbackCardProps {
  cashbackThisMonth: number;
  cashbackRate: number;
  maxCashbackMonthly: number;
}

const CashbackCard = ({
  cashbackThisMonth,
  cashbackRate,
  maxCashbackMonthly,
}: CashbackCardProps) => {
  const { isScreenMedium } = useDimension();
  const progress = maxCashbackMonthly > 0 ? (cashbackThisMonth / maxCashbackMonthly) * 100 : 0;

  // Calculate remaining spending needed to hit the cashback cap
  // Formula: (cap - earned) * 100 / percentage
  // e.g., ($20 - $9) * 100 / 2 = $550 more spending needed
  const remainingCashback = Math.max(0, maxCashbackMonthly - cashbackThisMonth);
  const remainingSpend = cashbackRate > 0 ? (remainingCashback * 100) / cashbackRate : 0;

  return (
    <View className="flex-1 justify-between overflow-hidden rounded-twice bg-card p-6">
      <View className="relative flex-row items-center justify-between">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-medium text-brand/70">Cashback</Text>
          <Text className="text-3xl font-bold">
            ${formatNumber(cashbackThisMonth, 0, 0)} this month
          </Text>
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
            <View className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <View className="h-full bg-brand" style={{ width: `${Math.min(progress, 100)}%` }} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default CashbackCard;
