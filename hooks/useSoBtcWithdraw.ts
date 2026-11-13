import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import {
  type Address,
  erc20Abi,
  formatEther,
  maxUint256,
  parseUnits,
  TransactionReceipt,
} from 'viem';
import { getBalance, readContract } from 'viem/actions';
import { base, mainnet } from 'viem/chains';
import { encodeFunctionData } from 'viem/utils';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { WITHDRAW_SECONDS_TO_DEADLINE } from '@/constants/withdraw';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track } from '@/lib/analytics';
import {
  executeTransactions,
  USER_CANCELLED_TRANSACTION,
  UserOperationRevertedError,
} from '@/lib/execute';
import {
  buildSoBtcBridgeToEthereumCall,
  buildSoBtcWithdrawRequestCall,
  isSoBtcConfigured,
  readSoBtcBridgeFee,
  readSoBtcQueuedShares,
  readSoBtcRate,
  readSoBtcVaultBalance,
  SOBTC_DECIMALS,
  SOBTC_WITHDRAW_OPTIONS,
  type SoBtcChainId,
} from '@/lib/soBtc';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { generateId } from '@/lib/utils/generate-id';
import { waitForLayerzeroTransaction } from '@/lib/utils/layerzero';
import { publicClient } from '@/lib/wagmi';
import { useWithdrawSessionStore } from '@/store/useWithdrawSessionStore';

import useUser from './useUser';

/** How often "available now" is re-read while the withdraw form is open. */
const AVAILABILITY_REFRESH_MS = 30_000;

/** The bridge UserOperation was sent but its outcome couldn't be read (not a confirmed revert). */
const BRIDGE_OUTCOME_UNKNOWN = Symbol('BRIDGE_OUTCOME_UNKNOWN');
export type SoBtcAvailability = {
  /**
   * What the option can pay a new request right now, in satoshis: the vault's balance minus what
   * the open requests ahead of it will take when solved.
   */
  availableSats: bigint;
  /** Satoshis the open, unexpired requests in this option's queue will take from the vault. */
  queuedSats: bigint;
  /** The option's share → BTC rate, 8 decimals. */
  rate: bigint;
  /** The most shares that vault can redeem right now, at that rate. */
  maxShares: bigint;
};

/**
 * What each soBTC withdraw option can pay right now. Each side pays only from its own vault
 * (cbBTC in the Base vault, WBTC in the Ethereum vault), so the two figures differ whenever more
 * of one was deposited, or one side's assets are out earning.
 */
export const useSoBtcAvailability = (chainId: SoBtcChainId, enabled = true) =>
  useQuery({
    queryKey: ['soBtcAvailability', chainId],
    queryFn: async (): Promise<SoBtcAvailability> => {
      const [vaultSats, queuedShares, rate] = await Promise.all([
        readSoBtcVaultBalance(chainId),
        readSoBtcQueuedShares(chainId),
        readSoBtcRate(chainId),
      ]);
      const oneShare = 10n ** BigInt(SOBTC_DECIMALS);
      // A solve pays out shares x the rate at solve time (the discount goes to the solver Safe),
      // so queued requests are valued at today's rate, not at their discounted amountOfAssets.
      const queuedSats = (queuedShares * rate) / oneShare;
      const availableSats = vaultSats > queuedSats ? vaultSats - queuedSats : 0n;
      const maxShares = rate > 0n ? (availableSats * oneShare) / rate : 0n;
      return { availableSats, queuedSats, rate, maxShares };
    },
    enabled: enabled && isSoBtcConfigured,
    staleTime: AVAILABILITY_REFRESH_MS,
    refetchInterval: AVAILABILITY_REFRESH_MS,
  });

/**
 * Requests a soBTC withdrawal on `chainId`'s queue, for that chain's asset: cbBTC on Base
 * (shares already there) or WBTC on Ethereum (shares bridged there in step 1).
 */
