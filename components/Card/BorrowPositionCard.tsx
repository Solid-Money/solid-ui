import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import DepositToCardModal from '@/components/Card/DepositToCardModal';
import RepayToCardModal from '@/components/Card/RepayToCardModal';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { cn, formatNumber } from '@/lib/utils';

type BorrowPositionCardProps = {
  className?: string;
  variant?: 'mobile' | 'desktop';
  style?: any;
};

export function BorrowPositionCard({
  className,
  variant = 'mobile',
  style,
}: BorrowPositionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { totalBorrowed, totalSupplied, borrowAPY, savingsAPY, netAPY, isLoading, error } =
    useAaveBorrowPosition();
  const { data: rate } = useReadContract({
    address: ADDRESSES.ethereum.accountant,
    abi: [
      {
        inputs: [],
        name: 'getRate',
        outputs: [{ internalType: 'uint256', name: 'rate', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getRate',
    chainId: mainnet.id,
  });

  const isDesktop = variant === 'desktop';

  // Shared breakdown section component
  const BreakdownSection = () => (
    <View className={cn(isDesktop ? 'mt-4 border-t border-white/10 pt-4' : 'mb-4')}>
      {/* Borrow APR */}
      <View className="mb-4 flex-row justify-between">
        <Text className="text-base font-medium text-white/70">Borrow APR</Text>
        {isLoading ? (
          <Skeleton className="h-5 w-12 rounded-md bg-white/10" />
        ) : (
          <Text className="text-base font-bold text-white">{formatNumber(borrowAPY, 2)}%</Text>
        )}
      </View>
      <View className="mb-4 h-px w-full bg-white/10" />

      {/* Savings APY */}
      <View className="mb-4 flex-row justify-between">
        <Text className="text-base font-medium text-white/70">Savings APY</Text>
        {isLoading ? (
          <Skeleton className="h-5 w-12 rounded-md bg-white/10" />
        ) : (
          <Text className="text-base font-bold text-white">{formatNumber(savingsAPY, 2)}%</Text>
        )}
      </View>
      <View className="mb-4 h-px w-full bg-white/10" />

      {/* Cashback APY */}
      <View className="mb-4 flex-row justify-between">
        <Text className="text-base font-medium text-white/70">Collateral Required</Text>
        {isLoading ? (
          <Skeleton className="h-5 w-12 rounded-md bg-white/10" />
        ) : (
          <Text className="text-base font-bold text-white">
            ${formatNumber(totalSupplied * Number(formatUnits(rate || 0n, 6)))}
          </Text>
        )}
      </View>
      {!isDesktop && <View className="mb-4 h-px w-full bg-white/10" />}
    </View>
  );

  // Desktop layout
  if (isDesktop) {
    return (
      <View style={style} className={cn('rounded-2xl bg-[#1C1C1C] p-6', className)}>
        {/* Header Row */}
        <View className="mb-10 flex-row items-center justify-between">
          <Text className="text-base font-medium text-white/70">Borrow position</Text>
          <Pressable onPress={() => setIsExpanded(!isExpanded)} className="flex-row items-center">
            <Text className="mr-2 text-base font-medium text-white">View breakdown</Text>
            {isExpanded ? (
              <ChevronUp color="#FFFFFF" size={16} />
            ) : (
              <ChevronDown color="#FFFFFF" size={16} />
            )}
          </Pressable>
        </View>

        {/* Main Content Row */}
        <View className="flex-row items-center justify-between">
          {/* Stats Group */}
          <View className="flex-[3] flex-row">
            {/* Total Borrowed */}
            <View className="flex-1">
              {isLoading ? (
                <View className="mb-1 h-8 w-20">
                  <Skeleton className="h-full w-full rounded-md bg-white/10" />
                </View>
              ) : error ? (
                <Text className="mb-1 text-3xl font-semibold text-white">$0</Text>
              ) : (
                <Text className="mb-1 text-3xl font-semibold text-white">
                  ${formatNumber(totalBorrowed, 0)}
                </Text>
              )}
              <Text className="text-base font-medium text-white/70">Total borrowed</Text>
            </View>

            {/* Net APY */}
            <View className="flex-1 items-start">
              {isLoading ? (
                <View className="mb-1 h-8 w-16">
                  <Skeleton className="h-full w-full rounded-md bg-white/10" />
                </View>
              ) : error ? (
                <Text className="mb-1 text-3xl font-semibold text-white">0%</Text>
              ) : (
                <Text className="mb-1 text-3xl font-semibold text-white">
                  {formatNumber(netAPY, 2)}%
                </Text>
              )}
              <View className="flex-row items-center gap-1">
                <Text className="text-base font-medium text-white/70">Net APY earned</Text>
                <View className="mt-1">
                  <TooltipPopover
                    text="This is the yield you will earn on your borrowed savings balance"
                    analyticsContext="borrow_position_net_apy"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-[2] flex-row items-center justify-end gap-3">
            <RepayToCardModal
              trigger={
                <Button
                  variant="secondary"
                  className="h-12 flex-1 rounded-xl border-0 bg-[#303030]"
                >
                  <View className="flex-row items-center gap-3">
                    <Image
                      source={getAsset('images/repay.png')}
                      style={{ width: 16, height: 14 }}
                      contentFit="contain"
                    />
                    <Text className="text-base font-bold text-white">Repay</Text>
                  </View>
                </Button>
              }
            />
            <DepositToCardModal
              trigger={
                <Button
                  variant="secondary"
                  className="h-12 flex-1 rounded-xl border-0 bg-[#303030]"
                >
                  <View className="flex-row items-center gap-2">
                    <Plus size={20} color="white" />
                    <Text className="text-base font-bold text-white">Borrow</Text>
                  </View>
                </Button>
              }
            />
          </View>
        </View>

        {/* Breakdown Section (Collapsible) */}
        {isExpanded && <BreakdownSection />}
      </View>
    );
  }

  // Mobile layout
  return (
    <View style={style} className={cn('rounded-[20px] bg-[#1C1C1C] p-6', className)}>
      {/* Summary Section */}
      <View className="mb-6 flex-row items-end justify-between">
        <View className="flex-1">
          <Text className="mb-4 text-lg font-medium text-white/70">Borrow position</Text>
          {isLoading ? (
            <View className="mb-1 h-8 w-20">
              <Skeleton className="h-full w-full rounded-md bg-white/10" />
            </View>
          ) : error ? (
            <Text className="mb-1 text-3xl font-semibold text-white">$0</Text>
          ) : (
            <Text className="mb-1 text-3xl font-semibold text-white">
              ${formatNumber(totalBorrowed, 0)}
            </Text>
          )}
          <Text className="text-base font-medium text-white/70">Total borrowed</Text>
        </View>
        <View className="flex-1 items-start">
          {isLoading ? (
            <View className="mb-1 h-8 w-16">
              <Skeleton className="h-full w-full rounded-md bg-white/10" />
            </View>
          ) : error ? (
            <Text className="mb-1 text-3xl font-semibold text-white">0%</Text>
          ) : (
            <Text className="mb-1 text-3xl font-semibold text-white">
              {formatNumber(netAPY, 2)}%
            </Text>
          )}
          <View className="flex-row items-center gap-1">
            <Text className="text-base font-medium text-white/70">Net APY earned</Text>
            <View className="mt-1">
              <TooltipPopover
                text="This is the yield you will earn on your borrowed savings balance"
                analyticsContext="borrow_position_net_apy"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View className="-mx-6 mb-5 h-px bg-white/10" />

      {/* Breakdown Trigger */}
      <View className="mb-6 items-center">
        <Pressable onPress={() => setIsExpanded(!isExpanded)} className="flex-row items-center">
          <Text className="mr-2 text-lg font-medium text-white">View breakdown</Text>
          {isExpanded ? (
            <ChevronUp color="#FFFFFF" size={20} />
          ) : (
            <ChevronDown color="#FFFFFF" size={20} />
          )}
        </Pressable>
      </View>

      {/* Breakdown Section (Collapsible) */}
      {isExpanded && <BreakdownSection />}

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        <RepayToCardModal
          trigger={
            <Button
              variant="secondary"
              className="h-14 flex-1 rounded-2xl border-0 bg-[#262626] px-6"
            >
              <View className="flex-row items-center gap-2">
                <Image
                  source={getAsset('images/repay.png')}
                  style={{ width: 12, height: 12 }}
                  contentFit="contain"
                />
                <Text className="text-base font-bold text-white">Repay</Text>
              </View>
            </Button>
          }
        />
        <DepositToCardModal
          trigger={
            <Button
              variant="secondary"
              className="h-14 flex-1 rounded-2xl border-0 bg-[#262626] px-6"
            >
              <View className="flex-row items-center gap-2">
                <Plus size={24} color="white" />
                <Text className="text-base font-bold text-white">Borrow</Text>
              </View>
            </Button>
          }
        />
      </View>
    </View>
  );
}
