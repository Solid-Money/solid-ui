import { useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import {
  CARD_BODY_BLEED_PERCENT,
  CARD_BODY_WIDTH_RATIO,
  CARD_BOTTOM_SHADOW_RATIO,
  CARD_TOP_SHADOW_RATIO,
  getCardHeroDestination,
} from '@/components/Card/NewCardDetails/cardHeroLayout';
import NewCardArt, { NEW_CARD_ASPECT_RATIO } from '@/components/Card/NewCardDetails/NewCardArt';
import CardWaitingModal from '@/components/Home/CardWaitingModal';
import { usePageLeft } from '@/components/Navbar/Sidebar';
import { Text } from '@/components/ui/text';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';
import { getAsset } from '@/lib/assets';
import { useCardHeroStore } from '@/store/useCardHeroStore';
import { useCardPaneStore } from '@/store/useCardPaneStore';

interface HomeWalletCardProps {
  /** When true the card links to card details; otherwise it's shown but inert. */
  hasCard: boolean;
  /** Last 4 digits shown on the card's glyph badge (omitted when unknown). */
  last4?: string;
  /** Whether the user has already funded their account (deposit step). */
  depositCompleted: boolean;
}

const CARD_BODY_ASPECT_RATIO =
  CARD_BODY_WIDTH_RATIO /
  (1 / NEW_CARD_ASPECT_RATIO - CARD_TOP_SHADOW_RATIO - CARD_BOTTOM_SHADOW_RATIO);
const GET_CARD_PANEL_WIDTH = 387;
const GET_CARD_PANEL_HEIGHT = 140;
const GET_CARD_PANEL_COVER = 88;
const GET_CARD_LABEL_BOTTOM = 13;
const GET_CARD_PANEL_ASPECT_RATIO = GET_CARD_PANEL_WIDTH / GET_CARD_PANEL_HEIGHT;
const CARDLESS_STACK_ASPECT_RATIO =
  GET_CARD_PANEL_WIDTH /
  (GET_CARD_PANEL_WIDTH / CARD_BODY_ASPECT_RATIO + GET_CARD_PANEL_HEIGHT - GET_CARD_PANEL_COVER);

/**
 * The merged green VISA Platinum "glass" card shown on the wallet page. Always
 * displayed; only opens the card-details pane once the user actually has a card.
 *
 * Tapping is a state change on this same screen — no navigation — so the card can
 * start flying on the tap's own frame with nothing mounting underneath it. Without a
 * card, tapping instead opens the same "Your card is waiting" verification prompt as
 * HomeVerificationCard.
 */
const HomeWalletCard = ({ hasCard, last4, depositCompleted }: HomeWalletCardProps) => {
  const start = useCardHeroStore(state => state.start);
  const heroActive = useCardHeroStore(state => state.active);
  const openPane = useCardPaneStore(state => state.open);
  const isPaneOpen = useCardPaneStore(state => state.isOpen);
  const ref = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // On desktop the pane the card flies to is a column beside the sidebar, not the
  // whole window.
  const pageLeft = usePageLeft();
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const { firstIncomplete } = useHomeSetupSteps(depositCompleted);

  const card = <NewCardArt last4={last4} />;

  if (!hasCard) {
    return (
      <View>
        <Pressable
          accessibilityLabel="Get your card"
          accessibilityRole="button"
          onPress={() => setIsVerificationOpen(true)}
          className="px-4"
        >
          <View style={styles.cardlessStack}>
            <View
              className="items-center justify-end overflow-hidden bg-card"
              style={styles.getCardPanel}
            >
              <View className="flex-row items-center gap-2" style={styles.getCardLabel}>
                <Text className="text-[16px] font-medium text-white" style={styles.getCardText}>
                  Get your card
                </Text>
                <Image
                  source={getAsset('images/get-your-card-chevron.svg')}
                  style={styles.getCardChevron}
                  contentFit="fill"
                />
              </View>
            </View>
            <View style={[styles.cardBodyFrame, styles.cardlessCardBodyFrame]}>
              <View style={styles.cardBox}>{card}</View>
            </View>
          </View>
        </Pressable>
        <CardWaitingModal
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          firstIncomplete={firstIncomplete}
        />
      </View>
    );
  }

  const handlePress = () => {
    const node = ref.current;
    if (!node) {
      openPane();
      return;
    }
    // measureInWindow is async, so the open happens from its callback. The card's
    // live position is needed both to fly from and, later, to fly back to.
    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) {
        openPane();
        return;
      }
      const from = { x, y, width, height };
      // The destination is computed rather than reported by the pane, so the flight
      // starts on this frame instead of waiting on a layout pass.
      start(
        from,
        getCardHeroDestination({ windowWidth, topInset: insets.top, pageLeft }),
        last4 ?? '',
      );
      openPane(from);
    });
  };

  return (
    // Hidden for as long as the pane owns the card — while it flies, and while the
    // pane is open — so no copy is left behind under the (background-less) pane.
    <Pressable
      onPress={handlePress}
      className="px-4"
      style={heroActive || isPaneOpen ? styles.hidden : undefined}
    >
      {/* The measured node is the artwork box, not this gutter — the hero flight's
          `from` rect has to be the same box getCardHeroDestination predicts. */}
      <View style={styles.cardBodyFrame}>
        <View ref={ref} collapsable={false} style={styles.cardBox}>
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
  hidden: { opacity: 0 },
});

export default HomeWalletCard;
