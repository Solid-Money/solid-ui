import { useCallback, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  executeSafeRecovery,
  getSafeRecovery,
  getSafeRecoveryBalances,
  prepareSafeRecovery,
} from '@/lib/api';
import { SafeRecovery, SafeRecoveryBalance } from '@/lib/types';
import { verifiedSafeRecoveryHash } from '@/lib/utils/safeRecovery';

import useUser from './useUser';

import type { Hex } from 'viem';

export const SAFE_RECOVERY_BALANCES_KEY = 'safe-recovery-balances';

/** After the backend answers "submitted", how often and how long to look again. */
const POLL_INTERVAL_MS = 3_000;
const POLL_ATTEMPTS = 20;

const STILL_GOING: readonly SafeRecovery['status'][] = ['submitting', 'submitted'];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const safeRecoveryKey = (item: Pick<SafeRecoveryBalance, 'chainId' | 'tokenAddress'>) =>
  `${item.chainId}:${item.tokenAddress.toLowerCase()}`;

/**
 * Funds in the user's Solid wallet on networks the app does not run on (someone sent to their
 * address on Plasma), and moving them back.
 *
 * The app cannot send there - no bundler - but the Safe can still run a transaction its owner
 * signed. So: the backend prepares the Safe transaction, this checks it is exactly the transfer
 * shown and asks for the passkey, and the backend relays it, paying the gas. The funds go to the
 * user's own rhino.fi address on that network, which pays USDC into their Solid wallet on Base.
 */
const useSafeNetworkRescue = () => {
  const { user, createSignatureBatch } = useUser();
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [SAFE_RECOVERY_BALANCES_KEY, user?.userId],
    queryFn: getSafeRecoveryBalances,
    enabled: !!user?.userId,
    staleTime: 30 * 1000,
  });

  const rescue = useCallback(
    async (item: SafeRecoveryBalance): Promise<SafeRecovery> => {
      if (!user?.safeAddress) throw new Error('Safe address not found');

      setPendingKey(safeRecoveryKey(item));
      try {
        const prepared = await prepareSafeRecovery({
          chainId: item.chainId,
          tokenAddress: item.tokenAddress,
        });
        const hash = verifiedSafeRecoveryHash(prepared, user.safeAddress);

        const signer = createSignatureBatch().participant();
        let signature: Hex;
        try {
          signature = await signer.sign(hash);
        } finally {
          signer.release();
        }

        let result = await executeSafeRecovery(prepared.id, signature);
        for (
          let attempt = 0;
          attempt < POLL_ATTEMPTS && STILL_GOING.includes(result.status);
          attempt++
        ) {
          await sleep(POLL_INTERVAL_MS);
          result = await getSafeRecovery(result.id);
        }

        if (result.status === 'failed' || result.status === 'expired') {
          throw new Error(result.error || 'The transfer did not go through');
        }
        return result;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { type: 'safe_network_rescue_error' },
          extra: {
            chainId: item.chainId,
            tokenAddress: item.tokenAddress,
            amount: item.amount,
            safeAddress: user.safeAddress,
          },
          user: { id: user.userId, address: user.safeAddress },
        });
        throw err;
      } finally {
        setPendingKey(null);
        void queryClient.invalidateQueries({ queryKey: [SAFE_RECOVERY_BALANCES_KEY] });
      }
    },
    [createSignatureBatch, queryClient, user],
  );

  return {
    /** False when the backend has recoveries switched off. */
    enabled: data?.enabled ?? false,
    items: data?.items ?? [],
    isLoading,
    rescue,
    /** Which balance is being moved right now, by `safeRecoveryKey`. */
    pendingKey,
  };
};

export default useSafeNetworkRescue;
