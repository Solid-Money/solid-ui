import { useState } from 'react';
import { type Address, type Chain, TransactionReceipt, zeroAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { encodeFunctionData } from 'viem/utils';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { getVaultKey, VaultKey } from '@/constants/withdraw';
import { useActivityActions } from '@/hooks/useActivityActions';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { Status, TransactionType } from '@/lib/types';

import useUser from './useUser';

type CancelWithdrawTarget = {
  chain: Chain;
  queue: Address;
  shareSymbol: string;
  shareAddress: Address;
};

/**
 * The queue a vault's withdraw request is cancelled on. A request can only be
 * cancelled on the queue that holds it, so this used to send every cancel to the
 * soUSD queue on Ethereum whatever vault the request was for.
 *
 * `undefined` where a user cannot cancel at all, and the activity screen then
 * offers no Cancel button: the soFUSE and soEURC queues do not make
 * `cancelOnChainWithdrawUsingRequestId` a public capability (read from each
 * queue's RolesAuthority on 2026-10-14), so a cancel there can only revert.
 * TODO(soEURC): map EUR to `ADDRESSES.base.soEurcBoringQueue` on Base once that
 * queue grants the public cancel role.
 */
const CANCEL_TARGETS: Record<VaultKey, CancelWithdrawTarget | undefined> = {
  USD: {
    chain: mainnet,
    queue: ADDRESSES.ethereum.boringQueue,
    shareSymbol: 'soUSD',
    shareAddress: ADDRESSES.ethereum.vault,
  },
  ETH:
    ADDRESSES.ethereum.soEthBoringQueue.toLowerCase() === zeroAddress
      ? undefined
      : {
          chain: mainnet,
          queue: ADDRESSES.ethereum.soEthBoringQueue,
          shareSymbol: 'soETH',
          shareAddress: ADDRESSES.ethereum.soEthVault,
        },
  FUSE: undefined,
  EUR: undefined,
};

/**
 * Where a withdraw activity's request can be cancelled, from the share symbol it
 * was recorded with. An activity whose symbol names no vault keeps the old soUSD
 * behaviour, which is what every cancellable request was before vaults diverged.
 */
export const getCancelWithdrawTarget = (symbol: string | undefined) =>
  CANCEL_TARGETS[getVaultKey(symbol) ?? 'USD'];

type CancelOnChainWithdrawResult = {
  cancelOnchainWithdraw: (requestId: `0x${string}`, symbol?: string) => Promise<TransactionReceipt>;
  cancelOnchainWithdrawStatus: Status;
  error: string | null;
};

const useCancelOnchainWithdraw = (): CancelOnChainWithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [cancelOnchainWithdrawStatus, setCancelOnchainWithdrawStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  /** `symbol` is the withdraw activity's share symbol, which picks the queue. */
  const cancelOnchainWithdraw = async (requestId: `0x${string}`, symbol?: string) => {
    const target = getCancelWithdrawTarget(symbol);
    try {
      if (!user) {
        track(TRACKING_EVENTS.CANCEL_WITHDRAW_ERROR, {
          request_id: requestId,
          error: 'User not found',
          step: 'validation',
          source: 'useCancelOnchainWithdraw',
        });
        throw new Error('User not found');
      }

      if (!target) {
        throw new Error('This withdrawal cannot be cancelled');
      }

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_INITIATED, {
        request_id: requestId,
        chain_id: target.chain.id,
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.PENDING);
      setError(null);

      const transactions = [
        {
          to: target.queue,
          data: encodeFunctionData({
            abi: BoringQueue_ABI,
            functionName: 'cancelOnChainWithdrawUsingRequestId',
            args: [requestId],
          }),
          value: 0n,
        },
      ];

      const smartAccountClient = await safeAA(target.chain, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.CANCEL_WITHDRAW,
          title: 'Cancel onchain withdraw',
          shortTitle: 'Cancel withdraw',
          amount: '0',
          symbol: target.shareSymbol,
          chainId: target.chain.id,
          fromAddress: user.safeAddress,
          toAddress: target.queue,
          metadata: {
            description: 'Cancel onchain withdraw request',
            requestId,
            tokenAddress: target.shareAddress,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Cancel onchain withdraw failed',
            target.chain,
            onUserOpHash,
          ),
      );

      const transaction =
        result && typeof result === 'object' && 'transaction' in result
          ? result.transaction
          : result;

      if (transaction === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CANCEL_WITHDRAW_CANCELLED, {
          request_id: requestId,
          source: 'useCancelOnchainWithdraw',
        });
        throw new Error('User cancelled transaction');
      }

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_COMPLETED, {
        request_id: requestId,
        transaction_hash: transaction.transactionHash,
        chain_id: target.chain.id,
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.SUCCESS);
      return transaction;
    } catch (error) {
      console.error(error);

      track(TRACKING_EVENTS.CANCEL_WITHDRAW_ERROR, {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        user_cancelled: String(error).includes('cancelled'),
        step: 'execution',
        source: 'useCancelOnchainWithdraw',
      });

      setCancelOnchainWithdrawStatus(Status.ERROR);
      setError(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  return { cancelOnchainWithdraw, cancelOnchainWithdrawStatus, error };
};

export default useCancelOnchainWithdraw;
