import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { fuse } from 'viem/chains';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { USDC_STARGATE } from '@/constants/addresses';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import useBorrowAndDepositToCard from '@/hooks/useBorrowAndDepositToCard';
import { useCardContracts } from '@/hooks/useCardContracts';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { getCardFundingAddress } from '@/lib/utils';
import { CardDepositSource } from '@/store/useCardDepositStore';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { BorrowDetailsCard, CreditLineLayout, HealthyBadge } from './CreditLineShared';
import { useCreditLine } from './useCreditLine';

/** Review the borrow, then "Confirm & get dollars" (borrow + bridge to card). */
export default function CreditLineConfirm() {
  const { user } = useUser();
  const { createActivity, updateActivity } = useActivityActions();
  const { data: cardDetails } = useCardDetails();
  const { provider } = useCardProvider();
  const { data: contracts } = useCardContracts();
  const { borrowAndDeposit, bridgeStatus } = useBorrowAndDepositToCard();
  const { netAPY, collateralRequired, borrowAPY } = useCreditLine();

  const amount = useCreditLineStore(state => state.transaction.amount) ?? 0;
  const setModal = useCreditLineStore(state => state.setModal);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPending = isSubmitting || bridgeStatus === Status.PENDING;

  const handleConfirm = async () => {
    if (!user || !amount) return;

    track(TRACKING_EVENTS.CARD_DEPOSIT_INTERNAL_SUBMITTED, {
      source_type: CardDepositSource.BORROW,
      amount,
      estimated_usdc_output: amount,
      collateral_required: collateralRequired(amount),
      borrow_apy: borrowAPY,
    });

    if (!cardDetails) {
      Toast.show({
        type: 'error',
        text1: 'Card details not found',
        text2: 'Please try again later',
      });
      return;
    }

    const fundingAddress = getCardFundingAddress(cardDetails, provider, contracts ?? undefined);
    if (!fundingAddress) {
      Toast.show({
        type: 'error',
        text1: 'Deposits not available',
        text2: 'This card does not support deposits to the funding chain',
        props: { badgeText: '' },
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const amountStr = String(amount);
      const clientTxId = await createActivity({
        type: TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
        title: 'Borrow and deposit to Card',
        shortTitle: 'Borrow and deposit to Card',
        amount: amountStr,
        symbol: 'USDC',
        chainId: fuse.id,
        fromAddress: user.safeAddress,
        toAddress: fundingAddress,
        status: TransactionStatus.PENDING,
        metadata: {
          description: `Borrow and deposit ${amountStr} USDC to card`,
          processingStatus: 'bridging',
          tokenAddress: USDC_STARGATE,
        },
      });

      const tx = await borrowAndDeposit(amountStr);

      await updateActivity(clientTxId, {
        status: TransactionStatus.PENDING,
        hash: tx.transactionHash,
        url: `https://layerzeroscan.com/tx/${tx.transactionHash}`,
        metadata: { txHash: tx.transactionHash, processingStatus: 'awaiting_bridge' },
      });

      setModal(CREDIT_LINE_MODAL.OPEN_SUCCESS);
    } catch (error) {
      console.error('Borrow error:', error);
      Toast.show({
        type: 'error',
        text1: 'Borrow failed',
        text2: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreditLineLayout
      bodyClassName="gap-6"
      footer={
        <Button
          variant="brand"
          className="h-12 rounded-2xl"
          disabled={isPending || !amount}
          onPress={handleConfirm}
        >
          {isPending ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="native:text-lg text-base font-bold text-black">
              Confirm &amp; get dollars
            </Text>
          )}
        </Button>
      }
    >
      <BorrowDetailsCard amount={amount} />

      <HealthyBadge healthy={netAPY >= 0} />
    </CreditLineLayout>
  );
}
