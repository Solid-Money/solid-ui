import { useCallback, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { base } from 'viem/chains';

import { formatUsd } from '@/constants/cardSpendModule';
import { explorerUrls } from '@/constants/explorers';
import {
  type CardRepayChainId,
  type CardRepayRequest,
  type CardRepayState,
  useCardRepay,
} from '@/hooks/useCardRepay';
import { eclipseAddress } from '@/lib/utils';
import { formatRepayTokenAmount } from '@/lib/utils/cardRepay';

/** Everything a loan's repay step needs. */
export interface LoanRepay {
  state: CardRepayState | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Resolves true once the repayment is on-chain, false when it did not happen. */
  onRepay: (request: CardRepayRequest) => Promise<boolean>;
  isRepaying: boolean;
  error: string | null;
  onClearError: () => void;
}

/** The block explorer link for a transaction on a card instance. */
export const explorerTxUrl =
  (chainId: number) =>
  (hash: string): string | undefined => {
    // `explorerUrls` has no Base entry; viem's is Basescan, as card transactions link to.
    const explorer =
      explorerUrls[chainId]?.blockscout ??
      (chainId === base.id ? base.blockExplorers.default.url : undefined);
    return explorer ? `${explorer}/tx/${hash}` : undefined;
  };

/**
 * One loan's repay step: its reads, and the signature behind a confirmed amount.
 *
 * The step stays open on failure with the reason, because a silently closed sheet reads as
 * success; on success the caller moves on, so the updated figures are what is seen next.
 */
export const useLoanRepay = (chainId: CardRepayChainId, enabled: boolean): LoanRepay => {
  const { state, isLoading, isError, refetch, repay, isRepaying, error, clearError } = useCardRepay(
    { enabled, chainId },
  );

  const confirmRepay = useCallback(
    async (request: CardRepayRequest) => {
      // `repay` resolves null when the signature prompt was dismissed, which is not a failure
      // and must not move the sheet. A real failure has already been recorded as `error`.
      const result = await repay(request).catch(() => null);
      if (!result) return false;

      const returned = result.returnedCollateral
        .map(item => `${formatRepayTokenAmount(item.amount, item.decimals)} ${item.displaySymbol}`)
        .join(' and ');
      const link = explorerTxUrl(chainId)(result.transactionHash);

      Toast.show({
        type: 'success',
        text1: result.isFull ? 'Loan repaid' : `Repaid ${formatUsd(result.repayUsd)}`,
        text2: returned ? `${returned} is back in your wallet` : undefined,
        props: link ? { link, linkText: eclipseAddress(result.transactionHash) } : undefined,
      });
      return true;
    },
    [chainId, repay],
  );

  return useMemo<LoanRepay>(
    () => ({
      state,
      isLoading,
      isError,
      onRetry: () => void refetch(),
      onRepay: confirmRepay,
      isRepaying,
      error,
      onClearError: clearError,
    }),
    [state, isLoading, isError, refetch, confirmRepay, isRepaying, error, clearError],
  );
};

export default useLoanRepay;