export const useWithdrawSoBtc = (chainId: SoBtcChainId) => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);
  const option = SOBTC_WITHDRAW_OPTIONS[chainId];

  const withdrawSoBtc = useCallback(
    async (amount: string): Promise<TransactionReceipt> => {
      try {
        if (!user?.safeAddress) throw new Error('User not found');
        setStatus(Status.PENDING);
        setError(null);
        const shares = parseUnits(amount, SOBTC_DECIMALS);
        const safe = user.safeAddress as Address;

        // Read the allowance now rather than from a hook: a stale or unread one would skip the
        // approve and send a request that reverts.
        const allowance = await readContract(publicClient(chainId), {
          address: option.vault,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [safe, option.boringQueue],
        });
        const transactions = [
          ...(allowance < shares
            ? [
                {
                  to: option.vault,
                  data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [option.boringQueue, maxUint256],
                  }),
                  value: 0n,
                },
              ]
            : []),
          buildSoBtcWithdrawRequestCall(chainId, shares, WITHDRAW_SECONDS_TO_DEADLINE),
        ];

        track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_INITIATED, {
          amount,
          needs_approval: allowance < shares,
          source: 'withdraw_sobtc_hook',
          chain_id: chainId,
        });

        const smartAccountClient = await safeAA(option.chain, user.suborgId, user.signWith);
        const result = await trackTransaction(
          {
            type: TransactionType.WITHDRAW,
            title: `Withdraw ${amount} soBTC`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soBTC',
            chainId,
            fromAddress: user.safeAddress,
            toAddress: option.boringQueue,
            metadata: {
              description: `Withdraw ${amount} soBTC to ${option.asset} on ${option.networkName}`,
              tokenAddress: option.vault,
              assetOut: option.asset,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Withdraw soBTC failed',
              option.chain,
              onUserOpHash,
            ),
        );
        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;
        if (transaction === USER_CANCELLED_TRANSACTION)
          throw new Error('User cancelled transaction');

        track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_COMPLETED, {
          amount,
          transaction_hash: transaction.transactionHash,
          source: 'withdraw_sobtc_hook',
          chain_id: chainId,
        });
        setStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        track(TRACKING_EVENTS.WITHDRAW_TRANSACTION_ERROR, {
          amount,
          error_message: err instanceof Error ? err.message : 'Unknown error',
          user_cancelled: String(err).includes('cancelled'),
          source: 'withdraw_sobtc_hook',
          chain_id: chainId,
        });
        Sentry.captureException(err, {
          tags: { type: 'withdraw_sobtc_error', userId: user?.userId },
          extra: { amount, chainId, userAddress: user?.safeAddress },
        });
        setStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, safeAA, trackTransaction, chainId, option],
  );

  return { withdrawSoBtc, withdrawSoBtcStatus: status, error };
};

/**
 * Step 1 of a WBTC withdrawal: bridge soBTC from Base to the same Safe on Ethereum, where step 2
 * requests it on the Ethereum queue. The Safe pays the LayerZero fee in ETH on Base: the
 * paymaster covers gas, not value. A resume session is written as soon as the bridge is
 * broadcast, so a closed flow reopens on step 2.
 */
