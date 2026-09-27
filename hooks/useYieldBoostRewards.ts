import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import MerklDistributorABI from '@/lib/abis/MerklDistributor';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, getTransaction, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  buildYieldBoostClaimTransactions,
  fetchMerklYieldBoostRewards,
  YIELD_BOOST_REWARD_DECIMALS,
  YIELD_BOOST_REWARD_TOKEN,
  yieldBoostClaimPayout,
} from '@/lib/merklYieldBoost';
import { TransactionType } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';

export const yieldBoostRewardsQueryKey = (safeAddress?: string) =>
  ['merkl', 'yieldBoost', safeAddress?.toLowerCase()] as const;

/**
 * The Safe's Merkl yield-boost rewards (WFUSE on Fuse).
 *
 * Merkl publishes a new root every few hours and `pending` moves roughly every
 * two, so a minute of staleness is invisible and keeps this off Merkl's rate
 * limit however often the savings screen is opened.
 */
export const useYieldBoostRewards = () => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress;

  return useQuery({
    queryKey: yieldBoostRewardsQueryKey(safeAddress),
    queryFn: () => fetchMerklYieldBoostRewards(safeAddress as string),
    enabled: Boolean(safeAddress),
    staleTime: 60_000,
  });
};

/**
 * Claim every yield-boost reward the Safe has and unwrap it to FUSE, in one
 * user operation.
 *
 * Reads fresh (cache-bypassing) proofs and the Distributor's own claimed record
 * right before signing, so a root Merkl pushed while the screen sat open, or a
 * claim from another device, can't turn into a reverted batch. Resolves to
 * `null` when the user cancels the passkey prompt.
 */
export const useClaimYieldBoost = () => {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.safeAddress || !user?.suborgId || !user?.signWith) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const safeAddress = user.safeAddress as Address;
      const distributor = ADDRESSES.fuse.merklDistributor;

      const [rewards, [claimedOnchain]] = await Promise.all([
        fetchMerklYieldBoostRewards(safeAddress, { reload: true }),
        publicClient(fuse.id).readContract({
          address: distributor,
          abi: MerklDistributorABI,
          functionName: 'claimed',
          args: [safeAddress, YIELD_BOOST_REWARD_TOKEN],
        }),
      ]);

      const transactions = buildYieldBoostClaimTransactions({
        safeAddress,
        rewards,
        claimedOnchain,
      });
      if (transactions.length === 0) {
        throw new Error('There is nothing to claim yet.');
      }

      const amount = formatUnits(
        yieldBoostClaimPayout(rewards.amount, claimedOnchain),
        YIELD_BOOST_REWARD_DECIMALS,
      );

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const result = await trackTransaction(
        {
          type: TransactionType.MERKL_CLAIM,
          title: 'Claim yield boost',
          shortTitle: 'Yield boost',
          amount,
          symbol: 'FUSE',
          chainId: fuse.id,
          fromAddress: distributor,
          toAddress: safeAddress,
          metadata: {
            description: `Claim ${amount} FUSE yield boost from Merkl`,
            tokenAddress: ADDRESSES.fuse.nativeFeeToken,
          },
        },
        onUserOpHash =>
          executeTransactions(
            smartAccountClient,
            transactions,
            'Failed to claim yield boost',
            fuse,
            onUserOpHash,
          ),
      );

      if (getTransaction(result) === USER_CANCELLED_TRANSACTION) return null;

      return { amount };
    },
    onSuccess: async result => {
      if (!result || !user?.safeAddress) return;

      // Merkl takes a few minutes to index the claim, so write the fresh,
      // cache-bypassing read into the query rather than waiting for it.
      try {
        queryClient.setQueryData(
          yieldBoostRewardsQueryKey(user.safeAddress),
          await fetchMerklYieldBoostRewards(user.safeAddress, { reload: true }),
        );
      } catch {
        await queryClient.invalidateQueries({
          queryKey: yieldBoostRewardsQueryKey(user.safeAddress),
        });
      }
    },
    onError: error => {
      Sentry.captureException(error, {
        tags: { operation: 'yield_boost_claim' },
        extra: { userAddress: user?.safeAddress },
      });
    },
  });
};
