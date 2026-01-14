import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
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
import { getAsset } from '@/lib/assets';
import { cn, fontSize, formatNumber } from '@/lib/utils';

import SavingsIcon from '@/assets/images/savings';

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
        className={className}
      >
        <View
          className={cn(
            'relative h-full w-full justify-between overflow-hidden rounded-twice p-[30px] pb-[21px]',
          )}
        >
          {/* Base gradient */}

          {/* Lighter gradient (5%) revealed on hover */}
          <LinearGradient
            colors={['rgba(122, 84, 234, 0.1)', 'rgba(122, 84, 234, 0.1)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.6, y: 1 }}
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
            colors={['rgba(122, 84, 234, 1)', 'rgba(122, 84, 234, 0.5)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: -1,
              opacity: 0.3,
            }}
          />
          <View className="relative flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 opacity-50">
              <SavingsIcon />
              <Text className="text-lg font-medium">Savings</Text>
            </View>

            <View className="flex-row items-center gap-2 pr-[5px]">
              {isMaxAPYsLoading ? (
                <Skeleton className="h-6 w-24 rounded-xl bg-purple/50" />
              ) : isScreenMedium ? (
                <Text className="text-sm font-semibold text-brand md:text-base">
                  Earning {maxAPY ? `${formatNumber(maxAPY, 2)}%` : '0%'} yield
                </Text>
              ) : (
                <Text className="text-sm font-semibold text-brand md:text-base">
                  {maxAPY ? `${formatNumber(maxAPY, 2)}%` : '0%'} APY
                </Text>
              )}
              <Ping />
            </View>
          </View>

          <View className="relative flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center">
                {isBalanceLoading || isMaxAPYsLoading || firstDepositTimestamp === undefined ? (
                  <Skeleton className="h-11 w-36 rounded-xl bg-purple/50" />
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
              source={getAsset('images/sousd-4x.png')}
              style={{ width: 28, height: 28 }}
              alt="soUSD token"
            />
          </View>
        </View>
      </Pressable>
    );
  },
);

SavingCard.displayName = 'SavingCard';

export default SavingCard;
