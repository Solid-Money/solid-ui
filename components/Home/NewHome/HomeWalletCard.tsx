import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import {
  CARD_BODY_BLEED_PERCENT,
  CARD_BODY_WIDTH_RATIO,
  CARD_BOTTOM_SHADOW_RATIO,
  CARD_TOP_SHADOW_RATIO,
  getCardHeroDestination,
} from '@/components/Card/NewCardDetails/cardHeroLayout';
import { HERO_EXIT, HeroExit } from '@/components/Card/NewCardDetails/heroMotion';
import NewCardArt, { NEW_CARD_ASPECT_RATIO } from '@/components/Card/NewCardDetails/NewCardArt';
import {
  SPEND_MODE_COPY,
  type SpendMode,
} from '@/components/Card/NewCardDetails/SpendMode/spendModes';
import CardWaitingModal from '@/components/Home/CardWaitingModal';
import { usePageLeft } from '@/components/Navbar/Sidebar';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { isKycAwaitingDecision } from '@/lib/utils/kyc/verificationProgress';
import { useCardHeroStore } from '@/store/useCardHeroStore';
import { useCardPaneStore } from '@/store/useCardPaneStore';

interface HomeWalletCardProps {
  /** When true the card links to card details; otherwise it's shown but inert. */
  hasCard: boolean;
  /** Last 4 digits shown on the card's glyph badge (omitted when unknown). */
  last4?: string;
  /** Whether the user has already funded their account (deposit step). */
  depositCompleted: boolean;
  /**
   * Whether a CTA banner is rendered directly below (see `HomePromptCard`).
   *
   * When one is, the cardless "Get your card" strip is dropped: the banner is
   * the labelled next step now, and repeating it under the card said the same
   * thing twice — or, on the review and declined banners, said something the
   * banner directly contradicts. The art stays tappable either way, so the
   * setup prompt is still one tap from here.
   */
  hasCtaBanner?: boolean;
  /**
   * The cardholder's spend mode, when the "Spend mode" strip should show under the card
   * (Figma 26134:22854) — or null to leave the card on its own.
   *
   * The caller decides, from `useSpendModeFigures().canChangeMode`: a Wirex cardholder with
   * working card spending on a build that can reach v2. Everyone else has one way to fund
   * the card and nothing to change, so the strip would be a control with nothing behind it.
   */
  spendMode?: SpendMode | null;
}

const CARD_BODY_ASPECT_RATIO =
  CARD_BODY_WIDTH_RATIO /
  (1 / NEW_CARD_ASPECT_RATIO - CARD_TOP_SHADOW_RATIO - CARD_BOTTOM_SHADOW_RATIO);
const GET_CARD_PANEL_WIDTH = 387;
const GET_CARD_PANEL_HEIGHT = 140;
// Let the card cover 10px more of the panel, shortening the empty space above
// the CTA without changing its bottom padding.
const GET_CARD_PANEL_COVER = 98;
const GET_CARD_CTA_TOP_GAP = 8;
const GET_CARD_LABEL_BOTTOM = 13;
/**
 * The "Spend mode" strip (Figma 26134:22854): a 387x138 panel whose top 80pt sits
 * behind the card, leaving a 58pt strip below it. Unlike the cardless panel above,
 * these are held in points rather than scaled with the width — the strip carries a
 * row of 16pt text and a toggle, and scaled up to the desktop column it grew to twice
 * the height its contents need.
 */
const SPEND_MODE_PANEL_HEIGHT = 138;
const SPEND_MODE_PANEL_COVER = 80;
const SPEND_MODE_STRIP_HEIGHT = SPEND_MODE_PANEL_HEIGHT - SPEND_MODE_PANEL_COVER;
/** The toggle's bottom edge; both labels end 2pt above it (y 120 against 122). */
const SPEND_MODE_ROW_BOTTOM = 16;
const SPEND_MODE_TOGGLE_WIDTH = 40;
const SPEND_MODE_TOGGLE_HEIGHT = 24;
const SPEND_MODE_KNOB_SIZE = 20;
const SPEND_MODE_KNOB_INSET = 2;
const GET_CARD_PANEL_ASPECT_RATIO = GET_CARD_PANEL_WIDTH / GET_CARD_PANEL_HEIGHT;
const CARDLESS_STACK_ASPECT_RATIO =
  GET_CARD_PANEL_WIDTH /
  (GET_CARD_PANEL_WIDTH / CARD_BODY_ASPECT_RATIO +
    GET_CARD_PANEL_HEIGHT -
    GET_CARD_PANEL_COVER +
    GET_CARD_CTA_TOP_GAP);

