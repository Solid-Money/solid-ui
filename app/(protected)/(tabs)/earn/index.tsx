import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TOKEN_IMAGES } from '@/constants/tokens';
import { formatNumber } from '@/lib/utils';
import { useTotalAPY } from '@/hooks/useAnalytics';
import { Skeleton } from '@/components/ui/skeleton';
import { useDimension } from '@/hooks/useDimension';

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
  const router = useRouter();
  const { data: totalAPY } = useTotalAPY();
  const { isDesktop } = useDimension();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={isDesktop ? [] : ['top', 'right', 'left', 'bottom']}
    >
      <ScrollView className="flex-1">
        <View className="w-full max-w-md mx-auto gap-8 md:gap-16 px-4 py-8">
          <View className="flex-1 items-center gap-5">
            <Badge variant="brand" className="px-4 py-2">
              {totalAPY ? (
                <Text className="text-sm font-semibold">{totalAPY.toFixed(2)}% APY</Text>
              ) : (
                <Skeleton className="w-20 h-5 bg-brand/50 rounded-md" />
              )}
            </Badge>
            <View className="flex-row items-end gap-1">
              <Text className="text-lg font-semibold">$</Text>
              <Text className="text-5xl font-semibold">1,000</Text>
              <Text className="text-5xl font-semibold opacity-30">.15</Text>
            </View>
          </View>
          <View className="gap-4 justify-between bg-primary/10 rounded-xl md:rounded-twice min-h-96">
            <View className="flex-row items-center justify-between">
              <View className="w-1/2 gap-1 items-center p-6">
                <Text className="text-2xl font-bold">$345.45</Text>
                <Text className="text-sm opacity-50">All time earned</Text>
              </View>
              <View className="w-1/2 gap-1 items-center p-6">
                <Text className="text-2xl font-bold">$12.32</Text>
                <Text className="text-sm opacity-50">Earned this month</Text>
              </View>
            </View>
            <View className="flex-row justify-center items-center gap-10 pb-6">
              <View className="gap-2">
                <Button
                  className="w-12 h-12 rounded-full p-0 text-primary-foreground"
                  onPress={() => router.push(path.DEPOSIT)}
                >
                  <Plus />
                </Button>
                <Text className="text-sm opacity-50">Deposit</Text>
              </View>
              <View className="gap-2">
                <Button
                  className="w-12 h-12 rounded-full p-0 text-primary-foreground"
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
                  className="min-h-20 flex-row justify-between bg-primary/10 border-0 rounded-xl md:rounded-twice p-4"
                >
                  <View className="flex-row items-center gap-2">
                    <Image source={TOKEN_IMAGES[transfer.imageId]} className="w-10 h-10" />
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
