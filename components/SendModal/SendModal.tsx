import React from "react";
import { Address } from "viem";

import { SEND_MODAL } from "@/constants/modals";
import { TokenIcon } from "@/lib/types";
import { useSendStore } from "@/store/useSendStore";
import { Send, SendTrigger } from ".";
import AnimatedModal from "../AnimatedModal";
import TransactionStatus from "../TransactionStatus";

type SendModalProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  tokenIcon: TokenIcon;
  tokenSymbol: string;
  chainId: number;
}

const SendModal = ({
  tokenAddress,
  tokenDecimals,
  tokenIcon,
  tokenSymbol,
  chainId,
}: SendModalProps) => {
  const { currentModal, previousModal, setModal, setCurrentTokenAddress, transaction, currentTokenAddress } = useSendStore();

  const isTransactionStatus = currentModal.name === SEND_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === SEND_MODAL.CLOSE.name;
  const isCurrentTokenAddress = currentTokenAddress === tokenAddress;

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return "Send";
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'send-form';
  }

  const getContent = () => {
    if (isTransactionStatus) {
      return <TransactionStatus
        amount={transaction.amount ?? 0}
        address={transaction.address}
        onPress={() => setModal(SEND_MODAL.CLOSE)}
        token={tokenSymbol}
        icon={tokenIcon}
      />;
    }

    return <Send
      tokenAddress={tokenAddress}
      tokenDecimals={tokenDecimals}
      chainId={chainId}
      tokenIcon={tokenIcon}
      tokenSymbol={tokenSymbol}
    />
  }

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setCurrentTokenAddress(tokenAddress);
      setModal(SEND_MODAL.OPEN_FORM);
    } else {
      setModal(SEND_MODAL.CLOSE);
    }
  }

  return (
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose && isCurrentTokenAddress}
      onOpenChange={handleOpenChange}
      trigger={<SendTrigger />}
      title={getTitle()}
      titleClassName="justify-center"
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default SendModal;
