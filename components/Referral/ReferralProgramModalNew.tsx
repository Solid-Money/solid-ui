import ReferralProgramContentNew from '@/components/Referral/ReferralProgramContentNew';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';

interface ReferralProgramModalNewProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODAL_STATE: ModalState = { name: 'referral-program-new', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Redesigned referral program popup (see {@link ReferralProgramContentNew}), used from
 * {@link RewardsScreenNew}. Content owns its own scroll view and close button (like
 * {@link CardWaitingModal}) rather than the default header chrome, since it's a full
 * page of content rather than a compact popup.
 */
export default function ReferralProgramModalNew({ isOpen, onClose }: ReferralProgramModalNewProps) {
  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      trigger={null}
      contentKey="referral-program-new"
      contentClassName="bg-background px-0 pb-0 pt-0 md:max-w-lg md:px-0 md:pt-0"
      shouldAnimate={false}
      hideHeader
      disableScroll
      fillViewportHeight
      containerClassName="gap-0"
    >
      <ReferralProgramContentNew onClose={onClose} />
    </ResponsiveModal>
  );
}
