import { View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { formatBalanceUSD } from '@/lib/utils';

interface RewardsSummaryCardProps {
  cashback: number;
  referrals: number;
}

/**
 * "Rewards" summary card: combined rewards total on top, then Cashback and
 * Referrals split into two columns (mirrors the mockup).
 */
const RewardsSummaryCard = ({ cashback, referrals }: RewardsSummaryCardProps) => {
  const total = (cashback || 0) + (referrals || 0);

  return (
    <View className="mx-4 rounded-twice bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Sparkles size={18} color="#ffffff" />
          <Text className="text-base font-semibold text-white">Rewards</Text>
        </View>
        <Text className="text-base font-semibold text-white">{formatBalanceUSD(total)}</Text>
      </View>

      <View className="my-4 h-px bg-border/40" />

      <View className="flex-row">
        <View className="flex-1 gap-1">
          <Text className="text-sm text-muted-foreground">Cashback</Text>
          <Text className="text-2xl font-semibold text-white">{formatBalanceUSD(cashback)}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm text-muted-foreground">Referrals</Text>
          <Text className="text-2xl font-semibold text-white">{formatBalanceUSD(referrals)}</Text>
        </View>
      </View>
    </View>
  );
};

export default RewardsSummaryCard;
