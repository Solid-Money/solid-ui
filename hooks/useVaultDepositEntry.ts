import { useCallback, useMemo } from 'react';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { VAULTS } from '@/constants/vaults';
import { useCardProvider } from '@/hooks/useCardProvider';
import { DepositModal, VaultType } from '@/lib/types';
import { usesNewDepositDesign } from '@/lib/utils/cardHelpers';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

/**
 * Which deposit flow the savings screens' Deposit button opens, and the state it
 * needs primed.
 *
 * Two flows, chosen by issuer (see {@link usesNewDepositDesign}). They are not
 * two skins of one screen — they put money in by different routes, which is why
 * each needs its own setup:
 *
 * - The redesigned one sends *new* money in: pick a currency, then a chain, then
 *   send to an address the backend mints for that pairing. So `depositFromSolid`
 *   is off and any address left from an earlier deposit is cleared, or the flow
 *   opens on a stale QR for a chain the user has moved off.
 * - The older one moves a balance the user already holds in Solid, so
 *   `depositFromSolid` is on and it opens straight onto the amount form.
 *
 * Both pre-select the vault whose screen the button was pressed on; without it
 * the flow deposits into whichever vault was last chosen somewhere else.
 */
export const useVaultDepositEntry = (
  vaultType: VaultType,
): { modal: DepositModal; onBeforeOpen: () => void } => {
  const { provider } = useCardProvider();
  const isNewDesign = usesNewDepositDesign(provider);

  const onBeforeOpen = useCallback(() => {
    const index = VAULTS.findIndex(vault => vault.type === vaultType);
    if (index >= 0) {
      useSavingStore.getState().selectVaultForDeposit(index);
    }

    const store = useDepositStore.getState();
    if (isNewDesign) {
      store.setDepositFromSolid(false);
      store.setSavingsFundIntent('savings');
      store.clearDirectDepositSession();
      return;
    }

    store.setDepositFromSolid(true);
  }, [isNewDesign, vaultType]);

  return useMemo(
    () => ({
      modal: isNewDesign ? DEPOSIT_MODAL.OPEN_SAVINGS_FUND : DEPOSIT_MODAL.OPEN_FORM,
      onBeforeOpen,
    }),
    [isNewDesign, onBeforeOpen],
  );
};
