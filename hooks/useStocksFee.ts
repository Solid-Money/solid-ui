import { useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';
import { useMutation } from '@tanstack/react-query';

import { useProductFeeRates } from '@/hooks/useProductFees';
import { recordStocksFee } from '@/lib/api';
import { USDC_DECIMALS } from '@/lib/cowswap';
import { FeeProduct, RecordStocksFeeParams } from '@/lib/types';
import {
  BatchTransaction,
  buildSwapFeeTransfer,
  computeSwapFee,
  noSwapFee,
  SwapFee,
  SwapFeeBasis,
} from '@/lib/utils/swapFee';

/** Stock tokens are 18-decimal ERC-20s; USDC on mainnet is 6. */
const STOCK_DECIMALS = 18;

export interface StocksFee {
  fee: SwapFee;
  /**
   * What to quote CoW on — the typed amount minus our fee.
   *
   * The fee is carved out rather than added on top for the same reason it is on
   * a swap: the order is pre-signed for exactly this amount, so quoting the
   * gross and transferring the fee alongside would need funds beyond what the
   * user committed, and would break a max-balance sell outright.
   */
  netSellAmountAtoms: string;
  /** The transfer to append to the pre-sign batch, or null when nothing is owed. */
  feeTransaction: BatchTransaction | null;
  /** Rate applied, as a fraction — for the fee line in the confirm sheet. */
  rate: number;
}

/**
 * Solid's fee on a stock trade.
 *
 * Stock trades settle through CoW, whose order is pre-signed by a batched
 * transaction on mainnet — the same shape as a swap — so the fee rides in that
 * batch and costs the user no extra signature.
 *
 * The fee always comes off the **sell** side, whichever direction the trade
 * runs: USDC when buying, the stock token when selling. That is the only token
 * the user is guaranteed to hold at this point in the batch.
 */
export function useStocksFee({
  sellAmountAtoms,
  sellTokenAddress,
}: {
  sellAmountAtoms: string;
  sellTokenAddress: string | undefined;
}): StocksFee {
  const { data: rates } = useProductFeeRates();
  const rate = rates?.rates?.[FeeProduct.STOCKS];

  const fee = useMemo(() => {
    let amount: bigint;
    try {
      amount = BigInt(sellAmountAtoms || '0');
    } catch {
      // A malformed amount is the caller's problem to surface, not a reason to
      // guess a fee off it.
      return noSwapFee(0n);
    }

    return computeSwapFee({
      amount,
      rate,
      basis: SwapFeeBasis.DeductedFromInput,
    });
  }, [sellAmountAtoms, rate]);

  const feeTransaction = useMemo(
    () =>
      buildSwapFeeTransfer({
        feeAmount: fee.feeAmount,
        tokenAddress: sellTokenAddress,
        revenueWalletAddress: rates?.revenueWalletAddress,
        // CoW only trades ERC-20s — there is no native leg to handle here.
        isNative: false,
      }),
    [fee.feeAmount, sellTokenAddress, rates?.revenueWalletAddress],
  );

  return {
    fee,
    netSellAmountAtoms: fee.swapAmount.toString(),
    feeTransaction,
    rate: fee.rate,
  };
}

/**
 * Report a collected stocks fee to the backend.
 *
 * Fire-and-forget from the caller's point of view: the fee is on chain by the
 * time this runs, so a failed report is a bookkeeping gap to backfill, never a
 * reason to fail an order the user has already placed.
 */
export function useRecordStocksFee() {
  const { mutate } = useMutation({
    mutationFn: async (params: RecordStocksFeeParams) => recordStocksFee(params),
  });

  return useCallback(
    ({
      orderUid,
      transactionHash,
      fee,
      sellTokenAddress,
      sellTokenSymbol,
      sellTokenPriceUsd,
      isSellingStock,
    }: {
      orderUid: string;
      transactionHash?: string;
      fee: SwapFee;
      sellTokenAddress: string;
      sellTokenSymbol?: string;
      /** USD price of one whole sell token — the share price when selling. */
      sellTokenPriceUsd: number | undefined;
      /** True when the sell side is the stock (18 dec), false when it is USDC (6). */
      isSellingStock: boolean;
    }) => {
      if (fee.feeAmount <= 0n) return;

      const decimals = isSellingStock ? STOCK_DECIMALS : USDC_DECIMALS;
      const unitPrice = isSellingStock ? (sellTokenPriceUsd ?? 0) : 1;

      const toUsd = (atoms: bigint) => (Number(atoms) / 10 ** decimals) * unitPrice;

      mutate(
        {
          orderUid,
          transactionHash,
          baseAmountUsd: toUsd(fee.swapAmount),
          feeTokenAddress: sellTokenAddress,
          feeTokenSymbol: sellTokenSymbol,
          feeTokenAmount: fee.feeAmount.toString(),
          feeAmountUsd: toUsd(fee.feeAmount),
          percentage: fee.rate,
        },
        {
          onError: error => {
            // A breadcrumb rather than a toast: the user's order was placed, and
            // this is revenue we hold but have not written down.
            Sentry.captureException(error, {
              tags: { type: 'stocks_fee_report_failed' },
              extra: { orderUid, feeTokenAmount: fee.feeAmount.toString() },
            });
          },
        },
      );
    },
    [mutate],
  );
}
