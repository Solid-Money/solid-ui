import { useCallback } from 'react';

import BorrowPositionSheetContent, {
  BORROW_POSITION_SHEET_BOTTOM,
  BORROW_POSITION_SHEET_TOP,
} from '@/components/Card/NewCardDetails/SpendMode/BorrowPositionSheetContent';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import useSpendModeFigures from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

interface BorrowPositionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The borrow position, opened by tapping the card on the card screen. */
const BorrowPositionSheet = ({ isOpen, onOpenChange }: BorrowPositionSheetProps) => {
  const figures = useSpendModeFigures();
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="borrow-position"
      designTop={BORROW_POSITION_SHEET_TOP}
      designBottom={BORROW_POSITION_SHEET_BOTTOM}
    >
      {({ topPadding }) => (
        <BorrowPositionSheetContent figures={figures} onDismiss={dismiss} topPadding={topPadding} />
      )}
    </CardBottomSheet>
  );
};

export default BorrowPositionSheet;
