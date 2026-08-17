import ResponsiveModal from '@/components/ResponsiveModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { DepositModal } from '@/lib/types';

import { VirtualAccountApplyModal } from './VirtualAccountApplyModal';

interface VirtualAccountApplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestDepositModal?: (modal: DepositModal) => void;
}

/**
 * A separate dialog for the virtual-account pitch. Keeping it outside the
 * deposit flow's single modal state lets the deposit picker remain mounted
 * underneath and reappear when this dialog closes.
 */
const VirtualAccountApplyDialog = ({
  isOpen,
  onClose,
  onRequestDepositModal,
}: VirtualAccountApplyDialogProps) => (
  <ResponsiveModal
    currentModal={DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_APPLY}
    previousModal={DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE}
    isOpen={isOpen}
    onOpenChange={open => {
      if (!open) onClose();
    }}
    trigger={null}
    contentKey="virtual-account-apply-overlay"
    shouldAnimate={false}
    hideHeader
    disableScroll
    fillViewportHeight
    containerClassName="gap-0"
    contentClassName="mt-0 overflow-hidden bg-[#111] px-0 pb-0 pt-0 md:h-[90vh] md:w-screen md:max-w-lg md:!px-0 md:!pt-0"
  >
    <VirtualAccountApplyModal onClose={onClose} onRequestDepositModal={onRequestDepositModal} />
  </ResponsiveModal>
);

export default VirtualAccountApplyDialog;
