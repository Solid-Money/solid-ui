import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Address, erc20Abi } from 'viem';
import { fuse } from 'viem/chains';

import { isCardSpendV2Configured, REPAY_TENDER_FALLBACK } from '@/constants/cardSpendV2';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { CARD_SPEND_REGISTRATION_QUERY_KEY } from '@/hooks/useCardSpendRegistration';
import useUser from '@/hooks/useUser';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { track } from '@/lib/analytics';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import {
  buildRepayCalls,
  type EscrowedCollateral,
  quoteRepay,
  repayDisplaySymbol,
  type RepaySource,
  type ReturnedCollateral,
  tokenToUsdFloor,
} from '@/lib/utils/cardRepay';
import { publicClient } from '@/lib/wagmi';
import { useUserStore } from '@/store/useUserStore';

export const CARD_REPAY_QUERY_KEY = 'cardCreditRepay';

const MODULE_V2 = ADDRESSES.fuse.cashModuleV2;

/** Everything the repay screen quotes from, read in two multicalls. */
export interface CardRepayState {
  /** Outstanding debt including accrued interest, 6-decimal USD. */
  debtUsd: bigint;
  /** WAD per second. Only used to size the accrual buffer on a full repayment. */
  borrowApyPerSecond: bigint;
  /**
   * Whether the module is enabled on the Safe. A wallet repayment goes through the module
   * when it is and through an allowance when it is not.
   */
  moduleEnabled: boolean;
  /** Every way to pay, funded and usable ones first. */
  sources: RepaySource[];
  /** What the module holds for the Safe. A full repayment sends it back. */
  collateral: EscrowedCollateral[];
}

export interface CardRepayRequest {
  sourceId: string;
  /** The typed amount, 6-decimal USD, or null when MAX is driving it. */
  amountUsd: bigint | null;
  isMax: boolean;
}

export interface CardRepayResult {
  transactionHash: string;
  repayUsd: bigint;
  isFull: boolean;
  source: RepaySource;
  returnedCollateral: ReturnedCollateral[];
}

/** Calls read per allowlisted token, in the order {@link readCardRepayState} unpacks them. */
const PER_TOKEN_CALLS = 7;

const PRICE_UNAVAILABLE = 'Its price is unavailable right now.';

/**
 * The Safe's position and every token it could repay with.
 *
 * The allowlist is walked rather than hard-coded, so a token the module adds or drops shows
 * up here without a release. Per-token reads may fail individually — `repayTender` does on
 * the build deployed today, which predates it — and a token that cannot be read in full is
 * simply not offered: quoting a repayment against a balance or price we do not have would put
 * a figure on screen the module then contradicts.
 */
