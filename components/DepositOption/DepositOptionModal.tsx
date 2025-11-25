import ResponsiveModal from '@/components/ResponsiveModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useDepositOption, { DepositOptionProps } from '@/hooks/useDepositOption';
import { useDimension } from '@/hooks/useDimension';
import { useDepositStore } from '@/store/useDepositStore';

const DepositOptionModal = ({
  buttonText = 'Add funds',
  trigger,
  modal = DEPOSIT_MODAL.OPEN_OPTIONS,
  fillContainer = false,
}: DepositOptionProps) => {
  const {
    shouldOpen,
    showBackButton,
    actionButton,
    shouldAnimate,
    isForward,
    getTrigger,
    getContent,
    getContentKey,
    getTitle,
    getContentClassName,
    getContainerClassName,
    handleOpenChange,
    handleBackPress,
  } = useDepositOption({ buttonText, trigger, modal, fillContainer });
  const { currentModal, previousModal } = useDepositStore();
  const { isScreenMedium } = useDimension();

  if (isScreenMedium) {
    return (
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={shouldOpen}
        onOpenChange={handleOpenChange}
        trigger={trigger === null ? null : getTrigger()}
        title={getTitle()}
        contentClassName={getContentClassName()}
        containerClassName={getContainerClassName()}
        showBackButton={showBackButton}
        onBackPress={handleBackPress}
        actionButton={actionButton}
        shouldAnimate={shouldAnimate}
        isForward={isForward}
        contentKey={getContentKey()}
      >
        {getContent()}
      </ResponsiveModal>
    );
  }

  // On mobile, hide trigger if explicitly set to null (for hidden modals)
  return trigger === null ? null : getTrigger();
};

export default DepositOptionModal;