/**
 * The merged green VISA Platinum "glass" card shown on the wallet page. Always
 * displayed; only opens the card-details pane once the user actually has a card.
 *
 * Tapping is a state change on this same screen — no navigation — so the card can
 * start flying on the tap's own frame with nothing mounting underneath it. Without a
 * card, tapping instead opens the same "Your card is waiting" verification prompt as
 * HomeVerificationCard.
 *
 * The cardless "Get your card" strip is the fallback entry point, shown only when
 * no CTA banner is — see `hasCtaBanner`.
 */
const HomeWalletCard = ({
  hasCard,
  last4,
  depositCompleted,
  hasCtaBanner,
  spendMode = null,
}: HomeWalletCardProps) => {
  const start = useCardHeroStore(state => state.start);
  const heroActive = useCardHeroStore(state => state.active);
  const openPane = useCardPaneStore(state => state.open);
  const openSpendMode = useCardPaneStore(state => state.openSpendMode);
  const isPaneOpen = useCardPaneStore(state => state.isOpen);
  const ref = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // On desktop the pane the card flies to is a column beside the sidebar, not the
  // whole window.
  const pageLeft = usePageLeft();
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const { firstIncomplete } = useHomeSetupSteps(depositCompleted);
  const { data: cardStatus } = useCardStatus();
  // Verification already submitted, decision still out — for either issuer.
  const awaitingKycDecision = isKycAwaitingDecision(cardStatus);

  const card = <NewCardArt last4={last4} />;

  /**
   * Tapping the card with no card yet.
   *
   * Someone who has already submitted their verification is sent straight to the
   * "your card is on its way" screen. The "Your card is waiting → Verify now"
   * prompt is the wrong thing to put in front of them: its CTA starts card
   * onboarding, which for an applicant mid-decision means country selection and
   * a fresh KYC session — asking them to redo work they have finished.
   */
  const handleCardlessPress = () => {
    if (awaitingKycDecision) {
      track(TRACKING_EVENTS.CARD_GET_CARD_PRESSED, {
        source: 'home_wallet_card',
        kycStatus: cardStatus?.kycStatus,
        rainApplicationStatus: cardStatus?.rainApplicationStatus,
      });
      router.push(path.CARD_ACTIVATE);
      return;
    }
    setIsVerificationOpen(true);
  };

  if (!hasCard) {
    return (
      <View>
        <Pressable
          accessibilityLabel={awaitingKycDecision ? 'Your card is on its way' : 'Get your card'}
          accessibilityRole="button"
          onPress={handleCardlessPress}
          className="px-4"
        >
          {hasCtaBanner ? (
            // The banner below is the labelled next step, so the card stands on
            // its own — the same frame the cardholder layout uses, with no stack
            // reserving room for a strip that isn't there.
            <View style={styles.cardBodyFrame}>
              {/* The artwork bleeds outside this frame for its baked-in shadow.
                  Keep that visual overflow from becoming a hit target over the
                  action buttons above. */}
              <View pointerEvents="none" style={styles.cardBox}>
                {card}
              </View>
            </View>
          ) : (
            <View style={styles.cardlessStack}>
              <View
                className="items-center justify-end overflow-hidden bg-card"
                style={styles.getCardPanel}
              >
                <View className="flex-row items-center gap-2" style={styles.getCardLabel}>
                  {/* The strip is the fallback entry point, so it is also what an
                      applicant mid-decision sees once they have snoozed the CTA
                      banner. "Get your card" would be the wrong invitation there;
                      this is the banner's own copy for the same rung. */}
                  <Text className="text-[16px] font-medium text-white" style={styles.getCardText}>
                    {awaitingKycDecision ? 'Your card is on its way' : 'Get your card'}
                  </Text>
                  <Image
                    source={getAsset('images/get-your-card-chevron.svg')}
                    style={styles.getCardChevron}
                    contentFit="fill"
                  />
                </View>
              </View>
              <View style={[styles.cardBodyFrame, styles.cardlessCardBodyFrame]}>
                {/* Same shadow-overflow guard as above. */}
                <View pointerEvents="none" style={styles.cardBox}>
                  {card}
                </View>
              </View>
            </View>
          )}
        </Pressable>
        <CardWaitingModal
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          firstIncomplete={firstIncomplete}
        />
      </View>
    );
  }

  /**
   * Fly the card up into the pane. With `withSpendMode` the pane also puts the
   * spend-mode sheet up once the card lands — the strip under the card is a shortcut to
   * that sheet, and it takes the same flight so the card page it opens over is the one
   * the cardholder watched arrive.
   */
  const flyToPane = (withSpendMode: boolean) => {
    const open = withSpendMode ? openSpendMode : openPane;
    const node = ref.current;
    if (!node) {
      open();
      return;
    }
    // Both directions must use the overlay's root coordinate system.
    const openFromRect = (x: number, y: number, width: number, height: number) => {
      if (!width || !height) {
        open();
        return;
      }
      const from = { x, y, width, height };
      // The destination is computed rather than reported by the pane, so the flight
      // starts on this frame instead of waiting on a layout pass. Preserve the
      // measured card centre: on desktop web the page scrollbar makes the wallet's
      // usable body slightly narrower than the absolute details pane.
      start(
        from,
        getCardHeroDestination({
          windowWidth,
          topInset: insets.top,
          pageLeft,
          centerX: x + width / 2,
        }),
        last4 ?? '',
      );
      open(from);
    };

    if (Platform.OS === 'android') {
      // Android measureInWindow subtracts the visible-window/status-bar offset.
      // The absolute overlay and predicted details rect are root-relative, so
      // use measure's page coordinates to avoid a status-bar-sized jump.
      node.measure((_x, _y, width, height, pageX, pageY) => {
        openFromRect(pageX, pageY, width, height);
      });
    } else {
      node.measureInWindow(openFromRect);
    }
  };

  const isCardHidden = heroActive || isPaneOpen;

  if (spendMode) {
    const isCreditOn = spendMode !== 'cash';
    const modeLabel = SPEND_MODE_COPY[spendMode].label;

    return (
      <View className="px-4">
        <View style={styles.spendModeStack}>
          {/* Behind the card, and leaving with the section below it rather than with the
              card: only the card is handed to the flight, so the strip fades and lifts
              like everything else under it instead of vanishing on the tap. */}
          <HeroExit spec={HERO_EXIT.belowCard} style={styles.spendModePanel}>
            <Pressable
              accessibilityLabel={`Spend mode: ${modeLabel}. Change spend mode`}
              accessibilityRole="button"
              className="flex-1 overflow-hidden rounded-[23px] bg-card active:opacity-80"
              onPress={() => flyToPane(true)}
              style={styles.spendModeRow}
            >
              <View style={styles.spendModeLabel}>
                <Text className="text-[16px] font-medium text-white" style={styles.stripText}>
                  Spend mode
                </Text>
                <Image
                  source={getAsset('images/get-your-card-chevron.svg')}
                  style={styles.spendModeChevron}
                  contentFit="fill"
                />
              </View>
              <View style={styles.spendModeValue}>
                <Text
                  className="text-[16px] font-medium text-white"
                  style={[styles.stripText, styles.spendModeValueText]}
                >
                  {modeLabel}
                </Text>
                {/* Whether the card can borrow: on for Credit and Smart, off for Cash. It
                    reports the mode rather than switching it — the strip opens the
                    spend-mode sheet, which is where a change is made and signed. */}
                <View style={styles.spendModeToggle}>
                  <View
                    style={[
                      styles.spendModeKnob,
                      {
                        left: isCreditOn
                          ? SPEND_MODE_TOGGLE_WIDTH - SPEND_MODE_KNOB_SIZE - SPEND_MODE_KNOB_INSET
                          : SPEND_MODE_KNOB_INSET,
                      },
                    ]}
                  />
                </View>
              </View>
            </Pressable>
          </HeroExit>
          <Pressable
            onPress={() => flyToPane(false)}
            style={[styles.cardBodyFrame, isCardHidden && styles.hidden]}
          >
            <View ref={ref} collapsable={false} pointerEvents="none" style={styles.cardBox}>
              {card}
            </View>
          </Pressable>
          {/* Reserves the strip's height in the layout; taps fall through to it. */}
          <View pointerEvents="none" style={styles.spendModeStripSpace} />
        </View>
      </View>
    );
  }

  return (
    // Hidden for as long as the pane owns the card — while it flies, and while the
    // pane is open — so no copy is left behind under the (background-less) pane.
    <Pressable
      onPress={() => flyToPane(false)}
      className="px-4"
      style={isCardHidden ? styles.hidden : undefined}
    >
      {/* The measured node is the artwork box, not this gutter — the hero flight's
          `from` rect has to be the same box getCardHeroDestination predicts. */}
      <View style={styles.cardBodyFrame}>
        {/* Only the Pressable's visible-card frame should be interactive. The
            artwork itself extends upward for its transparent shadow padding. */}
        <View ref={ref} collapsable={false} pointerEvents="none" style={styles.cardBox}>
          {card}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // The frame represents only the visible green card body. The artwork is positioned
  // inside it with its baked-in shadow extending beyond the frame, so surrounding
  // layout gaps are measured from the visible edges on every side.
  cardBodyFrame: { aspectRatio: CARD_BODY_ASPECT_RATIO, position: 'relative', zIndex: 1 },
  cardBox: {
    left: `${-CARD_BODY_BLEED_PERCENT}%`,
    marginTop: `${-(CARD_TOP_SHADOW_RATIO / CARD_BODY_WIDTH_RATIO) * 100}%`,
    position: 'absolute',
    width: `${(1 / CARD_BODY_WIDTH_RATIO) * 100}%`,
  },
  // Figma 22024:3490 is a 387x140 panel. Most of it sits behind the card, leaving
  // only the compact CTA strip peeking out below it.
  cardlessStack: { aspectRatio: CARDLESS_STACK_ASPECT_RATIO, position: 'relative' },
  cardlessCardBodyFrame: { left: 0, position: 'absolute', right: 0, top: 0 },
  getCardPanel: {
    aspectRatio: GET_CARD_PANEL_ASPECT_RATIO,
    bottom: 0,
    borderRadius: 23,
    left: 0,
    paddingBottom: `${(GET_CARD_LABEL_BOTTOM / GET_CARD_PANEL_WIDTH) * 100}%`,
    position: 'absolute',
    right: 0,
  },
  getCardLabel: { minHeight: 23, transform: [{ translateY: -2 }] },
  getCardText: { fontFamily: 'MonaSans_500Medium', lineHeight: 23 },
  getCardChevron: { height: 12, width: 7 },
  // Figma 26134:22854 — see SPEND_MODE_PANEL_HEIGHT.
  spendModeStack: { position: 'relative' },
  spendModePanel: {
    bottom: 0,
    height: SPEND_MODE_PANEL_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  spendModeStripSpace: { height: SPEND_MODE_STRIP_HEIGHT },
  // Bottom-aligned so each item's bottom edge lands where Figma puts it: the toggle
  // 16pt above the panel's edge, the two 23pt label boxes 2pt above that.
  spendModeRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: SPEND_MODE_ROW_BOTTOM,
    paddingLeft: 17,
    paddingRight: 16,
  },
  spendModeLabel: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 2 },
  // The chevron's box sits 1.5pt below the label's centre line (y 105–115 in a 97–120
  // row), which is where the design draws it.
  spendModeChevron: { height: 11.5, marginTop: 3, width: 6.81066 },
  spendModeValue: { alignItems: 'flex-end', flexDirection: 'row', gap: 10 },
  spendModeValueText: { marginBottom: 2 },
  spendModeToggle: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: SPEND_MODE_TOGGLE_HEIGHT / 2,
    height: SPEND_MODE_TOGGLE_HEIGHT,
    width: SPEND_MODE_TOGGLE_WIDTH,
  },
  spendModeKnob: {
    backgroundColor: '#FFFFFF',
    borderRadius: SPEND_MODE_KNOB_SIZE / 2,
    height: SPEND_MODE_KNOB_SIZE,
    position: 'absolute',
    top: SPEND_MODE_KNOB_INSET,
    width: SPEND_MODE_KNOB_SIZE,
  },
  stripText: { fontFamily: 'MonaSans_500Medium', lineHeight: 23 },
  hidden: { opacity: 0 },
});

export default HomeWalletCard;
