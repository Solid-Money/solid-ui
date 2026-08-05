import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import CardWelcomePopup from '@/components/Card/CardWelcomePopup';
import CardActionsRow from '@/components/Card/NewCardDetails/CardActionsRow';
import CardCashbackCard from '@/components/Card/NewCardDetails/CardCashbackCard';
import CardDetailsHeader from '@/components/Card/NewCardDetails/CardDetailsHeader';
import { getCardHeroDestination } from '@/components/Card/NewCardDetails/cardHeroLayout';
import CardLinksList from '@/components/Card/NewCardDetails/CardLinksList';
import CardRevealSection from '@/components/Card/NewCardDetails/CardRevealSection';
import { HERO_ENTER, HeroEnter } from '@/components/Card/NewCardDetails/heroMotion';
import { usePageLeft } from '@/components/Navbar/Sidebar';
import CashbackDetailsSheet from '@/components/Rewards/NewRewards/CashbackDetailsSheet';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useCustomer } from '@/hooks/useCustomer';
import { useRewardsUserData } from '@/hooks/useRewards';
import { freezeCard, unfreezeCard } from '@/lib/api';
import { CardStatus, FreezeInitiator, KycStatus } from '@/lib/types';
import { useCardHeroStore } from '@/store/useCardHeroStore';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useCardWelcomePopupStore } from '@/store/useCardWelcomePopupStore';

/**
 * How long to keep the pane on screen after it's been dismissed: long enough for the
 * slowest section to animate out (600ms) and the card to land back on the wallet.
 */
const CLOSE_SETTLE_MS = 640;

/**
 * The card-details surface (Figma 20095:5393), rendered as a layer on the wallet
 * screen rather than a route of its own.
 *
 * It used to be `/card/details`. Pushing a screen meant mounting one — a scroll
 * view, four sections and their queries — on the JS thread at exactly the moment
 * the card was supposed to be gliding into place, and no amount of tuning the
 * animation fixed the stutter that caused. Here the tree is already mounted and
 * opening is a state change, so the transition has nothing to wait for.
 *
 * Deliberately has no background: the wallet content animates out underneath while
 * these sections animate in, both over the one app background, which is exactly
 * what the design's timeline describes.
 */
