import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/utils';
import RepayToCardModal from '@/components/Card/RepayToCardModal';

type BorrowPositionCardProps = {
    className?: string;
}

export function BorrowPositionCard({ className }: BorrowPositionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View className={cn('rounded-2xl bg-[#1E1E1E] p-5', className)}>
      {/* Header */}
      <Text className="mb-4 text-base font-medium text-white/70">Borrow position</Text>

      {/* Summary Section */}
      <View className="mb-4 flex-row justify-between">
        <View className="flex-1">
          <Text className="mb-1 text-2xl font-semibold text-white">$342</Text>
          <Text className="text-base font-medium text-white/70">Total borrowed</Text>
        </View>
        <View className="flex-1 items-end">
          <Text className="mb-1 text-2xl font-semibold text-white">4%</Text>
          <Text className="text-base font-medium text-white/70">Net APY</Text>
        </View>
      </View>

      {/* Divider */}
      <View className="mb-4 h-px w-full bg-white/10" />

      {/* Breakdown Section (Collapsible) */}
      {isExpanded && (
        <View className="mb-4">
          {/* Borrow APY */}
          <View className="mb-4 flex-row justify-between">
            <Text className="text-base font-medium text-white/70">Borrow APY</Text>
            <Text className="text-base font-bold text-white">4%</Text>
          </View>
          <View className="mb-4 h-px w-full bg-white/10" />

          {/* Savings APY */}
          <View className="mb-4 flex-row justify-between">
            <Text className="text-base font-medium text-white/70">Savings APY</Text>
            <Text className="text-base font-bold text-white">6%</Text>
          </View>
          <View className="mb-4 h-px w-full bg-white/10" />

          {/* Cashback APY */}
          <View className="mb-4 flex-row justify-between">
            <Text className="text-base font-medium text-white/70">Cashback APY</Text>
            <Text className="text-base font-bold text-white">6%</Text>
          </View>
          <View className="mb-4 h-px w-full bg-white/10" />
        </View>
      )}

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
