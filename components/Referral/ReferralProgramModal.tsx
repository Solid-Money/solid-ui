import ReferralProgramContent from '@/components/Referral/ReferralProgramContent';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';

interface ReferralProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODAL_STATE: ModalState = { name: 'referral-program', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

/**
 * Popup presentation of the `/referral-program` page. Shown when a user taps
 * {@link ReferralProgramBanner} or the Settings "Refer & Earn" row instead of
 * navigating to the route. The route
 * (`app/(protected)/(tabs)/referral-program.tsx`) still renders the same content
 * for deep links and fallback navigation.
 *
 * Rendered through {@link ResponsiveModal} so it reuses the shared modal chrome
 * and top/bottom scroll fades. `hideHeader` is set because
 * {@link ReferralProgramContent} renders its own header and close button.
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
      contentKey="referral-program"
      contentClassName="overflow-hidden p-0 md:max-w-lg md:p-0"
      containerClassName="gap-0"
      shouldAnimate={false}
      hideHeader
    >
      <ReferralProgramContent onClose={onClose} />
    </ResponsiveModal>
  );
}
