import React from "react";
import { Address } from "viem";

import { WITHDRAW_MODAL } from "@/constants/modals";
import getTokenIcon from "@/lib/getTokenIcon";
import { useWithdrawStore } from "@/store/useWithdrawStore";
import { Withdraw, WithdrawTrigger } from ".";
import AnimatedModal from "../AnimatedModal";
import TransactionStatus from "../TransactionStatus";

const WithdrawModal = () => {
  const { currentModal, previousModal, setModal, transaction } = useWithdrawStore();

  const isTransactionStatus = currentModal.name === WITHDRAW_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === WITHDRAW_MODAL.CLOSE.name;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return "Withdraw";
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'withdraw-form';
  }

  const getContent = () => {
    if (isTransactionStatus) {
      return <TransactionStatus
        amount={transaction.amount ?? 0}
        onPress={() => setModal(WITHDRAW_MODAL.CLOSE)}
        token={"SoUSD"}
        icon={getTokenIcon({ tokenSymbol: 'SoUSD' })}
      />;
    }

    return <Withdraw />
  }

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setModal(WITHDRAW_MODAL.OPEN_FORM);
    } else {
      setModal(WITHDRAW_MODAL.CLOSE);
    }
  }

  return (
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={<WithdrawTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default WithdrawModal;
