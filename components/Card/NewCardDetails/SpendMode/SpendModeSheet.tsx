import { useCallback } from 'react';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import SpendModeSheetContent, {
  SPEND_MODE_SHEET_BOTTOM,
  SPEND_MODE_SHEET_TOP,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheetContent';
import useSpendModeFigures from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';

import type { SpendModeSheetProps } from './SpendModeSheet.types';
import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

/**
 * The spend-mode picker (Figma 25847:3581, 25961:3413, 25961:3538).
 *
 * Owns the commit: the content below is presentation, and this is where a chosen mode
 * becomes a signature. The sheet closes only once the change is on-chain, so a cardholder
 * never watches it dismiss and then finds the mode unchanged — and stays open on failure
 * with the reason, because a silently closed sheet reads as success.
 */
const SpendModeSheet = ({
  isOpen,
  onOpenChange,
  activeMode = 'cash',
  onAddFunds,
}: SpendModeSheetProps) => {
  const figures = useSpendModeFigures();
  const { switchMode, isSwitchingMode, error } = useCardSpendRegistration();

  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  const confirm = useCallback(
    async (mode: SpendMode) => {
      // `switchMode` resolves false when the signature prompt was dismissed, which is not
      // a failure and must not close the sheet — the cardholder is still deciding.
      const changed = await switchMode(mode).catch(() => false);
      if (changed) onOpenChange(false);
    },
    [switchMode, onOpenChange],
  );

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="spend-mode"
      designTop={SPEND_MODE_SHEET_TOP}
      designBottom={SPEND_MODE_SHEET_BOTTOM}
    >
      {({ session, topPadding }) => (
        <SpendModeSheetContent
          activeMode={activeMode}
          figures={figures}
          session={session}
          onConfirm={confirm}
          isSwitching={isSwitchingMode}
          error={error}
          onDismiss={dismiss}
          onAddFunds={onAddFunds}
          topPadding={topPadding}
        />
      )}
    </CardBottomSheet>
  );
};

export default SpendModeSheet;