const readCardRepayState = async (safe: Address): Promise<CardRepayState> => {
  const client = publicClient(fuse.id);
  const module = { address: MODULE_V2, abi: SolidCashModuleV2_ABI } as const;

  const [tokens, debtUsd, moduleEnabled, borrowApyPerSecond] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...module, functionName: 'allowedTokens' },
      { ...module, functionName: 'debtUsd', args: [safe] },
      { ...module, functionName: 'isModuleEnabledOn', args: [safe] },
      { ...module, functionName: 'borrowApyPerSecond' },
    ],
  });

  const results = await client.multicall({
    allowFailure: true,
    contracts: tokens.flatMap(token => [
      { address: token, abi: erc20Abi, functionName: 'symbol' },
      { address: token, abi: erc20Abi, functionName: 'decimals' },
      { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [safe] },
      { ...module, functionName: 'collateralOf', args: [safe, token] },
      { ...module, functionName: 'getPriceUsd', args: [token] },
      { ...module, functionName: 'tokenPaused', args: [token] },
      { ...module, functionName: 'repayTender', args: [token] },
    ]) as never[],
  });

  const fallbackTender = new Set(REPAY_TENDER_FALLBACK.map(address => address.toLowerCase()));
  const wallet: RepaySource[] = [];
  const escrowed: RepaySource[] = [];
  const collateral: EscrowedCollateral[] = [];

  tokens.forEach((token, index) => {
    const slice = results.slice(index * PER_TOKEN_CALLS, (index + 1) * PER_TOKEN_CALLS);
    const [
      symbolRead,
      decimalsRead,
      balanceRead,
      collateralRead,
      priceRead,
      pausedRead,
      tenderRead,
    ] = slice as { status: string; result?: unknown }[];

    // The six reads a quote cannot do without. `repayTender` is the one allowed to fail.
    if (
      [symbolRead, decimalsRead, balanceRead, collateralRead, priceRead, pausedRead].some(
        read => read?.status !== 'success',
      )
    ) {
      return;
    }

    const symbol = symbolRead.result as string;
    const decimals = Number(decimalsRead.result);
    const balance = balanceRead.result as bigint;
    const escrowedAmount = collateralRead.result as bigint;
    const [price, usable, inBand] = priceRead.result as readonly [bigint, boolean, boolean];
    const paused = pausedRead.result as boolean;
    const isTender =
      tenderRead?.status === 'success'
        ? (tenderRead.result as boolean)
        : fallbackTender.has(token.toLowerCase());

    // Every repay path prices with the module's strict accessor, which reverts on an unusable
    // price and on one above the band's ceiling. `getPriceUsd` reports both.
    const priced = usable && inBand && price > 0n;
    const displaySymbol = repayDisplaySymbol(symbol);
    const base = { token, symbol, displaySymbol, decimals, priceUsd: priced ? price : 0n };

    if (isTender) {
      wallet.push({
        ...base,
        id: `wallet:${token}`,
        kind: 'wallet',
        balance,
        valueUsd: priced ? tokenToUsdFloor(balance, price, decimals) : 0n,
        // The guardian's pause refuses tender outright; it does not gate spending collateral.
        unavailableReason: paused
          ? `${displaySymbol} is paused right now.`
          : priced
            ? null
            : PRICE_UNAVAILABLE,
      });
    }

    if (escrowedAmount > 0n) {
      collateral.push({ ...base, amount: escrowedAmount });
      escrowed.push({
        ...base,
        id: `collateral:${token}`,
        kind: 'collateral',
        balance: escrowedAmount,
        valueUsd: priced ? tokenToUsdFloor(escrowedAmount, price, decimals) : 0n,
        unavailableReason: priced ? null : PRICE_UNAVAILABLE,
      });
    }
  });

  // Usable before unusable, then by what each is worth, so the default is the source that can
  // repay the most.
  const byUsefulness = (a: RepaySource, b: RepaySource) => {
    const aUsable = a.unavailableReason === null ? 1 : 0;
    const bUsable = b.unavailableReason === null ? 1 : 0;
    if (aUsable !== bUsable) return bUsable - aUsable;
    if (a.valueUsd !== b.valueUsd) return a.valueUsd > b.valueUsd ? -1 : 1;
    return 0;
  };

  return {
    debtUsd,
    borrowApyPerSecond,
    moduleEnabled,
    sources: [...wallet, ...escrowed].sort(byUsefulness),
    collateral,
  };
};

const cardRepayQueryOptions = (selectedUserId: string | undefined, safe: Address | undefined) => ({
  queryKey: [CARD_REPAY_QUERY_KEY, selectedUserId, safe],
  queryFn: () => readCardRepayState(safe!),
  retry: false,
  staleTime: 15_000,
});

/**
 * Repaying the card's credit position on `SolidCashModuleV2`.
 *
 * Every call is sent by the Safe itself in one user operation, so the cardholder signs once:
 * the repayment, and on a full one the withdrawals that return the remaining collateral. The
 * batch is also what makes a full close possible at all — `withdrawCollateral` refuses while
 * any debt remains, and it is the repayment ahead of it in the same batch that clears it.
 *
 * The quote is recomputed against a fresh read right before signing, with the same function
 * the screen used. A balance, price or debt that moved while the sheet sat open therefore
 * costs a message instead of a failed user operation.
 */
