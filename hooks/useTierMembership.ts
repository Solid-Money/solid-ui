import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData, erc20Abi, formatUnits } from 'viem';
import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { Safe_ABI } from '@/lib/abis/Safe';
import { SolidSubscriptionModule_ABI } from '@/lib/abis/SolidSubscriptionModule';
import { SolidTierLock_ABI } from '@/lib/abis/SolidTierLock';
import { track } from '@/lib/analytics';
import {
  cancelTierSubscription,
  confirmTierLock,
  confirmTierSubscription,
  fetchTierMembership,
  resumeTierSubscription,
} from '@/lib/api';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { fuseSharesForAmount } from '@/lib/tierUpgrade';
import { RewardsTier, TierMembershipState } from '@/lib/types';
import { publicClient } from '@/lib/wagmi';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';
import { useUserStore } from '@/store/useUserStore';

export const TIER_MEMBERSHIP_QUERY_KEY = 'tierMembership';
export const TIER_UPGRADE_BALANCES_QUERY_KEY = 'tierUpgradeBalances';

/** soFUSE shares, the accountant rate and the share token all use 18 decimals. */
const SHARE_DECIMALS = 18;
/** USDC, and therefore every amount the subscription module moves. */
const BILLING_DECIMALS = 6;
/** The billing period a mandate is signed for. */
const YEAR_SECONDS = 365n * 24n * 60n * 60n;

/** What the upgrade screens need from the chain, read fresh at the moment of use. */
export interface TierUpgradeChainState {
  /** soFUSE shares the Safe holds, raw. */
  shares: bigint;
  /** That position in FUSE. */
  fuse: number;
  /** soFUSE→FUSE rate, raw (18 decimals). */
  rate: bigint;
  /** USDC the Safe holds, raw (6 decimals). */
  usdc: bigint;
  /** That balance as a number, for display. */
  usdcAmount: number;
  /** Whether the subscription module is already enabled on the Safe. */
  moduleEnabled: boolean;
  /** Whether the Safe has already written a mandate. */
  hasMandate: boolean;
}

/**
 * What each tier costs by either route, and what the user has already bought.
 *
 * Served by the backend as one payload rather than assembled here: the price,
 * the thresholds and the user's own position have to describe the same instant,
 * and three requests is how a screen ends up offering a tier the user already
 * holds.
 */
export const useTierMembership = () => {
  const selectedUserId = useUserStore(state => state.users.find(user => user.selected)?.userId);

  return useQuery<TierMembershipState>({
    queryKey: [TIER_MEMBERSHIP_QUERY_KEY, selectedUserId],
    queryFn: fetchTierMembership,
    enabled: Boolean(selectedUserId),
    staleTime: 30_000,
  });
};

/**
 * The chain state an upgrade is actually built from.
 *
 * Read directly rather than taken from the backend for the same reason
 * `useCardSpendRegistration` does it: the module's consent and the Safe's
 * balances are on-chain facts a user can change from any Safe client with no
 * call to us, and a screen that offers to spend money has to be reading the
 * chain, not a cache of it.
 */
