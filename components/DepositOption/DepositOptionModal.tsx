import { DEPOSIT_MODAL } from '@/constants/modals';
import { DepositModal } from '@/lib/types';

import DepositTrigger from './DepositTrigger';

interface DepositOptionModalProps {
  buttonText?: string;
  trigger?: React.ReactNode;
  modal?: DepositModal;
}

/**
 * DepositOptionModal - now a thin wrapper around DepositTrigger.
 *
 * The actual modal is rendered by DepositModalProvider at the app root.
 * This component only renders the trigger button to open the modal.
 *
 * For headless usage (trigger={null}), this component renders nothing
 * since the global DepositModalProvider handles the modal state.
 */
const DepositOptionModal = ({
  buttonText = 'Add funds',
  trigger,
  modal = DEPOSIT_MODAL.OPEN_VAULT_SELECTOR,
}: DepositOptionModalProps) => {
  // Headless usage - the global DepositModalProvider handles the modal
  if (trigger === null) {
    return null;
  }

  return <DepositTrigger buttonText={buttonText} trigger={trigger} modal={modal} />;
};

export default DepositOptionModal;
