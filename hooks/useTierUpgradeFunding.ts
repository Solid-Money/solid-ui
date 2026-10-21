import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { zeroAddress } from 'viem';
import { fuse } from 'viem/chains';

import { SWAP_CHAIN_IDS } from '@/constants/swapChains';
import { LIFI_QUOTE_REFRESH_MS } from '@/hooks/swap/useLifiSwapInfo';
import { useBalances } from '@/hooks/useBalances';
import useUser from '@/hooks/useUser';
import { fetchLifiSwapQuote, LifiSwapApiError } from '@/lib/api/lifi-swap';
import { covers } from '@/lib/tierUpgrade';
import {
  arrivedFundingCoverUsd,
  billingTokenRow,
  canPayCashWith,
  cashFundingTokens,
  cashTokenKey,
  defaultCashToken,
  fundingNeedUsd,
  fundingSendAmount,
  isBillingToken,
  latestUpgradeFunding,
  type UpgradeFunding,
} from '@/lib/tierUpgradeFunding';
import { TierMembershipState, TokenBalance, TokenType } from '@/lib/types';
import { LifiSwapQuote } from '@/lib/types/lifi-swap';
import { withRefreshToken } from '@/lib/utils';
import { useLifiSwapStore } from '@/store/lifiSwapStore';
import { useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import type { TierUpgradeChainState } from '@/hooks/useTierMembership';

/** Every swap chain but Fuse: LI.FI has no same-chain route into Fuse USDC. */
const FUNDING_CHAIN_IDS = SWAP_CHAIN_IDS.filter(chainId => chainId !== fuse.id);

/** How far LI.FI's price may sit from the one an amount was worked out at before it is redone. */
const PRICE_DRIFT_TOLERANCE = 0.002;

/**
 * Mark a bridged payment as used by the membership it paid for.
 *
 * The backend will not take the same transfer twice, and an upgrade screen
 * that kept counting it would offer the user a payment they have already
 * spent the next time they open it.
 */
export const markUpgradeFundingSpent = (clientTxId: string) =>
  useLifiSwapStore.getState().actions.update(clientTxId, { consumed: true });

/** The user's latest payment toward an upgrade that no membership has used yet. */
export const useUpgradeFunding = (): UpgradeFunding => {
  const { user } = useUser();
  const swaps = useLifiSwapStore(state => state.swaps);
  return useMemo(() => latestUpgradeFunding(swaps, user?.userId), [swaps, user?.userId]);
};

/**
 * What can pay the annual fee, as token rows: USDC on Fuse — at the balance
 * the upgrade screen reads off the chain — then every holding on another swap
 * chain worth swapping.
 */
export const useCashFundingTokens = ({
  billingTokenAddress,
  usdcRaw,
}: {
  billingTokenAddress: string | null | undefined;
  usdcRaw: bigint | undefined;
}): { tokens: TokenBalance[]; isLoading: boolean } => {
  const { tokens, isLoading } = useBalances();

  const rows = useMemo(() => {
    if (!billingTokenAddress) return [];
    return cashFundingTokens({
      tokens,
      billing: billingTokenRow({ address: billingTokenAddress, balanceRaw: usdcRaw ?? 0n }),
      lifiChainIds: FUNDING_CHAIN_IDS,
    });
  }, [tokens, billingTokenAddress, usdcRaw]);

  return { tokens: rows, isLoading };
};

/**
 * How the annual fee is being paid, worked out once for every step that shows
 * it — the offer, the token picker, the review and the progress screen — so
 * they cannot disagree about which token pays or whether it is enough.
 *
 * `token` is the user's pick, or the screen's default when they have not made
 * one (see `defaultCashToken`). `payingFromFuse` is the one-signature path:
 * USDC already on Fuse, including USDC an earlier bridged payment brought in.
 * Anything else is swapped to Fuse first.
 */
export const useCashPayment = ({
  membership,
  chain,
  feeUsd,
}: {
  membership: TierMembershipState | undefined;
  chain: TierUpgradeChainState | undefined;
  feeUsd: number;
}) => {
  const funding = useUpgradeFunding();
  const chosen = useTierUpgradeStore(state => state.cashToken);
  const billingTokenAddress = membership?.contracts.billingTokenAddress ?? undefined;
  const { tokens, isLoading } = useCashFundingTokens({
    billingTokenAddress,
    usdcRaw: chain?.usdc,
  });
  const fuseUsdc = chain?.usdcAmount ?? 0;
  const coverPct = membership?.bridgeFeeCoverPct ?? 0;

  return useMemo(() => {
    const coverUsd = arrivedFundingCoverUsd({ funding, feeUsd, fuseUsdc, coverPct });
    const chosenKey = chosen ? `${chosen.chainId}:${chosen.address.toLowerCase()}` : undefined;
    const picked = chosenKey ? tokens.find(token => cashTokenKey(token) === chosenKey) : undefined;
    // Until the Fuse balance has been read, the default stays on USDC on Fuse:
    // picking a token on another chain off a balance of zero that is merely
    // still loading would flip the row from Base to Fuse a moment later.
    const token =
      picked ??
      (billingTokenAddress
        ? chain
          ? defaultCashToken({ rows: tokens, billingTokenAddress, feeUsd, fuseUsdc, funding })
          : tokens[0]
        : undefined);
    const payingFromFuse =
      !token || !billingTokenAddress || isBillingToken(token, billingTokenAddress);

    const affordable =
      token && billingTokenAddress
        ? canPayCashWith({ token, billingTokenAddress, feeUsd, fuseUsdc, coverUsd })
        : feeUsd > 0 && covers(fuseUsdc, feeUsd);

    return {
      tokens,
      token,
      payingFromFuse,
      /** What is still missing on Fuse — what a bridged payment sends. */
      needUsd: fundingNeedUsd(feeUsd, fuseUsdc),
      /** What an arrived bridged payment earns off the first charge. */
      coverUsd,
      coverPct,
      funding,
      fuseUsdc,
      affordable,
      billingTokenAddress,
      isLoading,
    };
  }, [tokens, isLoading, chosen, billingTokenAddress, feeUsd, fuseUsdc, coverPct, funding, chain]);
};

export type CashPayment = ReturnType<typeof useCashPayment>;

/**
 * A live LI.FI quote for paying `needUsd` of the fee from `token`.
 *
 * Exact-in, like every LI.FI swap the app makes, so the amount sent is worked
 * out here: the shortfall plus a small buffer, at LI.FI's own price for the
 * token once a quote has named one. That is the price the backend values the
 * transfer at when it decides how much of the bridge's cost to absorb, so the
 * amount converges on it rather than on the wallet's, which can differ.
 *
 * Quoted with `purpose: tier_upgrade`, which the backend answers without
 * Solid's swap fee — the user is already paying for the membership.
 */
export const useCashFundingQuote = ({
  token,
  needUsd,
  billingTokenAddress,
  enabled,
}: {
  token: TokenBalance | undefined;
  needUsd: number;
  billingTokenAddress: string | null | undefined;
  enabled: boolean;
}) => {
  const { user } = useUser();
  const key = token ? cashTokenKey(token) : undefined;
  const [lifiPrice, setLifiPrice] = useState<{ key: string; price: number }>();
  const priceUsd = lifiPrice && lifiPrice.key === key ? lifiPrice.price : undefined;

  const fromAmount = useMemo(
    () => (token ? fundingSendAmount({ usd: needUsd, token, priceUsd }) : undefined),
    [token, needUsd, priceUsd],
  );

  const canQuote = enabled && !!user && !!token && !!fromAmount && !!billingTokenAddress;

  const query = useQuery({
    queryKey: ['tier-funding-quote', key, fromAmount?.toString(), billingTokenAddress],
    enabled: canQuote,
    queryFn: ({ signal }) =>
      withRefreshToken(() =>
        fetchLifiSwapQuote(
          {
            fromChain: token!.chainId,
            toChain: fuse.id,
            fromToken: token!.type === TokenType.NATIVE ? zeroAddress : token!.contractAddress,
            toToken: billingTokenAddress!,
            fromAmount: fromAmount!.toString(),
            purpose: 'tier_upgrade',
          },
          signal,
        ),
      ) as Promise<LifiSwapQuote>,
    refetchInterval: LIFI_QUOTE_REFRESH_MS,
    staleTime: LIFI_QUOTE_REFRESH_MS / 2,
    // A route that does not exist will not appear on retry; a busy backend might.
    retry: (count, err) => !(err instanceof LifiSwapApiError && err.status < 500) && count < 2,
  });

  const quote = canQuote ? query.data : undefined;

  // Re-sized once LI.FI has said what it thinks the token is worth, so the
  // amount sent is the shortfall at that price rather than at the wallet's.
  useEffect(() => {
    if (!quote || !key) return;
    const price = Number(quote.fromToken.priceUsd);
    if (!Number.isFinite(price) || price <= 0) return;
    const current = priceUsd ?? token?.quoteRate ?? 0;
    if (current > 0 && Math.abs(price - current) / current <= PRICE_DRIFT_TOLERANCE) return;
    setLifiPrice({ key, price });
  }, [quote, key, priceUsd, token?.quoteRate]);

  const error = useMemo(() => {
    if (!canQuote || !query.error) return undefined;
    if (query.error instanceof LifiSwapApiError) return query.error.message;
    return 'Could not get a quote. Try again.';
  }, [canQuote, query.error]);

  const isStale = !!quote && quote.fromAmount !== fromAmount?.toString();

  return {
    quote: isStale ? undefined : quote,
    fromAmount,
    // Only while there is nothing to show: the 20-second refresh replaces the
    // quote in place rather than blanking the rows under it.
    isQuoting: canQuote && !query.error && (!quote || isStale),
    error,
    /**
     * A fresh quote for signing. LI.FI's calldata expires, so the one on
     * screen is never the one signed. Rejects when it cannot be refreshed.
     */
    refresh: async (): Promise<LifiSwapQuote | undefined> => {
      const { data, isError, error: refetchError } = await query.refetch();
      if (isError) {
        throw refetchError instanceof Error
          ? refetchError
          : new Error('Could not refresh the quote. Try again.');
      }
      return data;
    },
  };
};