export const useTierUpgradeChainState = (contracts?: {
  lockAddress: string | null;
  subscriptionModuleAddress: string | null;
  shareTokenAddress: string | null;
  billingTokenAddress: string | null;
}) => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;
  const shareToken = (contracts?.shareTokenAddress ?? ADDRESSES.fuse.fuseVault) as Address;
  const billingToken = contracts?.billingTokenAddress as Address | undefined;
  const moduleAddress = contracts?.subscriptionModuleAddress as Address | undefined;

  return useQuery<TierUpgradeChainState>({
    queryKey: [
      TIER_UPGRADE_BALANCES_QUERY_KEY,
      safeAddress,
      shareToken,
      billingToken,
      moduleAddress,
    ],
    enabled: Boolean(safeAddress),
    staleTime: 15_000,
    queryFn: async () => {
      const client = publicClient(fuse.id);

      // All five in flight together: this drives a screen that has to price an
      // offer against a balance, and fetching them in sequence is how the two
      // end up describing different moments.
      const [shares, rate, usdc, moduleEnabled, subscription] = await Promise.all([
        client.readContract({
          address: shareToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [safeAddress!],
        }),
        client.readContract({
          address: ADDRESSES.fuse.fuseAccountant,
          abi: [
            {
              inputs: [],
              name: 'getRate',
              outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const,
          functionName: 'getRate',
        }),
        billingToken
          ? client.readContract({
              address: billingToken,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [safeAddress!],
            })
          : Promise.resolve(0n),
        moduleAddress
          ? client.readContract({
              address: moduleAddress,
              abi: SolidSubscriptionModule_ABI,
              functionName: 'isModuleEnabledOn',
              args: [safeAddress!],
            })
          : Promise.resolve(false),
        moduleAddress
          ? client.readContract({
              address: moduleAddress,
              abi: SolidSubscriptionModule_ABI,
              functionName: 'subscriptionOf',
              args: [safeAddress!],
            })
          : Promise.resolve(undefined),
      ]);

      return {
        shares,
        // Shares are yield-bearing, so a raw balance understates the position —
        // it has to go through the accountant rate to read as FUSE.
        fuse: Number(formatUnits((shares * rate) / 10n ** BigInt(SHARE_DECIMALS), SHARE_DECIMALS)),
        rate,
        usdc,
        usdcAmount: Number(formatUnits(usdc, BILLING_DECIMALS)),
        moduleEnabled,
        hasMandate: subscription?.registered === true && subscription.cancelledAt === 0n,
      };
    },
  });
};

/** Everything an upgrade invalidates, in one place so no path forgets one. */
const useInvalidateAfterUpgrade = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [TIER_MEMBERSHIP_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [TIER_UPGRADE_BALANCES_QUERY_KEY] });
    // The tier itself has moved, so anything describing it is stale — the
    // rewards screen, the benefits table, the fees the user is quoted. Same key
    // shape `refreshRewardsAfterSavings` invalidates, minus the user id, so one
    // upgrade refreshes whichever account is selected.
    queryClient.invalidateQueries({ queryKey: ['rewards', 'userData'] });

    // And open the reconciliation window, which is what actually gets the
    // "You're on Prime now!" card shown.
    //
    // `RewardsUpgradeFeedback` celebrates a tier it sees *rise* between two
    // reads of the rewards payload. One invalidation gives it a single read,
    // taken the instant the transaction lands — before the backend has
    // re-derived the tier from a lock it has not indexed yet, or a
    // subscription row written in the same breath. That read returns the old
    // tier, nothing appears to have risen, and the upgrade the user just paid
    // for is never acknowledged.
    //
    // Arming the window makes it poll until the new tier arrives, exactly as a
    // savings deposit does. Same mechanism, so all four routes into a tier —
    // points, savings, a lock, an annual fee — get the identical celebration.
    const userId = selectedRewardsUserId();
    if (userId) useRewardsUpgradeStore.getState().savingsChanged(userId);
  }, [queryClient]);
};

/**
 * Lock FUSE to hold a tier.
 *
 * Two calls in one user operation: approve the shares to the lock, then lock
 * them. Batched so the user signs once and so neither half can land without the
 * other — an approval left standing with no lock behind it is a permission the
 * user did not mean to leave lying around.
 *
 * The amount is worked out in shares, not FUSE. The tier threshold is measured
 * in FUSE and the vault's rate converts between them, so the share count is
 * rounded *up*: locking a share too few would leave the position a wei short of
 * the threshold and buy nothing.
 */
export const useLockFuseForTier = () => {
  const { user, safeAA } = useUser();
  const invalidate = useInvalidateAfterUpgrade();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      tier,
      fuseAmount,
      rate,
      lockAddress,
      shareTokenAddress,
    }: {
      tier: RewardsTier;
      /** FUSE the user is committing. */
      fuseAmount: number;
      /** soFUSE→FUSE rate, raw. */
      rate: bigint;
      lockAddress: string;
      shareTokenAddress: string;
    }) => {
      if (!user?.suborgId || !user?.signWith) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const shares = fuseSharesForAmount(fuseAmount, rate);
      if (shares <= 0n) throw new Error('Enter an amount to lock.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: shareTokenAddress as Address,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [lockAddress as Address, shares],
            }),
            value: 0n,
          },
          {
            to: lockAddress as Address,
            data: encodeFunctionData({
              abi: SolidTierLock_ABI,
              functionName: 'lock',
              args: [shares],
            }),
            value: 0n,
          },
        ],
        'Failed to lock your FUSE',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.TIER_LOCK_CANCELLED, { tier, fuse_amount: fuseAmount });
        return null;
      }

      // Told to the backend afterwards, not before: the lock is already on
      // chain and the tier is already the user's. This is what drops the cached
      // position so it shows immediately, and registers them for the automatic
      // return when the term is up.
      const state = await confirmTierLock({ transactionHash: result.transactionHash });

      return { state, transactionHash: result.transactionHash, fuseAmount, tier };
    },
    onSuccess: result => {
      if (!result) return;
      invalidate();
      track(TRACKING_EVENTS.TIER_LOCK_COMPLETED, {
        tier: result.tier,
        fuse_amount: result.fuseAmount,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to lock your FUSE';
      setError(message);
      track(TRACKING_EVENTS.TIER_LOCK_FAILED, { error: message });
    },
  });

  return {
    lockFuse: mutation.mutateAsync,
    isLocking: mutation.isPending,
    error,
    clearError: () => setError(null),
  };
};

