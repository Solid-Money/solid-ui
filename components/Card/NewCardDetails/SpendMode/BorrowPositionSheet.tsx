import { useCallback, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { base, fuse } from 'viem/chains';

import BorrowPositionSheetContent, {
  BORROW_POSITION_SHEET_BOTTOM,
  BORROW_POSITION_SHEET_TOP,
  type BorrowPositionRepay,
} from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheetContent';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import useCreditModeFigures from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { formatUsd } from '@/constants/cardSpendModule';
import { explorerUrls } from '@/constants/explorers';
import { type CardRepayChainId, type CardRepayRequest, useCardRepay } from '@/hooks/useCardRepay';
import { eclipseAddress } from '@/lib/utils';
import { formatRepayTokenAmount } from '@/lib/utils/cardRepay';

interface BorrowPositionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One instance's repay step: its reads, and the signature behind a confirmed amount.
 *
 * The sheet stays open on failure with the reason, because a silently closed sheet reads as
 * success, and on success slides back to the position so the new figures are what the
 * cardholder sees next.
 */
const useInstanceRepay = (chainId: CardRepayChainId, enabled: boolean): BorrowPositionRepay => {
  const { state, isLoading, isError, refetch, repay, isRepaying, error, clearError } = useCardRepay(
    { enabled, chainId },
  );

  const confirmRepay = useCallback(
    async (request: CardRepayRequest) => {
      // `repay` resolves null when the signature prompt was dismissed, which is not a failure
      // and must not move the sheet — the cardholder is still deciding. A real failure has
      // already been recorded as `error`, which the step shows.
      const result = await repay(request).catch(() => null);
      if (!result) return false;

      const returned = result.returnedCollateral
        .map(item => `${formatRepayTokenAmount(item.amount, item.decimals)} ${item.displaySymbol}`)
        .join(' and ');
      // `explorerUrls` has no Base entry; viem's is Basescan, as card transactions link to.
      const explorer =
        explorerUrls[chainId]?.blockscout ??
        (chainId === base.id ? base.blockExplorers.default.url : undefined);

      Toast.show({
        type: 'success',
        text1: result.isFull ? 'Loan repaid' : `Repaid ${formatUsd(result.repayUsd)}`,
        text2: returned ? `${returned} is back in your wallet` : undefined,
        props: explorer
          ? {
              link: `${explorer}/tx/${result.transactionHash}`,
              linkText: eclipseAddress(result.transactionHash),
            }
          : undefined,
      });
      return true;
    },
    [chainId, repay],
  );

  return useMemo<BorrowPositionRepay>(
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

/**
 * The borrow position, opened by tapping the card on the card screen, and the repay step
 * behind each loan's Repay button.
 *
 * Owns the repayments: the content is presentation, and this is where a chosen amount becomes
 * a signature — on Fuse for the Fuse loan, on Base for the Base one.
 */
const BorrowPositionSheet = ({ isOpen, onOpenChange }: BorrowPositionSheetProps) => {
  // The per-instance read runs only while the sheet is open, as before.
  const figures = useCreditModeFigures({ enabled: isOpen });
  const owesOnBase = figures.positions.some(position => position.chainId === base.id);

  // Read only while the sheet is open. The card screen mounts this for everyone it shows the
  // position card to, and two multicalls on every visit buy nothing until Repay is in reach —
  // and Base's only once there is a Base loan to repay.
  const fuseRepay = useInstanceRepay(fuse.id, isOpen);
  const baseRepay = useInstanceRepay(base.id, isOpen && owesOnBase);
  const repays = useMemo(
    () => ({ [fuse.id]: fuseRepay, [base.id]: baseRepay }),
    [fuseRepay, baseRepay],
  );

  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="borrow-position"
      designTop={BORROW_POSITION_SHEET_TOP}
      designBottom={BORROW_POSITION_SHEET_BOTTOM}
      scrollable
    >
      {({ session, topPadding, presentation }) => (
        <BorrowPositionSheetContent
          figures={figures}
          onDismiss={dismiss}
          repays={repays}
          session={session}
          topPadding={topPadding}
          presentation={presentation}
        />
      )}
    </CardBottomSheet>
  );
};

export default BorrowPositionSheet;
