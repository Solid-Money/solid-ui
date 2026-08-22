import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { fuse } from 'viem/chains';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardProvider } from '@/hooks/useCardProvider';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { confirmWirexSpendAuthorization, getWirexSpendAuthorization } from '@/lib/api';
import { IS_WIREX_TEST } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { CardProvider, WirexSpendAuthorizationResponse } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

export const CARD_SPEND_AUTHORIZATION_QUERY_KEY = 'cardSpendAuthorization';

/**
 * A Wirex cardholder's soUSD spending authorization, and the action that grants it.
 *
 * ## Which flow a card gets
 *
 * This is the allowance flow, selected by `IS_WIREX_TEST`. With the flag off — the
 * default — a Wirex card uses `useCardSpendRegistration` instead, which puts the
 * spending bounds in `SolidCashModule` on-chain. The two are mutually exclusive: they
 * are two mechanisms for the same permission, and offering both would ask the user to
 * grant it twice for one card.
 *
 * ## Why there is no "Add funds" here
 *
 * A Rain card is prefunded: you move soUSD onto the card and spend what sits
 * there. A Wirex card under External Authorization has no balance of its own —
 * Wirex pays the merchant from its own Master Account and our backend reimburses
 * itself by pulling soUSD from the user's Safe on each settlement. There is
 * nothing to deposit into, so "Add funds" has no meaning; the savings balance and
 * the card balance are the same money.
 *
 * What the user grants instead is standing permission: an ERC-20 `approve` on
 * soUSD (Fuse) naming our card-spend wallet as spender. That is the one on-chain
 * action, and it is signed from their Safe like every other transaction in the app.
 *
 * ## Why the button turns itself back on
 *
 * `authorized` is derived from the on-chain allowance, not from a flag we set. Each
 * settlement's `transferFrom` decrements it, and once it is spent (or the soUSD
 * runs out) the backend reports `authorized: false` and the control offers a fresh
 * authorization. Nothing tracks the decrease separately, so nothing can drift out
 * of step with the chain.
 */
export function useCardSpendAuthorization() {
  const { provider } = useCardProvider();
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const [error, setError] = useState<string | null>(null);

  // Wirex only, and only under `IS_WIREX_TEST`: the flag selects the allowance flow
  // over the `SolidCashModule` registration flow (`useCardSpendRegistration`), which is
  // what runs with the flag off. Exactly one of the two is offered for a given card.
  const isAllowanceFlow = IS_WIREX_TEST && provider === CardProvider.WIREX;

  const query = useQuery<WirexSpendAuthorizationResponse | null>({
    queryKey: [CARD_SPEND_AUTHORIZATION_QUERY_KEY, selectedUserId],
    queryFn: () => withRefreshToken(() => getWirexSpendAuthorization()),
    // Only Wirex cardholders have an allowance to report; a Rain cardholder funds
    // their card instead and this endpoint has nothing to say about them. Skipped
    // entirely on the module flow, where the allowance is not what governs spending.
    enabled: Boolean(selectedUserId) && isAllowanceFlow,
    retry: false,
    staleTime: 15_000,
  });

  const authorization = query.data ?? null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!authorization?.available) {
        throw new Error('Card spending is not available on this account yet.');
      }
      if (!user?.suborgId || !user?.signWith || !user?.safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const amount = parseUnits(authorization.allowanceLimit, authorization.decimals);

      // Fuse explicitly, not `authorization.chainId`: `safeAA` and
      // `executeTransactions` both take a viem Chain object, and soUSD's allowance
      // only ever lives on Fuse (the backend refuses any other chain). The chainId
      // in the response is there to be asserted against, not to select a chain
      // from.
      if (authorization.chainId !== fuse.id) {
        throw new Error(
          `Card spending must be authorized on Fuse, but the server asked for chain ${authorization.chainId}.`,
        );
      }

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        [
          {
            to: authorization.tokenAddress as Address,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [authorization.spenderAddress as Address, amount],
            }),
          },
        ],
        'Failed to authorize card spending',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_SPEND_AUTHORIZE_CANCELLED, {
          amount: authorization.allowanceLimit,
        });
        return null;
      }

      // Tell the backend to re-read the chain now, so the control flips on this
      // interaction instead of after its snapshot expires. Its answer is the
      // authoritative post-approval state, so it becomes the new query data.
      const refreshed = await withRefreshToken(() => confirmWirexSpendAuthorization());
      return { transactionHash: result.transactionHash, authorization: refreshed };
    },
    onSuccess: result => {
      if (!result) return;
      if (result.authorization) {
        queryClient.setQueryData(
          [CARD_SPEND_AUTHORIZATION_QUERY_KEY, selectedUserId],
          result.authorization,
        );
      }
      // The card's spendable balance is derived from this allowance, so the card
      // details are stale the moment it changes.
      queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
      track(TRACKING_EVENTS.CARD_SPEND_AUTHORIZE_COMPLETED, {
        amount: authorization?.allowanceLimit,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to authorize card spending';
      setError(message);
      track(TRACKING_EVENTS.CARD_SPEND_AUTHORIZE_FAILED, { error: message });
    },
  });

  /**
   * Run the approval. Resolves `true` once the allowance is granted, `false` when
   * the user backed out of the signature prompt, and rejects on a real failure.
   *
   * The false case has to be distinguishable: a cancelled signature is not an
   * error (nothing to show the user, nothing to retry) but it is also not a
   * success, and treating it as one would tell them their card is authorized when
   * it is not.
   */
  const authorize = useCallback(async (): Promise<boolean> => {
    setError(null);
    track(TRACKING_EVENTS.CARD_SPEND_AUTHORIZE_PRESSED, {
      amount: authorization?.allowanceLimit,
      // Distinguishes a first authorization from a top-up after the previous one
      // was spent — the two look identical in the UI but are different journeys.
      is_reauthorization: authorization?.authorized === false && authorization.held !== '0.0',
    });
    const result = await mutation.mutateAsync();
    return result !== null;
  }, [authorization, mutation]);

  return {
    /** Null until loaded, or when the user is not a Wirex cardholder. */
    authorization,
    /** Whether to offer the control at all. */
    isAvailable: isAllowanceFlow && authorization?.available === true,
    /** True while an allowance remains — the control shows as done and disabled. */
    isAuthorized: authorization?.authorized === true,
    isLoading: query.isLoading,
    isAuthorizing: mutation.isPending,
    error,
    authorize,
    refetch: query.refetch,
  };
}
