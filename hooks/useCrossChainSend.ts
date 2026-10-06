import React, { useState } from 'react';
import Toast from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import { Address } from 'viem';
import { fuse } from 'viem/chains';

import { TotpVerificationModal } from '@/components/TotpVerificationModal';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track } from '@/lib/analytics';
import { getTotpStatus, verifyTotp } from '@/lib/api';
import { authoriseCrossChainSend } from '@/lib/api/cross-chain-send';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';
import {
  CrossChainSendAuthorised,
  CrossChainSendQuote,
  CrossChainSendRecord,
  CrossChainSendToken,
} from '@/lib/types/cross-chain-send';
import { withRefreshToken } from '@/lib/utils';
import { formatLD } from '@/lib/utils/cross-chain-send';
import { buildCrossChainSendCalls } from '@/lib/utils/cross-chain-send-calls';
import { useSendStore } from '@/store/useSendStore';

import useUser from './useUser';

type SendParams = {
  token: CrossChainSendToken;
  tokenAddress: Address;
  dstChainId: number;
  networkName: string;
  recipient: Address;
  exchange: string;
  /** Human amount as typed ("100.5"); the quote carries the base units. */
  amount: string;
  quote: CrossChainSendQuote;
};

export type CrossChainSendResult =
  | { status: 'sent'; send: CrossChainSendRecord; transactionHash: string }
  | { status: 'requote'; quote: CrossChainSendQuote; reason: string };

/** Thrown when the paymaster rejects a voucher the quote no longer covers. */
export class CrossChainSendQuoteExpiredError extends Error {
  constructor() {
    super('The quote expired. Please review again.');
    this.name = 'CrossChainSendQuoteExpiredError';
  }
}

const QUOTE_EXPIRED_REVERTS = ['NativeFeeAboveVoucher', 'VoucherExpired'];

const toRecord = (
  send: CrossChainSendAuthorised,
  params: SendParams,
  status: CrossChainSendRecord['status'],
): CrossChainSendRecord => ({
  sendId: send.sendId,
  status,
  token: params.token,
  dstChainId: params.dstChainId,
  recipient: params.recipient,
  exchange: params.exchange,
  amountLD: send.quote.amountLD,
  feeLD: send.quote.feeLD,
  bridgeFeeLD: send.quote.bridgeFeeLD,
  amountReceivedLD: send.quote.amountReceivedLD,
  minAmountLD: send.quote.minAmountLD,
  etaMinutes: send.quote.etaMinutes,
  createdAt: new Date().toISOString(),
  deadline: send.voucher.deadline,
});

/**
 * Execute a cross-chain send: authorise the voucher with the backend, then
 * approve the BridgePaymaster and call `bridgeSend` in one user operation.
 * Mirrors `useSend` for the user/safe/TOTP/tracking plumbing; the activity is
 * created under the backend's `sendId` so its tracker and ours are one row.
 */
