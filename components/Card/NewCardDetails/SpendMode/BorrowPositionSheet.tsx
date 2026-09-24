import { useCallback, useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { fuse } from 'viem/chains';

import BorrowPositionSheetContent, {
  BORROW_POSITION_SHEET_BOTTOM,
  BORROW_POSITION_SHEET_TOP,
  type BorrowPositionRepay,
} from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheetContent';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import useSpendModeFigures from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { formatUsd } from '@/constants/cardSpendModule';
import { explorerUrls } from '@/constants/explorers';
import { type CardRepayRequest, useCardRepay } from '@/hooks/useCardRepay';
import { eclipseAddress } from '@/lib/utils';
import { formatRepayTokenAmount } from '@/lib/utils/cardRepay';

interface BorrowPositionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The borrow position, opened by tapping the card on the card screen, and the repay step
 * behind its Repay button.
 *
 * Owns the repayment: the content is presentation, and this is where a chosen amount becomes
 * a signature. The sheet stays open on failure with the reason, because a silently closed
 * sheet reads as success, and on success slides back to the position so the new figures are
 * what the cardholder sees next.
 */
const BorrowPositionSheet = ({ isOpen, onOpenChange }: BorrowPositionSheetProps) => {
  const figures = useSpendModeFigures();
  // Read only while the sheet is open. The card screen mounts this for everyone it shows the
  // position card to, and two multicalls on every visit buy nothing until Repay is in reach.
  const { state, isLoading, isError, refetch, repay, isRepaying, error, clearError } = useCardRepay(
    { enabled: isOpen },
  );
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

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
      const explorer = explorerUrls[fuse.id]?.blockscout;

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
    [repay],
  );

  const repayProps = useMemo<BorrowPositionRepay>(
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

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="borrow-position"
      designTop={BORROW_POSITION_SHEET_TOP}
      designBottom={BORROW_POSITION_SHEET_BOTTOM}
    >
      {({ session, topPadding, presentation }) => (
        <BorrowPositionSheetContent
          figures={figures}
          onDismiss={dismiss}
          repay={repayProps}
          session={session}
          topPadding={topPadding}
          presentation={presentation}
        />
      )}
    </CardBottomSheet>
  );
};

export default BorrowPositionSheet;
