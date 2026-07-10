import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { useAaveBorrowPosition } from '@/hooks/useAaveBorrowPosition';
import { cn, formatNumber } from '@/lib/utils';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { formatNetRate } from './CreditLineShared';

/**
 * Credit line entry card for the card details screen. Users with an active
 * borrow see the position card; everyone else sees the promo card. Both open
 * the credit line modal, which routes to the right screen based on the user's
 * savings / borrow state.
 */
export function CreditLineCards({ className }: { className?: string }) {
  const setModal = useCreditLineStore(state => state.setModal);
  const { totalBorrowed, netAPY } = useAaveBorrowPosition();

  const openCreditLine = () => setModal(CREDIT_LINE_MODAL.OPEN_HOME);
  const hasPosition = totalBorrowed > 0;

  return (
    <View className={cn('gap-4 md:flex-row', className)}>
      {hasPosition ? (
        <PositionCard totalBorrowed={totalBorrowed} netAPY={netAPY} onPress={openCreditLine} />
      ) : (
        <PromoCard onPress={openCreditLine} />
      )}
    </View>
  );
}

function PromoCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="gap-4 rounded-[20px] bg-[#1C1C1C] p-6 web:hover:bg-[#232323] md:flex-1"
    >
      <View className="gap-1">
        <Text className="text-base text-white/50">Credit line</Text>
        <Text className="text-2xl font-semibold text-brand">Borrow against your savings</Text>
      </View>
      <Text className="text-sm text-white/50">
        Receive dollars immediately while your savings funds keep earning
      </Text>
      <View className="flex-row items-center gap-1">
        <Text className="text-base font-bold text-white">Start borrowing</Text>
        <ChevronRight color="white" size={18} />
      </View>
    </Pressable>
  );
}

function PositionCard({
  totalBorrowed,
  netAPY,
  onPress,
}: {
  totalBorrowed: number;
  netAPY: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="gap-4 rounded-[20px] bg-[#1C1C1C] p-6 web:hover:bg-[#232323] md:flex-1"
    >
      <Text className="text-base text-white/50">Credit line</Text>
      <View className="flex-row md:flex-1 md:items-center">
        <View className="flex-1 gap-1">
          <Text className="text-3xl font-semibold text-white">
            ${formatNumber(totalBorrowed, 0)}
          </Text>
          <Text className="text-base text-white/50">Total borrowed</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-3xl font-semibold text-brand">{formatNetRate(netAPY)}</Text>
          <Text className="text-base text-white/50">Net rate</Text>
        </View>
      </View>
    </Pressable>
  );
}