/**
 * Buy a tier with the annual fee.
 *
 * One user operation again: enable the module on the Safe, then write the
 * mandate. Batching is what makes the permission and its bounds a single
 * decision — a Safe cannot end up with the module enabled and no mandate, which
 * would be a standing permission with nothing shaping it.
 *
 * The mandate is set to exactly the price. A cap with headroom in it would
 * survive a price rise without asking, and asking is the point: a subscription
 * whose price goes up is a new agreement, and the user should sign it.
 */
export const useSubscribeToTier = () => {
  const { user, safeAA } = useUser();
  const invalidate = useInvalidateAfterUpgrade();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      tier,
      priceUsd,
      moduleAddress,
      moduleEnabled,
    }: {
      tier: RewardsTier;
      priceUsd: number;
      moduleAddress: string;
      /** Whether the Safe has already enabled the module. */
      moduleEnabled: boolean;
    }) => {
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      // Rounded to whole cents before scaling, so a price stored as a decimal
      // cannot become a mandate a fraction under what will be charged.
      const mandate = BigInt(Math.round(priceUsd * 100)) * 10n ** BigInt(BILLING_DECIMALS - 2);
      if (mandate <= 0n) throw new Error('This tier is not available with an annual fee.');

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

      const result = await executeTransactions(
        smartAccountClient,
        [
          ...(moduleEnabled
            ? []
            : [
                {
                  to: user.safeAddress as Address,
                  data: encodeFunctionData({
                    abi: Safe_ABI,
                    functionName: 'enableModule',
                    args: [moduleAddress as Address],
                  }),
                  value: 0n,
                },
              ]),
          {
            to: moduleAddress as Address,
            data: encodeFunctionData({
              abi: SolidSubscriptionModule_ABI,
              functionName: 'subscribe',
              args: [mandate, YEAR_SECONDS],
            }),
            value: 0n,
          },
        ],
        'Failed to start your membership',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.TIER_SUBSCRIBE_CANCELLED, { tier, price_usd: priceUsd });
        return null;
      }

      // The first payment is taken here, server-side, against the mandate that
      // has just landed. It can fail — most often for a Safe short of USDC —
      // and when it does the error carries the module's own reason.
      const state = await confirmTierSubscription({
        tier,
        transactionHash: result.transactionHash,
      });

      return { state, transactionHash: result.transactionHash, tier, priceUsd };
    },
    onSuccess: result => {
      if (!result) return;
      invalidate();
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_COMPLETED, {
        tier: result.tier,
        price_usd: result.priceUsd,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to start your membership';
      setError(message);
      track(TRACKING_EVENTS.TIER_SUBSCRIBE_FAILED, { error: message });
    },
  });

  return {
    subscribe: mutation.mutateAsync,
    isSubscribing: mutation.isPending,
    error,
    clearError: () => setError(null),
  };
};

/**
 * Stop a membership renewing.
 *
 * Off-chain only, and that is the whole of it as far as money is concerned:
 * Solid's billing engine is the only thing that draws against the mandate, so
 * ceasing to draw ends the charges. The on-chain `cancel()` is offered
 * separately for anyone who wants the permission itself gone rather than merely
 * unused.
 */
export const useCancelTierSubscription = () => {
  const invalidate = useInvalidateAfterUpgrade();

  return useMutation({
    mutationFn: (reason?: string) => cancelTierSubscription({ reason }),
    onSuccess: subscription => {
      invalidate();
      track(TRACKING_EVENTS.TIER_SUBSCRIPTION_CANCEL_COMPLETED, {
        tier: subscription.tier,
        period_end: subscription.currentPeriodEnd,
      });
    },
  });
};

/** Undo a cancellation while the paid period is still running. */
export const useResumeTierSubscription = () => {
  const invalidate = useInvalidateAfterUpgrade();

  return useMutation({
    mutationFn: () => resumeTierSubscription(),
    onSuccess: subscription => {
      invalidate();
      track(TRACKING_EVENTS.TIER_SUBSCRIPTION_RESUME_COMPLETED, { tier: subscription.tier });
    },
  });
};
