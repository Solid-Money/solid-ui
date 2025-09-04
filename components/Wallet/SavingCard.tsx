import { useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Address } from 'viem';
import { useBlockNumber } from 'wagmi';
import { mainnet } from 'viem/chains';

import { Text } from '@/components/ui/text';
import { cn, fontSize } from '@/lib/utils';
import TooltipPopover from '@/components/Tooltip';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import SavingCountUp from '@/components/SavingCountUp';
import useUser from '@/hooks/useUser';
import { useFuseVaultBalance } from '@/hooks/useVault';
import { useLatestTokenTransfer, useTotalAPY } from '@/hooks/useAnalytics';
import { ADDRESSES } from '@/lib/config';
import { useDepositCalculations } from '@/hooks/useDepositCalculations';
import { useGetUserTransactionsQuery } from '@/graphql/generated/user-info';

type SavingCardProps = {
  className?: string;
};

const SavingCard = ({ className }: SavingCardProps) => {
  const router = useRouter();
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const { data: totalAPY } = useTotalAPY();

  const { data: blockNumber } = useBlockNumber({
    watch: true,
    chainId: mainnet.id,
  });
  const { data: userDepositTransactions, refetch: refetchTransactions } =
    useGetUserTransactionsQuery({
      variables: {
        address: user?.safeAddress?.toLowerCase() ?? '',
      },
    });
  const { data: balance, refetch: refetchBalance } = useFuseVaultBalance(
    user?.safeAddress as Address,
  );
  const { data: lastTimestamp } = useLatestTokenTransfer(
    user?.safeAddress ?? '',
    ADDRESSES.fuse.vault,
  );
  const { firstDepositTimestamp } = useDepositCalculations(
    userDepositTransactions,
    balance,
    lastTimestamp,
  );

  useEffect(() => {
    refetchBalance();
    refetchTransactions();
  }, [blockNumber, refetchBalance, refetchTransactions]);

  return (
    <Pressable onPress={() => router.push(path.SAVINGS)} className="flex-1 web:hover:opacity-95">
      <LinearGradient
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        colors={['rgb(52, 10, 89)', 'rgba(40, 9, 67, 0.7)']}
        className={cn('bg-card rounded-twice p-6 justify-between w-full h-full', className)}
      >
        <View className="flex-row items-center gap-2 opacity-50">
          <Leaf size={18} />
          <Text className="text-lg font-semibold">Savings</Text>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center">
              <Text className="text-2xl md:text-3xl font-semibold native:leading-[1.2]">$</Text>
              <SavingCountUp
                balance={balance ?? 0}
                apy={totalAPY ?? 0}
                lastTimestamp={firstDepositTimestamp ?? 0}
                classNames={{
                  wrapper: 'text-foreground',
                  decimalSeparator: 'text-2xl md:text-3xl font-semibold',
                }}
                styles={{
                  wholeText: {
                    fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                    fontWeight: 'semibold',
                    fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                    marginRight: -1,
                  },
                  decimalText: {
                    fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                    fontWeight: 'semibold',
                    fontFamily: 'MonaSans_600SemiBold',
                    color: '#ffffff',
                  },
                }}
              />
            </View>
            <TooltipPopover text="Balance + Yield of staked soUSD" />
          </View>
          <Image
            source={require('@/assets/images/sousd-4x.png')}
            style={{ width: 28, height: 28 }}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

export default SavingCard;
