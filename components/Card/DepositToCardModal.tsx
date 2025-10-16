import { useRouter } from 'expo-router';
import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import getTokenIcon from '@/lib/getTokenIcon';
import { useCardDepositStore } from '@/store/useCardDepositStore';
import CardDepositExternal from './CardDepositExternal';
import CardDepositInternalForm from './CardDepositInternalForm';
import CardDepositOptions from './CardDepositOptions';

const Trigger = () => (
  <Button className="rounded-xl h-12 px-6" style={{ backgroundColor: '#94F27F' }}>
    <Text className="text-black font-bold">Add funds</Text>
  </Button>
);

export default function DepositToCardModal({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const { currentModal, previousModal, setModal, transaction } = useCardDepositStore();

  const isClose = currentModal.name === CARD_DEPOSIT_MODAL.CLOSE.name;
  const isOptions = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_OPTIONS.name;
  const isInternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM.name;
  const isExternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM.name;
  const isTransactionStatus = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;

  const handleTransactionStatusPress = () => {
    setModal(CARD_DEPOSIT_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Deposit to Card';
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isOptions) return 'options';
    if (isInternal) return 'internal';
    if (isExternal) return 'external';
    return 'options';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          onPress={handleTransactionStatusPress}
          token="USDC"
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
          title="Card deposit initiated"
          description="Your deposit is being processed. This may take a few minutes."
          status="Processing"
        />
      );
    }
    if (isOptions) return <CardDepositOptions />;
    if (isInternal) return <CardDepositInternalForm />;
    if (isExternal) return <CardDepositExternal />;
    return <CardDepositOptions />;
  };

  const handleOpenChange = (value: boolean) => {
    if (value) setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS);
    else setModal(CARD_DEPOSIT_MODAL.CLOSE);
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={trigger ?? <Trigger />}
      title={getTitle()}
      titleClassName={isOptions ? 'justify-start' : undefined}
      containerClassName={'min-h-[36rem] overflow-y-auto flex-1'}
      contentKey={getContentKey()}
      showBackButton={!isOptions && !isTransactionStatus}
      onBackPress={() => setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS)}
    >
      {getContent()}
    </ResponsiveModal>
  );
}
