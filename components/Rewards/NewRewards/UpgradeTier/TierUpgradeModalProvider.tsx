import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { isTierUpgradeOpen, useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import LockTokenSelector from './LockTokenSelector';
import UpgradeReviewContent from './UpgradeReviewContent';
import UpgradeTierContent from './UpgradeTierContent';

/**
 * The tier upgrade flow, as one modal mounted once at the app root.
 *
 * Both steps used to be routes, pushed from the rewards screen, the benefits
 * pager and Earn. Every one of those is a page the user is in the middle of
 * reading, and taking the whole screen away to price an upgrade they may not
 * buy is a worse trade than a card over the top of it — which is how the rest
 * of the app asks for a decision. Closing the modal puts them back exactly
 * where they were, with no back stack to unwind.
 *
 * Mounted at the root rather than per screen, like `UnstakeModalProvider`: two
 * of those screens can be mounted at once, and a modal each is two overlays.
 */
const TierUpgradeModalProvider = () => {
  const { currentModal, previousModal } = useTierUpgradeStore(
    useShallow(state => ({
      currentModal: state.currentModal,
      previousModal: state.previousModal,
    })),
  );
  const isOpen = useTierUpgradeStore(isTierUpgradeOpen);
  const back = useTierUpgradeStore(state => state.back);
  const close = useTierUpgradeStore(state => state.close);

  const isReview = currentModal.name === TIER_UPGRADE_MODAL.OPEN_REVIEW.name;
  const isTokenSelector = currentModal.name === TIER_UPGRADE_MODAL.OPEN_TOKEN_SELECTOR.name;

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) close();
      }}
      trigger={null}
      title={isTokenSelector ? 'Select token' : 'Upgrade tier'}
      // Both the review and the picker are steps, not destinations: the back
      // arrow returns to the offer rather than closing the flow, which is the
      // one thing a user who has just read a one-year commitment — or opened
      // the picker to compare balances — is most likely to want.
      showBackButton={isReview || isTokenSelector}
      onBackPress={back}
      contentKey={currentModal.name}
      contentClassName="md:max-w-[480px]"
      gradientHeader={!isReview && !isTokenSelector}
    >
      {isReview ? (
        <UpgradeReviewContent />
      ) : isTokenSelector ? (
        <LockTokenSelector />
      ) : (
        <UpgradeTierContent />
      )}
    </ResponsiveModal>
  );
};

export default TierUpgradeModalProvider;
