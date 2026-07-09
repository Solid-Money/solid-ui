import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_REPAY_MODAL, CREDIT_LINE_MODAL } from '@/constants/modals';
import { formatNumber } from '@/lib/utils';
import { useCardRepayStore } from '@/store/useCardRepayStore';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { CreditLineLayout, DetailCard, formatNetRate, HealthyBadge } from './CreditLineShared';
import { useCreditLine } from './useCreditLine';

/** Active borrow position overview (Repay / Borrow More). */
export default function CreditLinePosition() {
  const { totalBorrowed, totalSupplied, borrowAPY, savingsAPY, netAPY, exchangeRate, isLoading } =
    useCreditLine();
  const setCreditModal = useCreditLineStore(state => state.setModal);
  const setRepayModal = useCardRepayStore(state => state.setModal);

  const collateralUsd = totalSupplied * exchangeRate;

  const handleRepay = () => {
    setCreditModal(CREDIT_LINE_MODAL.CLOSE);
    setRepayModal(CARD_REPAY_MODAL.OPEN_FORM);
  };
  const handleBorrowMore = () => setCreditModal(CREDIT_LINE_MODAL.OPEN_FORM);

  return (
    <CreditLineLayout
      bodyClassName="gap-6"
      footer={
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-2xl border-0 bg-[#262626]"
            onPress={handleRepay}
          >
            <Text className="native:text-lg text-base font-bold text-white">Repay</Text>
          </Button>
          <Button variant="brand" className="h-12 flex-1 rounded-2xl" onPress={handleBorrowMore}>
            <Text className="native:text-lg text-base font-bold text-black">Borrow More</Text>
          </Button>
        </View>
      }
    >
      <View className="items-center gap-1">
        <Text className="text-[50px] font-semibold text-white">
          ${formatNumber(totalBorrowed, 0)}
        </Text>
        <Text className="text-base text-white/50">Total borrowed</Text>
      </View>

      <Text className="text-center text-sm text-white/60">
        You&apos;re earning more than this loan costs — your savings keep working while you borrow.
      </Text>

      <DetailCard
        rows={[
          { label: 'Borrow rate', value: `${formatNumber(borrowAPY, 2)}%`, loading: isLoading },
          { label: 'Savings rate', value: `${formatNumber(savingsAPY, 2)}%`, loading: isLoading },
          {
            label: 'Net rate',
            tooltip: 'This is the yield you will earn on your borrowed savings balance',
            value: formatNetRate(netAPY),
            valueClassName: 'text-brand',
            loading: isLoading,
          },
          {
            label: 'Collateral Required',
            value: `$${formatNumber(collateralUsd)}`,
            loading: isLoading,
          },
        ]}
      />

      <HealthyBadge healthy={netAPY >= 0} />
    </CreditLineLayout>
  );
}
