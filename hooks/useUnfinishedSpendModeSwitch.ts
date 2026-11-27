import { useBaseSpendMode } from '@/hooks/useCardCreditPositions';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';

import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

/**
 * Whether Base kept its old mode after a switch that reached Fuse alone.
 *
 * The same test the spend-mode sheet makes before it offers to finish the change: Base answered,
 * its mode is not the card's, and no Fuse switch is still armed.
 */
export const isSpendModeSwitchUnfinished = (
  mode: SpendMode,
  baseMode: SpendMode | null,
  pendingMode: SpendMode | null,
): baseMode is SpendMode => !!baseMode && baseMode !== mode && !pendingMode;

/**
 * A spend-mode switch that only half-finished, or null when there is none to report.
 *
 * The card's mode is read from Fuse, so a switch that reached Fuse and not Base looks finished
 * everywhere outside the spend-mode sheet: the cardholder sees the new mode while part of their
 * balance still spends by the old one. This is what lets a screen say so and send them to the
 * sheet, which finishes the change.
 *
 * Null while Base has not answered, or could not be read: only a mode Base really reported is
 * worth a warning. The read is the sheet's own (same query key), so it is not made twice.
 */
export const useUnfinishedSpendModeSwitch = (): { mode: SpendMode; baseMode: SpendMode } | null => {
  const { mode, pendingMode, canChangeMode } = useCardSpendRegistration();
  const { mode: baseMode } = useBaseSpendMode({ enabled: canChangeMode });

  return canChangeMode && isSpendModeSwitchUnfinished(mode, baseMode, pendingMode)
    ? { mode, baseMode }
    : null;
};

export default useUnfinishedSpendModeSwitch;
