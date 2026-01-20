import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';

import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TOKEN_IMAGES } from '@/constants/tokens';
import { useTotalAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { formatNumber } from '@/lib/utils';

const transfers = [
  {
    amount: 1000,
    type: 'deposit',
    date: 'May 22, 8:23AM',
    chainId: 1,
    symbol: 'USDC',
    imageId: 'usdc',
  },
];

export default function Earn() {
  const { data: totalAPY } = useTotalAPY();
  const { isDesktop } = useDimension();

  return (
    <SafeAreaView
      className="flex-1 bg-background text-foreground"
      edges={isDesktop ? [] : ['top', 'right', 'left', 'bottom']}
    >
      <ScrollView className="flex-1">
        <View className="mx-auto w-full max-w-md gap-8 px-4 py-8 md:gap-16">
          <View className="flex-1 items-center gap-5">
            <Badge variant="brand" className="px-4 py-2">
              {totalAPY ? (
                <Text className="text-sm font-semibold">{totalAPY.toFixed(2)}% APY</Text>
              ) : (
                <Skeleton className="h-5 w-20 rounded-md bg-brand/50" />
              )}
            </Badge>
            <View className="flex-row items-end gap-1">
              <Text className="text-lg font-semibold">$</Text>
              <Text className="text-5xl font-semibold">1,000</Text>
              <Text className="text-5xl font-semibold opacity-30">.15</Text>
            </View>
          </View>
          <View className="min-h-96 justify-between gap-4 rounded-xl bg-primary/10 md:rounded-twice">
            <View className="flex-row items-center justify-between">
              <View className="w-1/2 items-center gap-1 p-6">
                <Text className="text-2xl font-bold">$345.45</Text>
                <Text className="text-sm opacity-50">All time earned</Text>
              </View>
              <View className="w-1/2 items-center gap-1 p-6">
                <Text className="text-2xl font-bold">$12.32</Text>
                <Text className="text-sm opacity-50">Earned this month</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-center gap-10 pb-6">
              <View className="gap-2">
                <DepositOptionModal
                  trigger={
                    <Button className="h-12 w-12 rounded-full p-0 text-primary-foreground">
                      <Plus />
                    </Button>
                  }
                />
                <Text className="text-sm opacity-50">Deposit</Text>
              </View>
              <View className="gap-2">
                <Button
                  className="h-12 w-12 rounded-full p-0 text-primary-foreground"
                  onPress={() => {}}
                >
                  <Minus />
                </Button>
                <Text className="text-sm opacity-50">Withdraw</Text>
              </View>
            </View>
          </View>
          <View className="gap-2">
            <Text className="opacity-50">Recent transfers</Text>
            <View className="gap-2">
              {transfers.map(transfer => (
                <Button
                  key={transfer.date}
                  variant="outline"
                  className="min-h-20 flex-row justify-between rounded-xl border-0 bg-primary/10 p-4 md:rounded-twice"
                >
                  <View className="flex-row items-center gap-2">
                    <Image source={TOKEN_IMAGES[transfer.imageId]} className="h-10 w-10" />
                    <View className="gap-1">
                      <Text className="font-bold">Deposit {transfer.symbol}</Text>
                      <Text className="text-sm opacity-50">{transfer.date}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold">
                      {transfer.type === 'deposit' ? '+' : '-'}${formatNumber(transfer.amount)}
                    </Text>
                    <ChevronRight />
                  </View>
                </Button>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
