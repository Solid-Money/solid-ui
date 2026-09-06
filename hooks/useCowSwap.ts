import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mainnet } from 'viem/chains';

import { useRecordStocksFee } from '@/hooks/useStocksFee';
import {
  buildPresignTransactions,
  cowGetOrder,
  cowGetQuote,
  cowGetSlippageTolerance,
  cowGetTokenUsdPrice,
  CowOrderKind,
  CowOrderStatus,
  CowQuoteResponse,
  cowSubmitPresignOrder,
  USDC_MAINNET,
} from '@/lib/cowswap';
import { executeTransactions } from '@/lib/execute';
import { TransactionType } from '@/lib/types';
import { BatchTransaction, SwapFee } from '@/lib/utils/swapFee';

import { useActivityActions } from './useActivityActions';
import useUser from './useUser';

const QUOTE_REFRESH_SECONDS = 20;
const ORDER_POLL_INTERVAL_MS = 5_000;

// ─── useCowQuote ─────────────────────────────────────────────────────────────

export type CowQuoteParams = {
  sellToken: string;
  buyToken: string;
  sellAmountBeforeFee: string;
  kind: CowOrderKind;
  enabled: boolean;
};

export function useCowQuote(params: CowQuoteParams) {
  const { user } = useUser();
  const [quote, setQuote] = useState<CowQuoteResponse | null>(null);
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QUOTE_REFRESH_SECONDS);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const canFetch =
    params.enabled &&
    !!params.sellToken &&
    !!params.buyToken &&
    !!params.sellAmountBeforeFee &&
    params.sellAmountBeforeFee !== '0' &&
    !!user?.safeAddress;

  const fetchQuote = useCallback(async () => {
    if (!canFetch || !user?.safeAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      // Determine which token is the stock (non-USDC) for reference price lookup
      const isBuyingStock = params.sellToken.toLowerCase() === USDC_MAINNET.toLowerCase();
      const stockToken = isBuyingStock ? params.buyToken : params.sellToken;

      // Fetch quote, slippage tolerance, and reference price in parallel
      const [result, baseBps, refPrice] = await Promise.all([
        cowGetQuote({
          sellToken: params.sellToken,
          buyToken: params.buyToken,
          from: user.safeAddress,
          kind: params.kind,
          sellAmountBeforeFee: params.sellAmountBeforeFee,
        }),
        cowGetSlippageTolerance(params.sellToken, params.buyToken),
        cowGetTokenUsdPrice(stockToken),
      ]);

      // Compute price impact: how much worse the quote is vs the reference market price.
      // This mirrors CoW Swap's "dynamic slippage" which = priceImpact + baseSlippage.
      let effectiveBps = baseBps;
      if (refPrice && refPrice > 0) {
        let priceImpact = 0;
        if (isBuyingStock) {
          // Spending USDC to buy stock: sellAmountBeforeFee is USDC atoms (6 dec)
          const spendUsdc = Number(params.sellAmountBeforeFee) / 1e6;
          const expectedShares = spendUsdc / refPrice;
          const actualShares = Number(result.quote.buyAmount) / 1e18;
          priceImpact = Math.max(0, (expectedShares - actualShares) / expectedShares);
        } else {
          // Selling stock for USDC: sellAmountBeforeFee is stock atoms (18 dec)
          const sellShares = Number(params.sellAmountBeforeFee) / 1e18;
          const expectedUsdc = sellShares * refPrice;
          const actualUsdc = Number(result.quote.buyAmount) / 1e6;
          priceImpact = Math.max(0, (expectedUsdc - actualUsdc) / expectedUsdc);
        }
        effectiveBps = Math.round(baseBps + priceImpact * 10_000);
      }

      if (mountedRef.current) {
        setQuote(result);
        setSlippageBps(effectiveBps);
        setCountdown(QUOTE_REFRESH_SECONDS);
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e.message ?? 'Failed to get quote');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    canFetch,
    params.sellToken,
    params.buyToken,
    params.sellAmountBeforeFee,
    params.kind,
    user?.safeAddress,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canFetch) {
      setQuote(null);
      setError(null);
      return;
    }

    fetchQuote();

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchQuote();
          return QUOTE_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchQuote, canFetch]);

  return useMemo(
    () => ({ quote, slippageBps, isLoading, error, countdown, refetch: fetchQuote }),
    [quote, slippageBps, isLoading, error, countdown, fetchQuote],
  );
}

// ─── useCowOrder ─────────────────────────────────────────────────────────────

export type CowOrderResult = {
  orderUid: string | null;
  orderStatus: CowOrderStatus | null;
  isSubmitting: boolean;
  error: string | null;
  placeOrder: (quote: CowQuoteResponse, slippageBps?: number) => Promise<void>;
  reset: () => void;
};

