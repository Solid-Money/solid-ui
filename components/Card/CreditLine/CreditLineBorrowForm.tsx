import { useState } from 'react';

import { BorrowSlider } from '@/components/Card/BorrowSlider';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { formatNumber } from '@/lib/utils';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { BorrowDetailsCard, CreditLineLayout, NeedHelp } from './CreditLineShared';
import { useCreditLine } from './useCreditLine';

/** Borrow amount slider + live cost breakdown. "Continue" → confirm screen. */
export default function CreditLineBorrowForm() {
  const { maxBorrow, savingsUsd } = useCreditLine();
  const setModal = useCreditLineStore(state => state.setModal);
  const setTransaction = useCreditLineStore(state => state.setTransaction);
  const initialAmount = useCreditLineStore(state => state.transaction.amount);

  const [amount, setAmount] = useState(() => initialAmount ?? 0);

  const canContinue = amount > 0 && amount <= maxBorrow;

  const handleContinue = () => {
    if (!canContinue) return;
    setTransaction({ amount });
    setModal(CREDIT_LINE_MODAL.OPEN_CONFIRM);
  };

  return (
    <CreditLineLayout
      bodyClassName="gap-6"
      footer={
        <>
          <Button
            variant="brand"
            className="h-12 rounded-2xl"
            disabled={!canContinue}
            onPress={handleContinue}
          >
            <Text className="native:text-lg text-base font-bold text-black">Continue</Text>
          </Button>
          <NeedHelp />
        </>
      }
    >
      <BorrowSlider value={amount} onValueChange={setAmount} min={0} max={maxBorrow} />

      <BorrowDetailsCard amount={amount} />

      <Text className="text-sm text-white/50">
        Your ${formatNumber(savingsUsd, 0)} in savings stays invested.
      </Text>
    </CreditLineLayout>
  );
}
