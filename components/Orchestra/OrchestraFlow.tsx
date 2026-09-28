import { OrchestraAmount } from '@/components/Orchestra/OrchestraAmount';
import { OrchestraError } from '@/components/Orchestra/OrchestraError';
import { OrchestraInvoice } from '@/components/Orchestra/OrchestraInvoice';
import {
  OrchestraNavigate,
  OrchestraNavigationProvider,
} from '@/components/Orchestra/OrchestraNavigation';
import { OrchestraOrderStatus } from '@/components/Orchestra/OrchestraOrderStatus';
import { DEPOSIT_MODAL } from '@/constants/modals';

import type { DepositModal } from '@/lib/types';

/**
 * The Cash App steps, rendered inside a host's own modal.
 *
 * The Add-funds modal renders these through useDepositOption instead; this is
 * for the card funding modals, which run the same steps in a different shell
 * and supply their own navigator. Every step calls useOrchestraNavigation
 * rather than the deposit store, which is what makes that substitution work.
 */
export const OrchestraFlowContent = ({
  modal,
  navigate,
}: {
  modal: DepositModal;
  navigate: OrchestraNavigate;
}) => (
  <OrchestraNavigationProvider navigate={navigate}>
    {modal.name === DEPOSIT_MODAL.OPEN_ORCHESTRA_INVOICE.name ? (
      <OrchestraInvoice />
    ) : modal.name === DEPOSIT_MODAL.OPEN_ORCHESTRA_STATUS.name ? (
      <OrchestraOrderStatus />
    ) : modal.name === DEPOSIT_MODAL.OPEN_ORCHESTRA_ERROR.name ? (
      <OrchestraError />
    ) : (
      <OrchestraAmount />
    )}
  </OrchestraNavigationProvider>
);

export default OrchestraFlowContent;