export function useCardRepay({ enabled = true }: { enabled?: boolean } = {}) {
  const { user, safeAA } = useUser();
  const queryClient = useQueryClient();
  const selectedUserId = useUserStore(state => state.users.find(u => u.selected)?.userId);
  const [error, setError] = useState<string | null>(null);

  const safeAddress = user?.safeAddress as Address | undefined;
  const isEnabled = enabled && isCardSpendV2Configured() && Boolean(safeAddress);

  const query = useQuery<CardRepayState>({
    ...cardRepayQueryOptions(selectedUserId, safeAddress),
    enabled: isEnabled,
  });

  const mutation = useMutation({
    mutationFn: async ({
      sourceId,
      amountUsd,
      isMax,
    }: CardRepayRequest): Promise<CardRepayResult | null> => {
      if (!user?.suborgId || !user?.signWith || !safeAddress) {
        throw new Error('Your wallet is still setting up. Please try again shortly.');
      }

      const fresh = await queryClient.fetchQuery({
        ...cardRepayQueryOptions(selectedUserId, safeAddress),
        staleTime: 0,
      });

      const source = fresh.sources.find(candidate => candidate.id === sourceId);
      if (!source) throw new Error('That payment option is no longer available.');

      const quote = quoteRepay({
        debtUsd: fresh.debtUsd,
        borrowApyPerSecond: fresh.borrowApyPerSecond,
        source,
        collateral: fresh.collateral,
        amountUsd,
        isMax,
      });
      if (!quote.ok) throw new Error(quote.reason ?? 'Enter an amount to repay.');

      const calls = buildRepayCalls({
        safe: safeAddress,
        module: MODULE_V2,
        moduleEnabled: fresh.moduleEnabled,
        source,
        quote,
      });

      const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);
      const result = await executeTransactions(
        smartAccountClient,
        calls,
        'Failed to repay your loan',
        fuse,
      );

      if (result === USER_CANCELLED_TRANSACTION) {
        track(TRACKING_EVENTS.CARD_CREDIT_REPAY_CANCELLED, { source: source.kind });
        return null;
      }

      return {
        transactionHash: result.transactionHash,
        repayUsd: quote.repayUsd,
        isFull: quote.isFull,
        source,
        returnedCollateral: quote.returnedCollateral,
      };
    },
    onSuccess: result => {
      if (!result) return;
      // The position, the credit line and the Safe's balances all moved.
      queryClient.invalidateQueries({ queryKey: [CARD_REPAY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });
      queryClient.invalidateQueries({ queryKey: ['cardDetails'] });
      track(TRACKING_EVENTS.CARD_CREDIT_REPAY_COMPLETED, {
        source: result.source.kind,
        token: result.source.displaySymbol,
        repay_usd: Number(result.repayUsd) / 1_000_000,
        is_full: result.isFull,
        collateral_returned: result.returnedCollateral.length > 0,
        transaction_hash: result.transactionHash,
      });
    },
    onError: (mutationError: Error) => {
      const message = mutationError?.message || 'Failed to repay your loan';
      setError(message);
      track(TRACKING_EVENTS.CARD_CREDIT_REPAY_FAILED, { error: message });
    },
  });

  /**
   * Repay from the chosen source.
   *
   * Resolves with the result once it is on-chain, `null` when the signature prompt was
   * dismissed, and rejects on a real failure — the same three outcomes as `switchMode`, for
   * the same reason: a dismissed prompt is not an error to show.
   */
  const repay = useCallback(
    async (request: CardRepayRequest): Promise<CardRepayResult | null> => {
      setError(null);
      track(TRACKING_EVENTS.CARD_CREDIT_REPAY_PRESSED, { is_max: request.isMax });
      return mutation.mutateAsync(request);
    },
    [mutation],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    state: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    repay,
    isRepaying: mutation.isPending,
    error,
    clearError,
  };
}

export default useCardRepay;
