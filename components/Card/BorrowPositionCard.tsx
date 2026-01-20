import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useReadContract } from 'wagmi';

import RepayToCardModal from '@/components/Card/RepayToCardModal';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { ADDRESSES } from '@/lib/config';
import { cn, formatNumber } from '@/lib/utils';

type BorrowPositionCardProps = {
  className?: string;
  variant?: 'mobile' | 'desktop';
};

export function BorrowPositionCard({ className, variant = 'mobile' }: BorrowPositionCardProps) {
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
      <View className={cn('rounded-2xl bg-[#1E1E1E] p-6', className)}>
        {/* Header Row */}
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="text-base font-medium text-white/70">Borrow position</Text>
          <Pressable onPress={() => setIsExpanded(!isExpanded)} className="flex-row items-center">
            <Text className="mr-2 text-base font-medium text-white/70">View breakdown</Text>
            {isExpanded ? (
              <ChevronUp color="#FFFFFF" size={16} />
            ) : (
              <ChevronDown color="#FFFFFF" size={16} />
            )}
          </Pressable>
        </View>

        {/* Main Content Row */}
        <View className="mb-4 flex-row items-center justify-between">
          {/* Total Borrowed */}
          <View className="flex-1">
            {isLoading ? (
              <View className="mb-1 h-8 w-20">
                <Skeleton className="h-full w-full rounded-md bg-white/10" />
              </View>
            ) : error ? (
              <Text className="mb-1 text-2xl font-semibold text-white">$0</Text>
            ) : (
              <Text className="mb-1 text-2xl font-semibold text-white">
                ${formatNumber(totalBorrowed, 2)}
              </Text>
            )}
            <Text className="text-base font-medium text-white/70">Total borrowed</Text>
          </View>

          {/* Net APY */}
          <View className="flex-1 items-center">
            {isLoading ? (
              <View className="mb-1 h-8 w-16">
                <Skeleton className="h-full w-full rounded-md bg-white/10" />
              </View>
            ) : error ? (
              <Text className="mb-1 text-2xl font-semibold text-white">0%</Text>
            ) : (
              <Text className="mb-1 text-2xl font-semibold text-white">
                {formatNumber(netAPY, 2)}%
              </Text>
            )}
            <Text className="text-base font-medium text-white/70">Net APY</Text>
          </View>

          {/* Repay Button */}
          <View className="flex-1 items-end">
            <RepayToCardModal
              trigger={
                <Button className="h-12 w-40 rounded-[13px] border-0 bg-[#303030]">
                  <Text className="text-base font-bold text-white">Repay</Text>
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
    <View className={cn('rounded-2xl bg-[#1E1E1E] p-5', className)}>
      {/* Header */}
      <Text className="mb-4 text-base font-medium text-white/70">Borrow position</Text>

      {/* Summary Section */}
      <View className="mb-4 flex-row justify-between">
        <View className="flex-1">
          {isLoading ? (
            <View className="mb-1 h-8 w-20">
              <Skeleton className="h-full w-full rounded-md bg-white/10" />
            </View>
          ) : error ? (
            <Text className="mb-1 text-2xl font-semibold text-white">$0</Text>
          ) : (
            <Text className="mb-1 text-2xl font-semibold text-white">
              ${formatNumber(totalBorrowed, 2)}
            </Text>
          )}
          <Text className="text-base font-medium text-white/70">Total borrowed</Text>
        </View>
        <View className="flex-1 items-end">
          {isLoading ? (
            <View className="mb-1 h-8 w-16">
              <Skeleton className="h-full w-full rounded-md bg-white/10" />
            </View>
          ) : error ? (
            <Text className="mb-1 text-2xl font-semibold text-white">0%</Text>
          ) : (
            <Text className="mb-1 text-2xl font-semibold text-white">
              {formatNumber(netAPY, 2)}%
            </Text>
          )}
          <Text className="text-base font-medium text-white/70">Net APY</Text>
        </View>
      </View>

      {/* Divider */}
      <View className="mb-4 h-px w-full bg-white/10" />

      {/* Breakdown Section (Collapsible) */}
      {isExpanded && <BreakdownSection />}

      {/* View Breakdown Toggle */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="mb-4 flex-row items-center justify-center"
      >
        <Text className="mr-2 text-base font-medium text-white">View breakdown</Text>
        {isExpanded ? (
          <ChevronUp color="#FFFFFF" size={16} />
        ) : (
          <ChevronDown color="#FFFFFF" size={16} />
        )}
      </Pressable>

      {/* Repay Button */}
      <RepayToCardModal />
    </View>
  );
}
