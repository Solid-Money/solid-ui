import ResponsiveModal from '@/components/ResponsiveModal';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import CreditLineBorrowForm from './CreditLineBorrowForm';
import CreditLineConfirm from './CreditLineConfirm';
import CreditLineHome from './CreditLineHome';
import CreditLineSuccess from './CreditLineSuccess';

/**
 * Global credit line (borrow against savings) modal provider. Renders a single
 * ResponsiveModal driven by useCreditLineStore. Open it from anywhere with
 * setModal(CREDIT_LINE_MODAL.OPEN_HOME).
 */
const CreditLineModalProvider = () => {
  const currentModal = useCreditLineStore(state => state.currentModal) ?? CREDIT_LINE_MODAL.CLOSE;
  const previousModal = useCreditLineStore(state => state.previousModal) ?? CREDIT_LINE_MODAL.CLOSE;
  const setModal = useCreditLineStore(state => state.setModal);

  const isClose = currentModal.name === CREDIT_LINE_MODAL.CLOSE.name;
  const isForm = currentModal.name === CREDIT_LINE_MODAL.OPEN_FORM.name;
  const isConfirm = currentModal.name === CREDIT_LINE_MODAL.OPEN_CONFIRM.name;
  const isSuccess = currentModal.name === CREDIT_LINE_MODAL.OPEN_SUCCESS.name;
  const shouldAnimate = previousModal.name !== CREDIT_LINE_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  // Success shows only the close button (no title), matching the design.
  const title = isSuccess ? undefined : 'Credit line';

  const getContent = () => {
    if (isForm) return <CreditLineBorrowForm />;
    if (isConfirm) return <CreditLineConfirm />;
    if (isSuccess) return <CreditLineSuccess />;
    return <CreditLineHome />;
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) setModal(CREDIT_LINE_MODAL.CLOSE);
  };

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={null}
      title={title}
      fillViewportHeight
      contentClassName="min-h-[48rem] md:pt-5"
      containerClassName="gap-4"
      contentKey={currentModal.name}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
    >
      {getContent()}
    </ResponsiveModal>
  );
};

export default CreditLineModalProvider;
