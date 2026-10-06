import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import ResponsiveModal from '@/components/ResponsiveModal';
import { TIER_UPGRADE_MODAL } from '@/constants/modals';
import { isTierUpgradeOpen, useTierUpgradeStore } from '@/store/useTierUpgradeStore';

import LockTokenSelector from './LockTokenSelector';
import UpgradeReviewContent from './UpgradeReviewContent';
import UpgradeTierContent from './UpgradeTierContent';

import type { TierUpgradeRoute } from '@/lib/tierUpgrade';

const LOCK_ROUTE_SCROLL_DURATION_MS = 550;

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
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToBottomAfterLayout = useRef(false);
  const scrollMetrics = useRef({ offset: 0, viewportHeight: 0, contentHeight: 0 });
  const scrollPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = scrollPosition.addListener(({ value }) => {
      scrollViewRef.current?.scrollTo({ y: value, animated: false });
    });
    return () => {
      scrollPosition.stopAnimation();
      scrollPosition.removeListener(listener);
    };
  }, [scrollPosition]);

  useEffect(() => {
    scrollToBottomAfterLayout.current = false;
    scrollPosition.stopAnimation();
  }, [currentModal.name, scrollPosition]);

  const slideToBottom = () => {
    const { offset, viewportHeight, contentHeight } = scrollMetrics.current;
    scrollPosition.stopAnimation();
    scrollPosition.setValue(offset);
    Animated.timing(scrollPosition, {
      toValue: Math.max(0, contentHeight - viewportHeight),
      duration: LOCK_ROUTE_SCROLL_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handleRouteSelected = (route: TierUpgradeRoute, changed: boolean) => {
    scrollToBottomAfterLayout.current = route === 'lock' && changed;
    if (route === 'lock' && !changed) {
      slideToBottom();
    } else {
      scrollPosition.stopAnimation();
    }
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    scrollMetrics.current.contentHeight = height;
    if (!scrollToBottomAfterLayout.current) return;
    // Wait for the lock rows to expand before measuring the scroll destination.
    scrollToBottomAfterLayout.current = false;
    slideToBottom();
  };

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
      scrollViewRef={scrollViewRef}
      scrollViewProps={{
        onContentSizeChange: handleContentSizeChange,
        onLayout: event => {
          scrollMetrics.current.viewportHeight = event.nativeEvent.layout.height;
        },
        onScroll: event => {
          scrollMetrics.current.offset = event.nativeEvent.contentOffset.y;
        },
        onScrollBeginDrag: () => scrollPosition.stopAnimation(),
      }}
    >
      {isReview ? (
        <UpgradeReviewContent />
      ) : isTokenSelector ? (
        <LockTokenSelector />
      ) : (
        <UpgradeTierContent onRouteSelected={handleRouteSelected} />
      )}
    </ResponsiveModal>
  );
};

export default TierUpgradeModalProvider;
