import { useCallback, useMemo } from 'react';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import SpendModeSheetContent, {
  SPEND_MODE_SHEET_BOTTOM,
  SPEND_MODE_SHEET_TOP,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheetContent';
import { useCreditModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { useSpendableAssetRows } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import { useSpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { useBaseSpendMode } from '@/hooks/useCardCreditPositions';
import { useCardSpendRegistration } from '@/hooks/useCardSpendRegistration';
import { useCardDisplayCurrency } from '@/hooks/useMainCurrency';

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
  isSuspended,
  onOpenChange,
  onHelpPress,
  onViewCreditDetails,
  activeMode = 'cash',
  initialMode = activeMode,
  onAddFunds,
  onEditOrder,
}: SpendModeSheetProps) => {
  const figures = useSpendModeFigures();
  // The combined loan figures for Fuse and Base, read while the sheet is open.
  const credit = useCreditModeFigures({ enabled: isOpen && !isSuspended });
  // Base's own mode, so a switch that reached Fuse alone can be finished from here.
  const baseMode = useBaseSpendMode({ enabled: isOpen && !isSuspended });
  const retryBase = useCallback(() => void baseMode.refetch(), [baseMode]);
  const { switchMode, isSwitchingMode, error } = useCardSpendRegistration();
  // The assets the balance is made of — EURC among them once it is on for the card.
  const assets = useSpendableAssetRows();
  const { formatUsdAmount } = useCardDisplayCurrency();

  const balance = useMemo(
    () => ({
      // In the cardholder's main currency; the rows below keep each asset's own.
      total: formatUsdAmount(assets.totalUsd),
      rows: assets.rows,
    }),
    [assets, formatUsdAmount],
  );

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
      isSuspended={isSuspended}
      onOpenChange={onOpenChange}
      contentKey="spend-mode"
      designTop={SPEND_MODE_SHEET_TOP}
      designBottom={SPEND_MODE_SHEET_BOTTOM}
    >
      {({ session, topPadding, presentation }) => (
        <SpendModeSheetContent
          activeMode={activeMode}
          baseMode={baseMode.mode}
          isBaseChecking={baseMode.isLoading}
          isBaseUnreadable={baseMode.isError}
          onRetryBase={retryBase}
          initialMode={initialMode}
          figures={figures}
          credit={credit}
          balance={balance}
          session={session}
          onConfirm={confirm}
          isSwitching={isSwitchingMode}
          error={error}
          onDismiss={dismiss}
          onHelpPress={onHelpPress}
          onViewCreditDetails={onViewCreditDetails}
          onAddFunds={onAddFunds}
          onEditOrder={onEditOrder}
          topPadding={topPadding}
          presentation={presentation}
        />
      )}
    </CardBottomSheet>
  );
};

export default SpendModeSheet;
