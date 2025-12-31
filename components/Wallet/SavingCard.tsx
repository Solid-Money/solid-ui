import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import React, { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import Ping from '@/components/Ping';
import SavingCountUp from '@/components/SavingCountUp';
import TooltipPopover from '@/components/Tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { GetUserTransactionsQuery } from '@/graphql/generated/user-info';
import { useAPYs, useMaxAPY } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { cn, fontSize, formatNumber } from '@/lib/utils';

type SavingCardProps = {
  className?: string;
  decimalPlaces?: number;
  balance?: number;
  isBalanceLoading?: boolean;
  firstDepositTimestamp?: number;
  userDepositTransactions?: GetUserTransactionsQuery;
};

const SavingCard = memo(
  ({
    className,
    decimalPlaces,
    balance,
    isBalanceLoading = false,
    firstDepositTimestamp,
    userDepositTransactions,
  }: SavingCardProps) => {
    const router = useRouter();
    const { isScreenMedium } = useDimension();
    const { maxAPY, isAPYsLoading: isMaxAPYsLoading } = useMaxAPY();
    const { data: apys } = useAPYs();
    const [isHovered, setIsHovered] = useState(false);

    return (
      <Pressable
        onPress={() => router.push(path.SAVINGS)}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        className="flex-1"
      >
        <View
          className={cn(
            'rounded-twice overflow-hidden relative p-[30px] pb-[21px] justify-between w-full h-full',
            className,
          )}
        >
          {/* Base gradient */}

          {/* Lighter gradient (5%) revealed on hover */}
          <LinearGradient
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            colors={['rgba(156, 48, 235, 0.1)', 'rgba(156, 48, 235, 0.1)']}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 0,
              opacity: isHovered ? 1 : 0,
            }}
            className="transition-opacity duration-200"
          />
          <LinearGradient
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: -1 }}
          />
          <View className="relative flex-row justify-between items-center">
            <View className="flex-row items-center gap-2 opacity-50">
              <Leaf size={18} />
              <Text className="text-lg font-medium">Savings</Text>
            </View>

            <View className="flex-row items-center gap-2 pr-[5px]">
              {isMaxAPYsLoading ? (
                <Skeleton className="w-24 h-6 rounded-xl bg-purple/50" />
              ) : (
                <Text className="text-base text-brand font-semibold">
                  Earning {maxAPY ? `${formatNumber(maxAPY, 2)}%` : '0%'} yield
                </Text>
              )}
              <Ping />
            </View>
          </View>

          <View className="relative flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center">
                {isBalanceLoading || isMaxAPYsLoading || firstDepositTimestamp === undefined ? (
                  <Skeleton className="w-36 h-11 rounded-xl bg-purple/50" />
                ) : (
                  <SavingCountUp
                    prefix="$"
                    balance={balance ?? 0}
                    apy={apys?.allTime ?? 0}
                    lastTimestamp={firstDepositTimestamp ?? 0}
                    decimalPlaces={decimalPlaces}
                    userDepositTransactions={userDepositTransactions}
                    classNames={{
                      wrapper: 'text-foreground',
                      decimalSeparator: 'text-2xl md:text-3xl font-semibold',
                    }}
                    styles={{
                      wholeText: {
                        fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                        fontWeight: '500',
                        //fontFamily: 'MonaSans_600SemiBold',
                        color: '#ffffff',
                        marginRight: -1,
                      },
                      decimalText: {
                        fontSize: isScreenMedium ? fontSize(1.875) : fontSize(1.5),
                        fontWeight: '500',
                        //fontFamily: 'MonaSans_600SemiBold',
                        color: '#ffffff',
                      },
                    }}
                  />
                )}
              </View>
              <TooltipPopover text="Balance + Yield of soUSD" />
            </View>
            <Image
              source={require('@/assets/images/sousd-4x.png')}
              style={{ width: 28, height: 28 }}
            />
          </View>
        </View>
      </Pressable>
    );
  },
);

SavingCard.displayName = 'SavingCard';

export default SavingCard;
