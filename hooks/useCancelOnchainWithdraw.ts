import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type Address, type Chain, TransactionReceipt, zeroAddress } from 'viem';
import { base, mainnet } from 'viem/chains';
import { encodeFunctionData } from 'viem/utils';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { getVaultKey, VaultKey } from '@/constants/withdraw';
import { useActivityActions } from '@/hooks/useActivityActions';
import { BASE_WITHDRAW_REQUEST } from '@/hooks/useBaseWithdrawRequests';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { isSoBtcConfigured, SOBTC_ADDRESSES } from '@/lib/soBtc';
import { isSoEthBaseConfigured } from '@/lib/soEthWithdraw';
import { getSoUsdWithdrawChain, SOUSD_WITHDRAW_CHAINS } from '@/lib/soUsdWithdraw';
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
 * soUSD has a queue on each chain it withdraws on, so its target also depends on
 * the chain the request was queued on: see {@link getCancelWithdrawTarget}.
 *
 * `undefined` where a user cannot cancel at all, and the activity screen then
 * offers no Cancel button: the soFUSE queue does not make
 * `cancelOnChainWithdrawUsingRequestId` a public capability (read from its
 * RolesAuthority on 2026-10-14), so a cancel there can only revert. The soEURC
 * queues on Base, QA's and production's, both do (read 2026-10-15).
 */
const CANCEL_TARGETS: Record<Exclude<VaultKey, 'USD'>, CancelWithdrawTarget | undefined> = {
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
  EUR: {
    chain: base,
    queue: ADDRESSES.base.soEurcBoringQueue,
    shareSymbol: 'soEURC',
    shareAddress: ADDRESSES.base.soEurcVault,
  },
  // soBTC requests on Base; an Ethereum one is picked by chain in getCancelWithdrawTarget.
  BTC: isSoBtcConfigured
    ? {
        chain: base,
        queue: SOBTC_ADDRESSES.base.boringQueue,
        shareSymbol: 'soBTC',
        shareAddress: SOBTC_ADDRESSES.base.vault,
      }
    : undefined,
};

/** soBTC's queue on Ethereum, for a WBTC request made there after the shares were bridged. */
const SOBTC_ETHEREUM_CANCEL_TARGET: CancelWithdrawTarget | undefined = isSoBtcConfigured
  ? {
      chain: mainnet,
      queue: SOBTC_ADDRESSES.ethereum.boringQueue,
      shareSymbol: 'soBTC',
      shareAddress: SOBTC_ADDRESSES.ethereum.vault,
    }
  : undefined;

/** soUSD's queue on the chain the request was queued on; Ethereum when it names none. */
const soUsdCancelTarget = (chainId: number | undefined): CancelWithdrawTarget => {
  const { chain, vault, boringQueue } =
    SOUSD_WITHDRAW_CHAINS[getSoUsdWithdrawChain(chainId) ?? mainnet.id];
  return { chain, queue: boringQueue, shareSymbol: 'soUSD', shareAddress: vault };
};

/**
 * soETH's queue on Base, for a request made on Base (shares held there). Its
 * `cancelOnChainWithdrawUsingRequestId` is public, as on the soEURC queue.
 */
const SOETH_BASE_CANCEL_TARGET: CancelWithdrawTarget | undefined = isSoEthBaseConfigured
  ? {
      chain: base,
      queue: ADDRESSES.base.soEthBoringQueue,
      shareSymbol: 'soETH',
      shareAddress: ADDRESSES.base.soEthVault,
    }
  : undefined;

/**
 * Where a withdraw activity's request can be cancelled, from the share symbol it
 * was recorded with and the chain it was queued on. An activity whose symbol
 * names no vault keeps the old soUSD behaviour, which is what every cancellable
 * request was before vaults diverged; requests made before soUSD moved to Base,
 * and any activity without a chain, are on Ethereum.
 */
export const getCancelWithdrawTarget = (
  symbol: string | undefined,
  chainId?: number,
): CancelWithdrawTarget | undefined => {
  const key = getVaultKey(symbol) ?? 'USD';
  if (key === 'USD') return soUsdCancelTarget(chainId);
  if (key === 'ETH' && chainId === base.id) return SOETH_BASE_CANCEL_TARGET;
  if (key === 'BTC' && chainId === mainnet.id) return SOBTC_ETHEREUM_CANCEL_TARGET;
  return CANCEL_TARGETS[key];
};

type CancelOnChainWithdrawResult = {
  cancelOnchainWithdraw: (
    requestId: `0x${string}`,
    symbol?: string,
    chainId?: number,
  ) => Promise<TransactionReceipt>;
  cancelOnchainWithdrawStatus: Status;
  error: string | null;
};

const useCancelOnchainWithdraw = (): CancelOnChainWithdrawResult => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();
  const [cancelOnchainWithdrawStatus, setCancelOnchainWithdrawStatus] = useState<Status>(
    Status.IDLE,
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * `symbol` is the withdraw activity's share symbol and `chainId` the chain it
   * was queued on; together they pick the queue.
   */
  const cancelOnchainWithdraw = async (
    requestId: `0x${string}`,
    symbol?: string,
    chainId?: number,
  ) => {
    const target = getCancelWithdrawTarget(symbol, chainId);
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

      // A Base request's status is read from the queue; re-read it now rather
      // than on the next poll, so the withdraw shows as cancelled at once.
      void queryClient.invalidateQueries({ queryKey: [BASE_WITHDRAW_REQUEST] }).catch(() => {});

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
