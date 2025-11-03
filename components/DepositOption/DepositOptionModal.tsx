import ResponsiveModal from '@/components/ResponsiveModal';
import { DEPOSIT_MODAL } from '@/constants/modals';
import useDepositOption, { DepositOptionProps } from '@/hooks/useDepositOption';
import { useDimension } from '@/hooks/useDimension';
import { useDepositStore } from '@/store/useDepositStore';

const DepositOptionModal = ({
  buttonText = 'Add funds',
  trigger,
  modal = DEPOSIT_MODAL.OPEN_OPTIONS,
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
  } = useDepositOption({ buttonText, trigger, modal });
  const { currentModal, previousModal } = useDepositStore();
  const { isScreenMedium } = useDimension();

  if (isScreenMedium) {
    return (
      <ResponsiveModal
        currentModal={currentModal}
        previousModal={previousModal}
        isOpen={shouldOpen}
        onOpenChange={handleOpenChange}
        trigger={getTrigger()}
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

  return getTrigger();
};

export default DepositOptionModal;