export const useBridgeSoBtcToEthereum = () => {
  const { user, safeAA } = useUser();
  const { trackTransaction, updateActivity } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const bridgeSoBtc = useCallback(
    async (amount: string): Promise<TransactionReceipt> => {
      // Set once the bridge transaction has landed on Base (the resume session is set earlier,
      // when the UserOperation is sent; see the catch for when it's cleared).
      let bridged = false;
      // Set once the UserOperation hash exists: from then on the bridge may land even if a wait fails.
      let sent = false;
      try {
        if (!user?.safeAddress) throw new Error('User not found');
        setStatus(Status.PENDING);
        setError(null);
        const safe = user.safeAddress as Address;
        const shares = parseUnits(amount, SOBTC_DECIMALS);

        // The teller takes exactly the quoted fee, from the Safe's own ETH on Base.
        const fee = await readSoBtcBridgeFee(base.id, mainnet.id, safe);
        const ethBalance = await getBalance(publicClient(base.id), { address: safe });
        if (ethBalance < fee) {
          throw new Error(
            `You need ${Number(formatEther(fee)).toFixed(6)} ETH on Base in your Solid wallet for the bridge fee`,
          );
        }

        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_INITIATED, {
          amount,
          fee: fee.toString(),
          from_chain: base.id,
          to_chain: mainnet.id,
          source: 'useBridgeSoBtcToEthereum',
        });

        const smartAccountClient = await safeAA(base, user.suborgId, user.signWith);
        const clientTxId = generateId();
        const result = await trackTransaction(
          {
            clientTxId,
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw ${amount} soBTC`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soBTC',
            chainId: base.id,
            fromAddress: user.safeAddress,
            toAddress: user.safeAddress,
            metadata: {
              description: `Move ${amount} soBTC from Base to Ethereum to withdraw WBTC`,
              fee: fee.toString(),
              tokenAddress: SOBTC_WITHDRAW_OPTIONS[base.id].vault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              [buildSoBtcBridgeToEthereumCall(shares, safe, fee)],
              'Moving soBTC to Ethereum failed',
              base,
              hash => {
                sent = true;
                useWithdrawSessionStore.getState().setSession({
                  address: safe,
                  vault: 'BTC',
                  amount,
                  destinationSymbol: 'WBTC',
                  chainId: mainnet.id,
                  createdAt: Date.now(),
                });
                onUserOpHash(hash);
              },
            ).catch(executeError => {
              // Sent, then a wait failed without a confirmed revert: the bridge may still land.
              // Returning (not throwing) keeps trackTransaction from marking the activity FAILED;
              // it stays processing with its UserOperation hash, for reconciliation.
              if (sent && !(executeError instanceof UserOperationRevertedError)) {
                console.warn('soBTC bridge: outcome unknown after sending', executeError);
                return BRIDGE_OUTCOME_UNKNOWN;
              }
              throw executeError;
            }),
        );
        if (result === BRIDGE_OUTCOME_UNKNOWN) {
          // The resume session stays (see the catch below): step 2 picks up once the shares land.
          throw new Error(
            "Couldn't confirm the move to Ethereum yet. It may still go through; reopen Withdraw to continue.",
          );
        }
        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;
        if (transaction === USER_CANCELLED_TRANSACTION) {
          useWithdrawSessionStore.getState().clearSession('BTC');
          throw new Error('User cancelled transaction');
        }

        bridged = true;

        // The shares have left Base. The waiter resolves only once LayerZero reports a delivery;
        // if it gives up first, the shares are still in flight: keep the session and leave the
        // activity processing rather than report a failed withdrawal.
        const delivered = await waitForLayerzeroTransaction(transaction.transactionHash)
          .then(() => true)
          .catch(lzError => {
            console.warn('soBTC bridge: LayerZero delivery not confirmed yet', lzError);
            return false;
          });
        if (delivered) {
          updateActivity(clientTxId, {
            status: TransactionStatus.SUCCESS,
            metadata: { layerzeroDeliveredAt: new Date().toISOString() },
          });
        }
        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_COMPLETED, {
          amount,
          transaction_hash: transaction.transactionHash,
          from_chain: base.id,
          to_chain: mainnet.id,
          source: 'useBridgeSoBtcToEthereum',
        });
        setStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        // Clear the resume session only when the bridge certainly didn't happen: never sent, or
        // mined and reverted. A receipt wait that failed after sending is an unknown outcome; the
        // shares may still be leaving Base, so the session must survive to resume step 2.
        if (!bridged && (!sent || err instanceof UserOperationRevertedError)) {
          useWithdrawSessionStore.getState().clearSession('BTC');
        }
        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
          amount,
          error: err instanceof Error ? err.message : 'Unknown error',
          user_cancelled: String(err).includes('cancelled'),
          from_chain: base.id,
          to_chain: mainnet.id,
          source: 'useBridgeSoBtcToEthereum',
        });
        Sentry.captureException(err, {
          tags: { operation: 'bridge_sobtc_to_ethereum' },
          extra: { amount, userAddress: user?.safeAddress },
        });
        setStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, safeAA, trackTransaction, updateActivity],
  );

  return { bridgeSoBtc, bridgeSoBtcStatus: status, error };
};
