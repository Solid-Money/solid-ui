import { useCallback, useMemo } from 'react';
import { Currency } from '@cryptoalgebra/fuse-sdk';
import * as Sentry from '@sentry/react-native';

import { useRecordSwapFee } from '@/hooks/useProductFees';
import { useUSDCPrice } from '@/hooks/useUSDCValue';
import {
  BatchTransaction,
  buildSwapFeeTransfer,
  SwapFee,
  toFeeCurrencyAmount,
} from '@/lib/utils/swapFee';

/** The fee to collect on a swap, as `useDerivedSwapInfo` sized it. */
export interface SwapFeeCollection {
  fee: SwapFee;
  /** Undefined means the revenue wallet isn't configured — collect nothing. */
  revenueWalletAddress?: string;
}

export interface SwapFeeCollector {
  /**
   * The transfer to append to the swap batch, or null when nothing is owed.
   *
   * Appended to the same batch as the swap, so the fee costs the user no extra
   * signature and no extra gas approval — which is the whole reason the fee can
   * be collected on-chain at all.
   */
  feeTransaction: BatchTransaction | null;
  /**
   * Tell the backend the fee was collected, once the swap has landed.
   *
   * Deliberately swallows its own failures. The fee is already on chain by the
   * time this runs, so a failed report is a bookkeeping gap to backfill — never
   * a reason to surface an error on a swap that succeeded.
   */
  reportCollectedFee: (transactionHash: string | undefined) => void;
}

/**
 * Collecting Solid's swap fee: the transfer that takes it, and the report that
 * records it.
 *
 * Sits between `useDerivedSwapInfo` (which sizes the fee from the user's tier)
 * and the three swap callbacks (which build the batch), so all three collect
 * and report identically rather than growing three copies of the rule.
 */
export function useSwapFeeCollection(
  collection: SwapFeeCollection | undefined,
  inputCurrency: Currency | undefined,
): SwapFeeCollector {
  const { mutate: recordFee } = useRecordSwapFee();
  const { price: inputPrice } = useUSDCPrice(inputCurrency);

  const fee = collection?.fee;

  const feeTransaction = useMemo(() => {
    if (!fee || fee.feeAmount <= 0n || !inputCurrency) return null;

    return buildSwapFeeTransfer({
      feeAmount: fee.feeAmount,
      tokenAddress: inputCurrency.isToken ? inputCurrency.address : undefined,
      revenueWalletAddress: collection?.revenueWalletAddress,
      isNative: inputCurrency.isNative,
    });
  }, [fee, inputCurrency, collection?.revenueWalletAddress]);

  const reportCollectedFee = useCallback(
    (transactionHash: string | undefined) => {
      // No hash means nothing verifiable to report against, and no transaction
      // in the batch means no fee moved.
      if (!transactionHash || !feeTransaction || !fee || !inputCurrency) return;

      const feeAmount = toFeeCurrencyAmount(inputCurrency, fee.feeAmount);
      const swapAmount = toFeeCurrencyAmount(inputCurrency, fee.swapAmount);
      if (!feeAmount || !swapAmount) return;

      // The USD figures are what the revenue ledger books, so a missing price
      // is reported as 0 rather than guessed: the server re-checks the amount
      // against the tier and the token amount is on chain either way.
      const feeAmountUsd = inputPrice ? Number(inputPrice.quote(feeAmount).toSignificant(8)) : 0;
      const baseAmountUsd = inputPrice ? Number(inputPrice.quote(swapAmount).toSignificant(8)) : 0;

      recordFee(
        {
          transactionHash,
          baseAmountUsd,
          feeTokenAddress: inputCurrency.isToken
            ? inputCurrency.address
            : inputCurrency.wrapped.address,
          feeTokenSymbol: inputCurrency.symbol,
          feeTokenAmount: fee.feeAmount.toString(),
          feeAmountUsd,
          percentage: fee.rate,
        },
        {
          onError: error => {
            // Worth a breadcrumb rather than a toast: the user's swap worked,
            // and this is revenue we hold but have not yet written down.
            Sentry.captureException(error, {
              tags: { type: 'swap_fee_report_failed' },
              extra: {
                transactionHash,
                feeTokenAmount: fee.feeAmount.toString(),
                feeAmountUsd,
              },
            });
          },
        },
      );
    },
    [feeTransaction, fee, inputCurrency, inputPrice, recordFee],
  );

  return { feeTransaction, reportCollectedFee };
}
