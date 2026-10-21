import { useCallback, useMemo } from 'react';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import SpendModeSheetContent, {
  SPEND_MODE_SHEET_BOTTOM,
  SPEND_MODE_SHEET_TOP,
} from '@/components/Card/NewCardDetails/SpendMode/SpendModeSheetContent';
import { useCreditModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { useSpendableAssetRows } from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import useSpendModeFigures from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';
import { ONE_USD } from '@/constants/cardSpendModule';
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
  onOpenChange,
  onHelpPress,
  activeMode = 'cash',
  onAddFunds,
}: SpendModeSheetProps) => {
  const figures = useSpendModeFigures();
  // Fuse and Base together, with the collateral behind each — read only while the sheet is open.
  const credit = useCreditModeFigures({ enabled: isOpen });
  const { switchMode, isSwitchingMode, error } = useCardSpendRegistration();
  // The assets the balance is made of — EURC among them once it is on for the card.
  const assets = useSpendableAssetRows();
  const { formatMicroUsd, formatUsdAmount } = useCardDisplayCurrency();

  const balance = useMemo(() => {
    const dollarMicro = BigInt(Math.max(0, Math.round(assets.dollarUsd * Number(ONE_USD))));
    return {
      // In the cardholder's main currency; the rows below keep each asset's own.
      total: formatUsdAmount(assets.totalUsd),
      // Cash pays a dollar purchase from the Fuse set alone — a euro balance only pays euro
      // purchases — so the segment quotes that, and tells an empty card what to do instead.
      cash: dollarMicro > 0n ? formatMicroUsd(dollarMicro) : 'Add funds',
      rows: assets.rows,
    };
  }, [assets, formatMicroUsd, formatUsdAmount]);

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
      {({ session, topPadding, presentation }) => (
        <SpendModeSheetContent
          activeMode={activeMode}
          figures={figures}
          credit={credit}
          balance={balance}
          session={session}
          onConfirm={confirm}
          isSwitching={isSwitchingMode}
          error={error}
          onDismiss={dismiss}
          onHelpPress={onHelpPress}
          onAddFunds={onAddFunds}
          topPadding={topPadding}
          presentation={presentation}
        />
      )}
    </CardBottomSheet>
  );
};

export default SpendModeSheet;
