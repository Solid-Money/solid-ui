import { useMemo } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { fuse } from 'viem/chains';

import { USDC_STARGATE } from '@/constants/addresses';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { CrossChainSendApiError, fetchCrossChainSendQuote } from '@/lib/api/cross-chain-send';
import { BridgeCap, bridgeCap, BridgePlanError, planBridge } from '@/lib/cashoutBridge';
import { withRefreshToken } from '@/lib/utils';

/** The USDC on Fuse a cash-out can top up from, and the bounds on moving it. */
export interface CashoutBridgeSource {
  balanceWei: bigint;
  /** The bridge's per-send minimum. */
  minLD: bigint;
  cap: BridgeCap;
  networkName: string;
  etaMinutes: number;
}

const quoteFromFuse = (chainId: number, amountLD: bigint) =>
  withRefreshToken(() =>
    fetchCrossChainSendQuote({ token: 'USDC', dstChainId: chainId, amountLD: amountLD.toString() }),
  );

/**
 * The USDC on Fuse a cash-out to `chainId` can top up from, or undefined when
 * it can't: the cross-chain send is off, there's no live USDC route to that
 * chain, the route has no credit, today's sends are used up, or the Fuse
 * balance is under the bridge's minimum. Undefined means the cash-out counts
 * only the balance on `chainId`, exactly as before.
 */
export const useCashoutBridge = (chainId?: number) => {
  const { tokens, isLoading: tokensLoading } = useWalletTokens();
  const { config, isLoading: configLoading } = useCrossChainSendConfig({ enabled: !!chainId });

  const source = useMemo((): CashoutBridgeSource | undefined => {
    if (!chainId || !config?.enabled) return undefined;
    const network = config.networks.find(n => n.chainId === chainId);
    const route = config.routes.find(r => r.token === 'USDC' && r.chainId === chainId);
    if (network?.status !== 'live' || !network.tokens.includes('USDC') || !route?.available) {
      return undefined;
    }
    if (config.usage.sendsToday >= config.limits.dailySends) return undefined;

    const token = tokens.find(
      t => t.chainId === fuse.id && t.contractAddress.toLowerCase() === USDC_STARGATE.toLowerCase(),
    );
    const balanceWei = BigInt(token?.balance || '0');
    const minLD = BigInt(config.limits.perSendMin);
    const dailyLeft = BigInt(config.limits.dailyMax) - BigInt(config.usage.sentTodayLD);
    const cap = bridgeCap({
      balance: balanceWei,
      per_send: BigInt(config.limits.perSendMax),
      daily: dailyLeft > 0n ? dailyLeft : 0n,
      route: BigInt(route.maxAmountLD),
    });
    if (cap.amountLD < minLD) return undefined;

    return { balanceWei, minLD, cap, networkName: network.name, etaMinutes: network.etaMinutes };
  }, [chainId, config, tokens]);

  return { source, isLoading: tokensLoading || configLoading };
};

/** The planned move from Fuse covering `shortfallLD` — shared by Amount and Review. */
export const cashoutBridgePlanQuery = (
  chainId: number,
  shortfallLD: bigint,
  source: CashoutBridgeSource,
) => ({
  queryKey: [
    'cashout-bridge',
    'plan',
    chainId,
    shortfallLD.toString(),
    source.cap.amountLD.toString(),
  ] as const,
  queryFn: () =>
    planBridge({
      shortfallLD,
      minLD: source.minLD,
      cap: source.cap,
      quote: amountLD => quoteFromFuse(chainId, amountLD),
    }),
  staleTime: 20 * 1000,
  // A refusal with a message (over a limit, below the minimum) won't change on retry.
  retry: (failureCount: number, error: unknown) =>
    !(error instanceof BridgePlanError) &&
    !(error instanceof CrossChainSendApiError && error.status < 500) &&
    failureCount < 2,
});

export const useCashoutBridgePlan = (
  chainId: number | undefined,
  shortfallLD: bigint,
  source: CashoutBridgeSource | undefined,
  enabled = true,
) => {
  const options =
    chainId && source && shortfallLD > 0n
      ? cashoutBridgePlanQuery(chainId, shortfallLD, source)
      : undefined;
  return useQuery({
    queryKey: options?.queryKey ?? ['cashout-bridge', 'plan', 'none'],
    queryFn: options && enabled ? options.queryFn : skipToken,
    staleTime: options?.staleTime,
    retry: options?.retry,
  });
};

/** What moving the most allowed from Fuse would land on `chainId`, for Max. */
export const cashoutBridgeMaxQuery = (chainId: number, source: CashoutBridgeSource) => ({
  queryKey: ['cross-chain-send', 'quote', 'USDC', chainId, source.cap.amountLD.toString()],
  queryFn: () => quoteFromFuse(chainId, source.cap.amountLD),
  staleTime: 20 * 1000,
});

/** A plan failure as one sentence for the screen. */
export const bridgePlanMessage = (error: unknown): string =>
  error instanceof BridgePlanError || error instanceof CrossChainSendApiError
    ? error.message
    : 'We couldn’t price the move from Fuse. Please try again';