/** Solid's fee on this trade, plus what the reporter needs to book it. */
export type CowOrderFee = {
  fee: SwapFee;
  feeTransaction: BatchTransaction | null;
  /** USD price of one whole sell token — the share price when selling a stock. */
  sellTokenPriceUsd: number | undefined;
  /** True when the sell side is the stock rather than USDC. */
  isSellingStock: boolean;
};

export function useCowOrder(
  sellTokenSymbol: string,
  buyTokenSymbol: string,
  orderFee?: CowOrderFee,
): CowOrderResult {
  const { user, safeAA } = useUser();
  const { trackTransaction } = useActivityActions();
  const queryClient = useQueryClient();

  const [orderUid, setOrderUid] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<CowOrderStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const reportStocksFee = useRecordStocksFee();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(uid: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await cowGetOrder(uid);
        if (!mountedRef.current) return;
        setOrderStatus(status);
        if (status === 'fulfilled' || status === 'cancelled' || status === 'expired') {
          clearInterval(pollRef.current!);
          setIsSubmitting(false);
          if (status === 'fulfilled') {
            queryClient.invalidateQueries({ queryKey: ['xstockHoldings'] });
          }
        }
      } catch {
        // keep polling on transient errors
      }
    }, ORDER_POLL_INTERVAL_MS);
  }

  const placeOrder = useCallback(
    async (quote: CowQuoteResponse, slippageBps: number = 100) => {
      if (!user?.safeAddress || !user?.suborgId || !user?.signWith) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // 1. Submit order with the slippage already fetched at quote time
        const { uid, sellAmount } = await cowSubmitPresignOrder(
          quote,
          user.safeAddress,
          slippageBps,
        );
        if (mountedRef.current) {
          setOrderUid(uid);
          setOrderStatus('presignaturePending');
        }

        // 2. Build approve + setPreSignature transactions
        // sellAmount here is the full amount (sellAmount + feeAmount) since feeAmount is 0
        const transactions = buildPresignTransactions(uid, quote.quote.sellToken, sellAmount);

        // Solid's fee, in the same batch so the user signs once. Appended after
        // the pre-sign rather than before it: the order is what the user came
        // for, and a batch that took the fee first and then failed to pre-sign
        // would have charged for nothing.
        if (orderFee?.feeTransaction) {
          transactions.push({
            to: orderFee.feeTransaction.to,
            data: orderFee.feeTransaction.data,
            value: orderFee.feeTransaction.value ?? 0n,
          });
        }

        // 3. Execute batch via Safe AA on Ethereum mainnet
        const smartAccountClient = await safeAA(mainnet, user.suborgId, user.signWith);

        const result = await trackTransaction(
          {
            type: TransactionType.SWAP,
            title: `${sellTokenSymbol} → ${buyTokenSymbol}`,
            shortTitle: `${sellTokenSymbol} → ${buyTokenSymbol}`,
            amount: quote.quote.sellAmount,
            symbol: sellTokenSymbol,
            chainId: mainnet.id,
            fromAddress: user.safeAddress,
            toAddress: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
            metadata: {
              platform: 'cowswap',
              orderUid: uid,
              inputToken: sellTokenSymbol,
              outputToken: buyTokenSymbol,
              sellAmount: quote.quote.sellAmount,
              buyAmount: quote.quote.buyAmount,
            },
          },
          onUserOpHash =>
            executeTransactions(
              smartAccountClient,
              transactions,
              'Stock swap failed',
              mainnet,
              onUserOpHash,
            ),
        );

        // 4. Record the fee we just collected. The order is placed either way —
        // it settles off-chain through CoW — so this is bookkeeping, not a gate.
        if (orderFee) {
          reportStocksFee({
            orderUid: uid,
            transactionHash:
              result && typeof result === 'object' && 'transactionHash' in result
                ? result.transactionHash
                : undefined,
            fee: orderFee.fee,
            sellTokenAddress: quote.quote.sellToken,
            sellTokenSymbol,
            sellTokenPriceUsd: orderFee.sellTokenPriceUsd,
            isSellingStock: orderFee.isSellingStock,
          });
        }

        // 5. Poll for order fulfillment
        startPolling(uid);
      } catch (e: any) {
        if (mountedRef.current) {
          setError(e.message ?? 'Failed to place order');
          setIsSubmitting(false);
        }
        throw e;
      }
    },
    [user, safeAA, trackTransaction, sellTokenSymbol, buyTokenSymbol, orderFee, reportStocksFee],
  );

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setOrderUid(null);
    setOrderStatus(null);
    setIsSubmitting(false);
    setError(null);
  }, []);

  return useMemo(
    () => ({ orderUid, orderStatus, isSubmitting, error, placeOrder, reset }),
    [orderUid, orderStatus, isSubmitting, error, placeOrder, reset],
  );
}
