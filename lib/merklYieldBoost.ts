import { Address, encodeFunctionData, Hex } from 'viem';
import { fuse } from 'viem/chains';

import { WRAPPED_FUSE } from '@/constants/addresses';
import MerklDistributorABI from '@/lib/abis/MerklDistributor';
import { wNativeABI } from '@/lib/abis/tokens';
import { ADDRESSES, EXPO_PUBLIC_MERKL_YIELD_BOOST_CAMPAIGN_IDS } from '@/lib/config';

/**
 * The tiered yield boost, paid through Merkl.
 *
 * One campaign per savings vault (soUSD, soETH, soFUSE), all on Fuse and all
 * paying WFUSE; the backend's API Boost endpoint sets each Safe's share from its
 * tier (Prime +2% on the first $10K, Ultra +3% on the first $25K). Merkl claims
 * are per token and cumulative, so the three campaigns collapse into one WFUSE
 * leaf and one claim.
 *
 * Deliberately free of `@merkl/api`: the endpoints used here are plain REST
 * (https://developers.merkl.xyz/integrate-merkl/user-rewards), and the typed
 * client drags an Elysia runtime into every screen that imports it.
 */

export const MERKL_API_URL = 'https://api.merkl.xyz';

/** Reward token of every yield-boost campaign. */
export const YIELD_BOOST_REWARD_TOKEN: Address = WRAPPED_FUSE;
export const YIELD_BOOST_REWARD_DECIMALS = 18;

export interface MerklYieldBoostRewards {
  /** Cumulative WFUSE in the live Merkle root, claimed or not (wei). */
  amount: bigint;
  /** Cumulative WFUSE already pulled onchain (wei), as Merkl last indexed it. */
  claimed: bigint;
  /** `amount - claimed`: what a claim transfers right now (wei). */
  claimable: bigint;
  /**
   * Everything the boost campaigns have credited, claimed or not, including
   * rewards not yet in a root (wei). Drives "Total Earned".
   */
  earned: bigint;
  /** Proofs for `amount` against the live root. Passed to the Distributor as-is. */
  proofs: Hex[];
  /** Merkl's USD quote for the token, when it sent one. */
  priceUsd: number | null;
}

export const EMPTY_YIELD_BOOST_REWARDS: MerklYieldBoostRewards = {
  amount: 0n,
  claimed: 0n,
  claimable: 0n,
  earned: 0n,
  proofs: [],
  priceUsd: null,
};

const toBigInt = (value: unknown): bigint => {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return 0n;
  }
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
};

const sameAddress = (a: unknown, b: string) =>
  typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

interface MerklRewardBreakdownJson {
  campaignId?: string;
  amount?: string;
  pending?: string;
}

interface MerklRewardJson {
  amount?: string;
  claimed?: string;
  pending?: string;
  proofs?: string[];
  token?: { address?: string; price?: number | null };
  breakdowns?: MerklRewardBreakdownJson[];
}

interface MerklChainRewardsJson {
  chain?: { id?: number };
  rewards?: MerklRewardJson[];
}

/**
 * The WFUSE-on-Fuse leaf out of a `/v4/users/{address}/rewards` response.
 *
 * `campaignIds` scopes `earned` to the boost campaigns, so an unrelated WFUSE
 * campaign the Safe also earns from doesn't inflate "Total Earned". Empty means
 * unscoped: every WFUSE reward on Fuse counts. `claimable` is never scoped —
 * the Distributor only claims whole tokens.
 */
export const parseMerklYieldBoostRewards = (
  data: unknown,
  campaignIds: readonly string[] = EXPO_PUBLIC_MERKL_YIELD_BOOST_CAMPAIGN_IDS,
): MerklYieldBoostRewards => {
  if (!Array.isArray(data)) return EMPTY_YIELD_BOOST_REWARDS;

  const reward = (data as MerklChainRewardsJson[])
    .filter(entry => entry?.chain?.id === fuse.id)
    .flatMap(entry => entry.rewards ?? [])
    .find(item => sameAddress(item?.token?.address, YIELD_BOOST_REWARD_TOKEN));

  if (!reward) return EMPTY_YIELD_BOOST_REWARDS;

  const amount = toBigInt(reward.amount);
  const claimed = toBigInt(reward.claimed);
  const scope = new Set(campaignIds.map(id => id.toLowerCase()));

  const earned =
    scope.size === 0
      ? amount + toBigInt(reward.pending)
      : (reward.breakdowns ?? [])
          .filter(breakdown => scope.has(String(breakdown?.campaignId ?? '').toLowerCase()))
          .reduce(
            (total, breakdown) => total + toBigInt(breakdown.amount) + toBigInt(breakdown.pending),
            0n,
          );

  const price = reward.token?.price;

  return {
    amount,
    claimed,
    claimable: amount > claimed ? amount - claimed : 0n,
    earned,
    proofs: (reward.proofs ?? []).filter((proof): proof is Hex => typeof proof === 'string'),
    priceUsd: typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null,
  };
};

/**
 * The Safe's yield-boost rewards from Merkl.
 *
 * `reload` bypasses Merkl's cache for Fuse, which otherwise keeps reporting the
 * old `claimed` for up to ~5 minutes after a claim. It is more expensive for
 * Merkl to serve, so it is only for the read right before and right after a
 * claim.
 */
export const fetchMerklYieldBoostRewards = async (
  address: string,
  { reload = false }: { reload?: boolean } = {},
): Promise<MerklYieldBoostRewards> => {
  const params = new URLSearchParams({ chainId: String(fuse.id) });
  if (reload) params.set('reloadChainId', String(fuse.id));

  const response = await fetch(`${MERKL_API_URL}/v4/users/${address}/rewards?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch yield boost rewards (${response.status})`);
  }

  return parseMerklYieldBoostRewards(await response.json());
};

/** What a claim of `amount` transfers, given the Distributor's own record. */
export const yieldBoostClaimPayout = (amount: bigint, claimedOnchain: bigint) =>
  amount > claimedOnchain ? amount - claimedOnchain : 0n;

/**
 * Claim the WFUSE leaf and unwrap what it pays into native FUSE, in one batch.
 *
 * The unwrap amount is measured against the Distributor's own `claimed` record
 * rather than Merkl's indexed one: the claim transfers exactly
 * `amount - claimedOnchain`, and unwrapping a stale larger figure would revert
 * the whole batch. Returns no calls when there is nothing to claim.
 */
export const buildYieldBoostClaimTransactions = ({
  safeAddress,
  rewards,
  claimedOnchain,
}: {
  safeAddress: Address;
  rewards: Pick<MerklYieldBoostRewards, 'amount' | 'proofs'>;
  claimedOnchain: bigint;
}): { to: Address; data: Hex; value: bigint }[] => {
  const payout = yieldBoostClaimPayout(rewards.amount, claimedOnchain);
  if (payout === 0n || rewards.proofs.length === 0) return [];

  return [
    {
      to: ADDRESSES.fuse.merklDistributor,
      data: encodeFunctionData({
        abi: MerklDistributorABI,
        functionName: 'claim',
        args: [[safeAddress], [YIELD_BOOST_REWARD_TOKEN], [rewards.amount], [rewards.proofs]],
      }),
      value: 0n,
    },
    {
      to: YIELD_BOOST_REWARD_TOKEN,
      data: encodeFunctionData({
        abi: wNativeABI,
        functionName: 'withdraw',
        args: [payout],
      }),
      value: 0n,
    },
  ];
};
