import React from 'react';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD_DEPOSIT_MODAL } from '@/constants/modals';
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
  const { currentModal, previousModal, setModal } = useCardDepositStore();

  const isClose = currentModal.name === CARD_DEPOSIT_MODAL.CLOSE.name;
  const isOptions = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_OPTIONS.name;
  const isInternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_INTERNAL_FORM.name;
  const isExternal = currentModal.name === CARD_DEPOSIT_MODAL.OPEN_EXTERNAL_FORM.name;

  const getTitle = () => {
    return 'Deposit to Card';
  };

  const getContentKey = () => {
    if (isOptions) return 'options';
    if (isInternal) return 'internal';
    if (isExternal) return 'external';
    return 'options';
  };

  const getContent = () => {
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
      containerClassName={'min-h-[36rem] flex-1'}
      contentKey={getContentKey()}
      showBackButton={!isOptions}
      onBackPress={() => setModal(CARD_DEPOSIT_MODAL.OPEN_OPTIONS)}
    >
      {getContent()}
    </ResponsiveModal>
  );
}