const CardDetailsPane = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // On desktop this pane is a column beside the sidebar, not the whole window.
  const pageLeft = usePageLeft();
  const isOpen = useCardPaneStore(state => state.isOpen);
  const originRect = useCardPaneStore(state => state.originRect);
  const closePane = useCardPaneStore(state => state.close);
  const startFlight = useCardHeroStore(state => state.start);

  // Shown here rather than on the old details route: card issuance sets this flag
  // and sends the user to /card/details, which on mobile now lands on this pane.
  const shouldShowWelcomePopup = useCardWelcomePopupStore(state => state.shouldShowWelcomePopup);
  const setShouldShowWelcomePopup = useCardWelcomePopupStore(
    state => state.setShouldShowWelcomePopup,
  );

  const { data: cardDetails, refetch } = useCardDetails();
  const { data: cardStatus } = useCardStatus();
  const { data: customer } = useCustomer();
  const { data: rewardsData } = useRewardsUserData();
  const { provider } = useCardProvider();
  const [isFreezing, setIsFreezing] = useState(false);
  // Held true through the dismissal, so the sections have something to animate out
  // of; without it `isOpen` going false would yank the pane off screen instantly.
  const [isSettling, setIsSettling] = useState(false);
  const hasOpened = useRef(false);
  // Laid out (invisibly) once the wallet screen has settled, so the first open costs
  // no more than the ones after it.
  const [isWarm, setIsWarm] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setIsWarm(true));
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (isOpen) {
      hasOpened.current = true;
      setIsSettling(false);
      // Always open at the top: the card's landing position is computed rather than
      // measured, so a scroll position left over from a previous visit would put the
      // real card somewhere the clone isn't flying to.
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    // Nothing to settle if it was never opened, or the pane would sit visible for the
    // settle window on startup.
    if (!hasOpened.current) return;
    setIsSettling(true);
    const timer = setTimeout(() => setIsSettling(false), CLOSE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Visible the instant it opens — deriving it rather than waiting on an effect keeps
  // the sections' entrance from starting a frame behind.
  const isVisible = isOpen || isSettling;

  const isCardFrozen = cardDetails?.status === CardStatus.FROZEN;
  const canUnfreeze =
    isCardFrozen && cardDetails?.freezes?.some(f => f.initiator === FreezeInitiator.CUSTOMER);
  const isCustomerPausedOrOffboarded =
    customer?.status === KycStatus.PAUSED || customer?.status === KycStatus.OFFBOARDED;

  /**
   * Dismiss: fly the card back to where it came from, then let the pane's sections
   * animate out and the wallet's animate back in. `originRect` is null when the pane
   * was opened by a deep link rather than a tap, in which case there's nowhere to
   * fly back to and it simply closes.
   */
  const close = useCallback(() => {
    if (originRect) {
      startFlight(
        getCardHeroDestination({ windowWidth, topInset: insets.top, pageLeft }),
        originRect,
        cardDetails?.card_details?.last_4 ?? '',
      );
    }
    closePane();
  }, [originRect, startFlight, windowWidth, pageLeft, insets.top, cardDetails, closePane]);

  // Android's hardware back closes the pane, matching what the header's back button
  // does — without this it would leave the wallet screen entirely.
  useEffect(() => {
    if (Platform.OS !== 'android' || !isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, close]);

  const handleFreezeToggle = useCallback(async () => {
    try {
      setIsFreezing(true);
      await (isCardFrozen ? unfreezeCard() : freezeCard());
      await refetch();
    } catch {
      Alert.alert(
        'Error',
        `Failed to ${isCardFrozen ? 'unfreeze' : 'freeze'} card. Please try again.`,
      );
    } finally {
      setIsFreezing(false);
    }
  }, [isCardFrozen, refetch]);

  const handleGetMoreCashback = useCallback(() => {
    closePane();
    router.push(path.REWARDS_BENEFITS);
  }, [closePane]);

  const cashbackThisMonth = rewardsData?.cashbackThisMonth ?? 0;
  const allTimeCashback = Math.max(cardDetails?.cashback?.totalUsdValue ?? 0, cashbackThisMonth);

  return (
    // Three states: cold (out of layout, so it costs the wallet screen nothing at
    // startup), warm (laid out but transparent and untouchable, ready to open
    // instantly), and visible.
    <View
      pointerEvents={isOpen ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        styles.layer,
        !isVisible && !isWarm && styles.cold,
        !isVisible && styles.warm,
      ]}
    >
      {/* Same column as the content below, so the back button doesn't drift out to
          the edge of the desktop body area. */}
      <View className="mx-auto w-full max-w-lg" style={{ paddingTop: insets.top }}>
        <CardDetailsHeader onBack={close} />
      </View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View className="mx-auto w-full max-w-lg px-4">
          <CardRevealSection
            last4={cardDetails?.card_details?.last_4}
            cardholderName={cardDetails?.cardholder_name}
            provider={provider}
            // The card's own issuing country, falling back to the KYC residence
            // country the status endpoint reports (it's absent for test overrides).
            issuingCountryCode={cardDetails?.issuing_country ?? cardStatus?.country}
          />
          <HeroEnter spec={HERO_ENTER.actions} style={styles.actionsRow}>
            <CardActionsRow
              isCardFrozen={isCardFrozen}
              canUnfreeze={!!canUnfreeze}
              isFreezing={isFreezing}
              onFreezeToggle={handleFreezeToggle}
              canAddFunds={!isCardFrozen && !isCustomerPausedOrOffboarded}
            />
          </HeroEnter>
          <HeroEnter spec={HERO_ENTER.cashback} style={styles.cashbackCard}>
            <CashbackDetailsSheet
              trigger={<CardCashbackCard />}
              triggerContainerClassName="w-full"
              cashbackRate={rewardsData?.cashbackRate ?? 0}
              cashbackThisMonth={cashbackThisMonth}
              maxCashbackMonthly={rewardsData?.maxCashbackMonthly ?? 0}
              allTimeCashback={allTimeCashback}
              onGetMoreCashback={handleGetMoreCashback}
            />
          </HeroEnter>
          <HeroEnter spec={HERO_ENTER.links} style={styles.linksList}>
            <CardLinksList />
          </HeroEnter>
          <View className="h-32" />
        </View>
      </ScrollView>
      <CardWelcomePopup
        isOpen={isOpen && shouldShowWelcomePopup}
        onClose={() => setShouldShowWelcomePopup(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Above PageLayout's mobile navbar overlay (zIndex 50), which would otherwise
  // paint over this pane's header and eat the taps meant for its back button.
  layer: { zIndex: 60 },
  cold: { display: 'none' },
  warm: { opacity: 0 },
  // Figma vertical rhythm: 51 from the panel to the action icons, 45 to the cashback
  // card, 20 to the links list.
  actionsRow: { marginTop: 51 },
  cashbackCard: { marginTop: 45 },
  linksList: { marginTop: 20 },
});

export default CardDetailsPane;
