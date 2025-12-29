import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import React, { useState } from 'react';
import { erc20Abi, TransactionReceipt } from 'viem';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { TotpVerificationModal } from '@/components/TotpVerificationModal';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { track } from '@/lib/analytics';
import { getTotpStatus, verifyTotp } from '@/lib/api';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TokenType, TransactionType } from '@/lib/types';
import { getChain } from '@/lib/wagmi';
import useUser from './useUser';

type SendProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  tokenSymbol: string;
  chainId: number;
  tokenType: TokenType;
};

type SendResult = {
  send: (amount: string, to: Address) => Promise<TransactionReceipt>;
  sendStatus: Status;
  error: string | null;
  resetSendStatus: () => void;
  totpModal: React.ReactNode;
};

const useSend = ({
  tokenAddress,
  tokenDecimals,
  chainId,
  tokenSymbol,
  tokenType,
}: SendProps): SendResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivity();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpVerificationPromise, setTotpVerificationPromise] = useState<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const chain = getChain(chainId);

  const send = async (amount: string, to: Address) => {
    try {
      if (!user) {
        throw new Error('User not found');
      }

      if (!chain) {
        throw new Error('Chain not found');
      }

      track(TRACKING_EVENTS.SEND_TRANSACTION_INITIATED, {
        token_address: tokenAddress,
        chain_id: chainId,
        amount: amount,
        to_address: to,
        source: 'send_hook',
      });

      setSendStatus(Status.PENDING);
      setError(null);

      const amountWei = parseUnits(amount, tokenDecimals);

      const transactions =
        tokenType === TokenType.NATIVE
          ? [
              {
                to: to,
                data: '0x' as const,
                value: amountWei,
              },
            ]
          : [
              {
                to: tokenAddress,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: 'transfer',
                  args: [to, amountWei],
                }),
                value: 0n,
              },
            ];

      // Check if TOTP is enabled
      let requiresTotp = false;
      try {
        const totpStatus = await getTotpStatus();
        requiresTotp = totpStatus.verified;
      } catch (err) {
        // If TOTP check fails, assume it's not enabled
        console.error('Failed to check TOTP status:', err);
      }

      const smartAccountClient = await safeAA(chain, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.SEND,
          title: `Send ${amount} ${tokenSymbol}`,
          shortTitle: `Send ${amount}`,
          amount,
          symbol: tokenSymbol,
          chainId,
          fromAddress: user.safeAddress,
          toAddress: to,
          metadata: {
            description: `Send ${amount} ${tokenSymbol} to ${to}`,
            tokenAddress,
            tokenDecimals: tokenDecimals.toString(),
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Send failed',
            chain,
            onUserOpHash,
            requiresTotp
              ? async () => {
                  // Show TOTP modal and wait for verification
                  return new Promise<void>((resolve, reject) => {
                    setTotpVerificationPromise({ resolve, reject });
                    setShowTotpModal(true);
                  });
                }
              : undefined,
          ),
      );

      // Extract transaction from result
      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        throw new Error('User cancelled transaction');
      }

      track(TRACKING_EVENTS.SEND_TRANSACTION_COMPLETED, {
        token_address: tokenAddress,
        chain_id: chainId,
        amount: amount,
        to_address: to,
        transaction_hash: transaction.transactionHash,
        source: 'send_hook',
      });

      setSendStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.SEND_TRANSACTION_ERROR, {
        token_address: tokenAddress,
        chain_id: chainId,
        amount: amount,
        to_address: to,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
      });

      Sentry.captureException(error, {
        tags: {
          type: 'send_transaction_error',
          chainId: chainId.toString(),
          userId: user?.userId,
        },
        extra: {
          tokenAddress,
          amount,
          to,
          tokenDecimals,
        },
        user: {
          id: user?.userId,
          address: user?.safeAddress,
        },
      });
      setSendStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  const resetSendStatus = () => {
    setSendStatus(Status.IDLE);
    setError(null);
  };

  const handleTotpVerify = async (code: string) => {
    try {
      await verifyTotp(code, 'transaction');
      setShowTotpModal(false);
      if (totpVerificationPromise) {
        totpVerificationPromise.resolve();
        setTotpVerificationPromise(null);
      }
    } catch (err) {
      if (totpVerificationPromise) {
        totpVerificationPromise.reject(
          err instanceof Error ? err : new Error('TOTP verification failed'),
        );
        setTotpVerificationPromise(null);
      }
      throw err;
    }
  };

  const handleTotpCancel = () => {
    setShowTotpModal(false);
    if (totpVerificationPromise) {
      totpVerificationPromise.reject(new Error('User cancelled TOTP verification'));
      setTotpVerificationPromise(null);
    }
  };

  return {
    send,
    sendStatus,
    error,
    resetSendStatus,
    totpModal: React.createElement(TotpVerificationModal, {
      open: showTotpModal,
      onOpenChange: setShowTotpModal,
      onVerify: handleTotpVerify,
      onCancel: handleTotpCancel,
    }),
  };
};

export default useSend;
