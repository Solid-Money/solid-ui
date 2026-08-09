import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { DepositModal } from '@/lib/types';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

export interface OpenDepositFlowOptions {
  /** Step the global deposit modal should open on. */
  modal?: DepositModal;
  /** Where the open came from (tracking only). */
  source?: string;
  /** Label of the control that opened it (tracking only). */
  buttonText?: string;
  /** When true, keeps the currently selected vault instead of resetting to USDC. */
  preserveSelectedVault?: boolean;
}

/**
 * Opens the global deposit modal (rendered by DepositModalProvider): resets the
 * vault/chain selection, applies the email gate and tracks the click.
 *
 * Extracted from DepositTrigger so callers that aren't a trigger — e.g. an
 * option inside another popup that must close first — can open the same flow
 * without duplicating the gate and tracking.
 */
export function useOpenDepositFlow() {
  const { user } = useUser();
  const { setModal, setSrcChainId } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setSrcChainId: state.setSrcChainId,
    })),
  );

  return useCallback(
    ({
      modal = DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE,
      source = 'unknown',
      buttonText = 'Add funds',
      preserveSelectedVault = false,
    }: OpenDepositFlowOptions = {}) => {
      if (!preserveSelectedVault) {
        useSavingStore.getState().selectVaultForDeposit(0);
      }
      setSrcChainId(0); // reset chain so modal always opens to options
      const needsEmail = !!user && !user.email;
      const modalToOpen = needsEmail ? DEPOSIT_MODAL.OPEN_EMAIL_GATE : modal;

      track(TRACKING_EVENTS.DEPOSIT_TRIGGER_CLICKED, {
        source,
        button_text: buttonText,
        has_email: !!user?.email,
        has_src_chain: false,
        modal_to_open: modalToOpen,
      });

      setModal(modalToOpen);
    },
    [user, setModal, setSrcChainId],
  );
}

export default useOpenDepositFlow;
