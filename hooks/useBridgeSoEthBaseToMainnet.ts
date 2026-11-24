import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { type Address, formatEther, parseUnits, TransactionReceipt } from 'viem';
import { getBalance } from 'viem/actions';
import { base, mainnet } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivityActions } from '@/hooks/useActivityActions';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import {
  executeTransactions,
  USER_CANCELLED_TRANSACTION,
  UserOperationRevertedError,
} from '@/lib/execute';
import { buildSoEthBaseBridgeToEthereumCall, readSoEthBaseBridgeFee } from '@/lib/soEthWithdraw';
import { Status, TransactionStatus, TransactionType } from '@/lib/types';
import { generateId } from '@/lib/utils/generate-id';
import { waitForLayerzeroTransaction } from '@/lib/utils/layerzero';
import { publicClient } from '@/lib/wagmi';
import { useWithdrawSessionStore } from '@/store/useWithdrawSessionStore';

import useUser from './useUser';

/** The bridge UserOperation was sent but its outcome couldn't be read (not a confirmed revert). */
const BRIDGE_OUTCOME_UNKNOWN = Symbol('BRIDGE_OUTCOME_UNKNOWN');

/**
 * Step 1 of withdrawing soETH held on Base: bridge the shares to the same Safe on Ethereum, where
 * step 2 requests them on the Ethereum queue. The Safe pays the LayerZero fee in ETH on Base (no
 * Base paymaster sponsors it). A resume session is written as soon as the bridge is sent, so a
 * closed flow reopens on step 2.
 */
const useBridgeSoEthBaseToMainnet = () => {
  const { user, safeAA } = useUser();
  const { trackTransaction, updateActivity } = useActivityActions();
  const [status, setStatus] = useState<Status>(Status.IDLE);
  const [error, setError] = useState<string | null>(null);

  const bridgeSoEthFromBase = useCallback(
    async (amount: string): Promise<TransactionReceipt> => {
      // Set once the bridge transaction has landed on Base.
      let bridged = false;
      // Set once the UserOperation hash exists: from then on the bridge may land even if a wait fails.
      let sent = false;
      try {
        if (!user?.safeAddress) throw new Error('User not found');
        setStatus(Status.PENDING);
        setError(null);
        const safe = user.safeAddress as Address;
        const shares = parseUnits(amount, 18);

        const fee = await readSoEthBaseBridgeFee(safe);
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
          source: 'useBridgeSoEthBaseToMainnet',
        });

        const smartAccountClient = await safeAA(base, user.suborgId, user.signWith);
        const clientTxId = generateId();
        const result = await trackTransaction(
          {
            clientTxId,
            type: TransactionType.BRIDGE_DEPOSIT,
            title: `Withdraw ${amount} soETH`,
            shortTitle: `Withdraw ${amount}`,
            amount,
            symbol: 'soETH',
            chainId: base.id,
            fromAddress: user.safeAddress,
            toAddress: user.safeAddress,
            metadata: {
              description: `Move ${amount} soETH from Base to Ethereum to withdraw WETH`,
              fee: fee.toString(),
              tokenAddress: ADDRESSES.base.soEthVault,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              [buildSoEthBaseBridgeToEthereumCall(shares, safe, fee)],
              'Moving soETH to Ethereum failed',
              base,
              hash => {
                sent = true;
                useWithdrawSessionStore.getState().setSession({
                  address: safe,
                  vault: 'ETH',
                  amount,
                  destinationSymbol: 'WETH',
                  chainId: mainnet.id,
                  createdAt: Date.now(),
                });
                onUserOpHash(hash);
              },
            ).catch(executeError => {
              // Sent, then a wait failed without a confirmed revert: the bridge may still land.
              // Returning (not throwing) keeps trackTransaction from marking the activity FAILED.
              if (sent && !(executeError instanceof UserOperationRevertedError)) {
                console.warn('soETH Base bridge: outcome unknown after sending', executeError);
                return BRIDGE_OUTCOME_UNKNOWN;
              }
              throw executeError;
            }),
        );
        if (result === BRIDGE_OUTCOME_UNKNOWN) {
          // The resume session stays: step 2 picks up once the shares land.
          throw new Error(
            "Couldn't confirm the move to Ethereum yet. It may still go through; reopen Withdraw to continue.",
          );
        }
        const transaction =
          result && typeof result === 'object' && 'transaction' in result
            ? result.transaction
            : result;
        if (transaction === USER_CANCELLED_TRANSACTION) {
          useWithdrawSessionStore.getState().clearSession('ETH');
          throw new Error('User cancelled transaction');
        }

        bridged = true;

        // The shares have left Base. If LayerZero hasn't confirmed delivery by the time the waiter
        // gives up, they are still in flight: keep the session and leave the activity processing.
        const delivered = await waitForLayerzeroTransaction(transaction.transactionHash)
          .then(() => true)
          .catch(lzError => {
            console.warn('soETH Base bridge: LayerZero delivery not confirmed yet', lzError);
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
          source: 'useBridgeSoEthBaseToMainnet',
        });
        setStatus(Status.SUCCESS);
        return transaction;
      } catch (err) {
        console.error(err);
        // Clear the resume session only when the bridge certainly didn't happen: never sent, or
        // mined and reverted.
        if (!bridged && (!sent || err instanceof UserOperationRevertedError)) {
          useWithdrawSessionStore.getState().clearSession('ETH');
        }
        track(TRACKING_EVENTS.BRIDGE_TO_MAINNET_ERROR, {
          amount,
          error: err instanceof Error ? err.message : 'Unknown error',
          user_cancelled: String(err).includes('cancelled'),
          from_chain: base.id,
          to_chain: mainnet.id,
          source: 'useBridgeSoEthBaseToMainnet',
        });
        Sentry.captureException(err, {
          tags: { operation: 'bridge_soeth_base_to_mainnet' },
          extra: { amount, userAddress: user?.safeAddress },
        });
        setStatus(Status.ERROR);
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [user, safeAA, trackTransaction, updateActivity],
  );

  return { bridgeSoEthFromBase, bridgeSoEthFromBaseStatus: status, error };
};

export default useBridgeSoEthBaseToMainnet;