const useCrossChainSend = () => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [sendStatus, setSendStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpVerificationPromise, setTotpVerificationPromise] = useState<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);

  const send = async (params: SendParams): Promise<CrossChainSendResult> => {
    const { setCrossChainSend, setModal } = useSendStore.getState();
    const analyticsContext = {
      token: params.token,
      dst_chain_id: params.dstChainId,
      exchange: params.exchange,
      amount: params.amount,
      to_address: params.recipient,
    };

    try {
      if (!user) {
        throw new Error('User not found');
      }

      setSendStatus(Status.PENDING);
      setError(null);

      const authorised = await withRefreshToken(() =>
        authoriseCrossChainSend({
          token: params.token,
          dstChainId: params.dstChainId,
          recipient: params.recipient,
          exchange: params.exchange,
          amountLD: params.quote.amountLD,
          expectedAmountReceivedLD: params.quote.amountReceivedLD,
          quoteId: params.quote.quoteId,
        }),
      );

      if (authorised.status === 'requote') {
        setSendStatus(Status.IDLE);
        return { status: 'requote', quote: authorised.quote, reason: authorised.reason };
      }

      const { send: authorisedSend } = authorised;
      setCrossChainSend(toRecord(authorisedSend, params, 'authorised'));
      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_AUTHORISED, {
        ...analyticsContext,
        send_id: authorisedSend.sendId,
      });

      const { voucher } = authorisedSend;
      const transactions = buildCrossChainSendCalls(authorisedSend);

      let requiresTotp = false;
      try {
        const totpStatus = await getTotpStatus();
        requiresTotp = totpStatus.verified;
      } catch (err) {
        // If TOTP check fails, assume it's not enabled
        console.error('Failed to check TOTP status:', err);
      }

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const amountLabel = `${formatLD(voucher.amountLD)} ${params.token}`;

      const result = await trackTransaction(
        {
          type: TransactionType.CROSS_CHAIN_SEND,
          clientTxId: authorisedSend.sendId,
          title: `Send ${params.token} to ${params.networkName}`,
          shortTitle: `Send ${amountLabel}`,
          amount: params.amount,
          symbol: params.token,
          chainId: fuse.id,
          fromAddress: user.safeAddress,
          toAddress: params.recipient,
          metadata: {
            description: `Send ${amountLabel} to ${params.recipient} on ${params.networkName}`,
            tokenAddress: authorisedSend.tokenAddress,
            tokenDecimals: '6',
            dstChainId: params.dstChainId,
            exchange: params.exchange,
            sendId: authorisedSend.sendId,
            feeLD: authorisedSend.quote.feeLD,
            bridgeFeeLD: authorisedSend.quote.bridgeFeeLD,
            amountReceivedLD: authorisedSend.quote.amountReceivedLD,
            minAmountLD: authorisedSend.quote.minAmountLD,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Cross-chain send failed',
            fuse,
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

      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        throw new Error('User cancelled transaction');
      }

      const sent: CrossChainSendRecord = {
        ...toRecord(authorisedSend, params, 'sent'),
        srcTxHash: transaction.transactionHash,
        srcExplorerUrl: `${fuse.blockExplorers.default.url}/tx/${transaction.transactionHash}`,
        sentAt: new Date().toISOString(),
      };
      setCrossChainSend(sent);

      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_SUBMITTED, {
        ...analyticsContext,
        send_id: authorisedSend.sendId,
        transaction_hash: transaction.transactionHash,
      });

      setSendStatus(Status.SUCCESS);
      setModal(SEND_MODAL.OPEN_CROSS_CHAIN_STATUS);
      return { status: 'sent', send: sent, transactionHash: transaction.transactionHash };
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isQuoteExpired = QUOTE_EXPIRED_REVERTS.some(name => message.includes(name));
      const isCancelled = message.includes('cancelled');

      track(TRACKING_EVENTS.CROSS_CHAIN_SEND_FAILED, {
        ...analyticsContext,
        error_message: message,
        user_cancelled: isCancelled,
        quote_expired: isQuoteExpired,
      });

      Sentry.captureException(err, {
        tags: {
          type: 'cross_chain_send_error',
          chainId: String(params.dstChainId),
          userId: user?.userId,
        },
        extra: { ...params, quote: params.quote },
        user: { id: user?.userId, address: user?.safeAddress },
      });

      setSendStatus(Status.ERROR);
      setError(message);

      if (isQuoteExpired) {
        Toast.show({
          type: 'error',
          text1: 'The quote expired. Please review again.',
          props: { badgeText: 'Onchain' },
        });
        throw new CrossChainSendQuoteExpiredError();
      }

      if (!isCancelled) {
        Toast.show({
          type: 'error',
          text1: 'Error while sending',
          text2: message.length < 80 ? message : undefined,
          props: { badgeText: 'Onchain' },
        });
      }
      throw err;
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

export default useCrossChainSend;
