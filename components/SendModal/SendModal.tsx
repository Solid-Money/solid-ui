import React from 'react';
import { useRouter } from 'expo-router';
import { Address } from 'viem';

import ResponsiveModal from '@/components/ResponsiveModal';
import TransactionStatus from '@/components/TransactionStatus';
import { SEND_MODAL } from '@/constants/modals';
import { TokenIcon } from '@/lib/types';
import { useSendStore } from '@/store/useSendStore';
import { Send, SendTrigger } from '.';
import { path } from '@/constants/path';
import { track } from '@/lib/firebase';

type SendModalProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  tokenIcon: TokenIcon;
  tokenSymbol: string;
  chainId: number;
};

const SendModal = ({
  tokenAddress,
  tokenDecimals,
  tokenIcon,
  tokenSymbol,
  chainId,
}: SendModalProps) => {
  const router = useRouter();

  const {
    currentModal,
    previousModal,
    setModal,
    setCurrentTokenAddress,
    transaction,
    currentTokenAddress,
  } = useSendStore();

  const isTransactionStatus = currentModal.name === SEND_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === SEND_MODAL.CLOSE.name;
  const isCurrentTokenAddress = currentTokenAddress === tokenAddress;

  const handleTransactionStatusPress = () => {
    track('send_transaction_status_pressed', {
      token_symbol: tokenSymbol,
      amount: transaction.amount,
    });
    setModal(SEND_MODAL.CLOSE);
    router.push(path.ACTIVITY);
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return 'Send';
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    return 'send-form';
  };

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          address={transaction.address}
          onPress={handleTransactionStatusPress}
          token={tokenSymbol}
          icon={tokenIcon}
        />
      );
    }

    return (
      <Send
        tokenAddress={tokenAddress}
        tokenDecimals={tokenDecimals}
        chainId={chainId}
        tokenIcon={tokenIcon}
        tokenSymbol={tokenSymbol}
      />
    );
  };

  const handleOpenChange = (value: boolean) => {
    if (value) {
      track('send_modal_opened', {
        token_symbol: tokenSymbol,
        token_address: tokenAddress,
        chain_id: chainId,
      });
      setCurrentTokenAddress(tokenAddress);
      setModal(SEND_MODAL.OPEN_FORM);
    } else {
      track('send_modal_closed', {
        token_symbol: tokenSymbol,
      });
      setModal(SEND_MODAL.CLOSE);
    }
  };

  return (
    <ResponsiveModal
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
    </ResponsiveModal>
  );
};

export default SendModal;
