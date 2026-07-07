import ReferralProgramContent from '@/components/Referral/ReferralProgramContent';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';

interface ReferralProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODAL_STATE: ModalState = { name: 'referral-program', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Referral program popup. Opened from {@link ReferralProgramBanner}, the Settings
 * "Refer & Earn" row, or the `/rewards?referral=open` deep link.
 *
 * Rendered through {@link ResponsiveModal} so it reuses the shared modal chrome
 * (header, close button, scroll fade) like every other popup.
 */
export default function ReferralProgramModal({ isOpen, onClose }: ReferralProgramModalProps) {
  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      trigger={null}
      title="Referral Program"
      contentKey="referral-program"
      contentClassName="md:max-w-lg"
      shouldAnimate={false}
    >
      <ReferralProgramContent onClose={onClose} />
    </ResponsiveModal>
  );
}
