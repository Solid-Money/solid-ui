import HomeSend from '@/assets/images/home-send';
import HomeSwap from '@/assets/images/home-swap';
import WithdrawIcon from '@/assets/images/withdraw-icon';
import SavingCountUp from '@/components/SavingCountUp';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { DepositOptionModal } from '../DepositOption';

interface DashboardHeaderProps {
  balance: number;
  totalAPY: number;
  firstDepositTimestamp: number;
  originalDepositAmount: number;
  hasTokens: boolean;
}

export function DashboardHeader({
  balance,
  totalAPY,
  firstDepositTimestamp,
  originalDepositAmount,
  hasTokens,
}: DashboardHeaderProps) {
  const { isScreenMedium } = useDimension();
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center">
        <View className="flex-row items-center">
          <Text className="text-5xl md:text-8xl text-foreground font-semibold">$</Text>
          <SavingCountUp
            balance={balance}
            apy={totalAPY}
            lastTimestamp={firstDepositTimestamp}
            principal={originalDepositAmount}
            classNames={{
              wrapper: 'text-foreground',
              decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
            }}
            styles={{
              wholeText: {
                fontSize: isScreenMedium ? 96 : 48,
                fontWeight: isScreenMedium ? 'medium' : 'semibold',
                color: '#ffffff',
                marginRight: -2,
              },
              decimalText: {
                fontSize: isScreenMedium ? 40 : 24,
                fontWeight: isScreenMedium ? 'medium' : 'semibold',
                color: '#ffffff',
              },
            }}
          />
        </View>
      </View>
      <View className="flex-row gap-2">
        <DepositOptionModal buttonText="Add funds" />
        {hasTokens && (
          <>
            <Button
              variant="secondary"
              className="h-12 px-6 rounded-xl bg-[#303030]"
              onPress={() => {}}
            >
              <View className="flex-row items-center gap-3">
                <WithdrawIcon />
                <Text className="text-white font-bold">Withdraw</Text>
              </View>
            </Button>
            <Button
              variant="secondary"
              className="h-12 px-6 rounded-xl bg-[#303030]"
              onPress={() => {
                router.push(path.SWAP);
              }}
            >
              <View className="flex-row items-center gap-2">
                <HomeSwap />
                <Text className="text-white font-bold">Swap</Text>
              </View>
            </Button>
            <Button
              variant="secondary"
              className="h-12 px-6 rounded-xl bg-[#303030]"
              onPress={() => {
                router.push(path.SEND);
              }}
            >
              <View className="flex-row items-center gap-2">
                <HomeSend />
                <Text className="text-white font-bold">Send</Text>
              </View>
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
