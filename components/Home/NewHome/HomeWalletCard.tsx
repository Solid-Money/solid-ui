import { useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CARD_BODY_BLEED_PERCENT,
  getCardHeroDestination,
} from '@/components/Card/NewCardDetails/cardHeroLayout';
import NewCardArt from '@/components/Card/NewCardDetails/NewCardArt';
import CardWaitingModal from '@/components/Home/CardWaitingModal';
import { usePageLeft } from '@/components/Navbar/Sidebar';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';
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
      <>
        <Pressable onPress={() => setIsVerificationOpen(true)} className="px-4">
          <View style={styles.cardBox}>{card}</View>
        </Pressable>
        <CardWaitingModal
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          firstIncomplete={firstIncomplete}
        />
      </>
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
      <View ref={ref} collapsable={false} style={styles.cardBox}>
        {card}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // The artwork bakes a drop shadow into each side, so a box the width of the content
  // column draws a card visibly narrower than the sections around it. Sitting in the
  // same px-4 gutter and bleeding back out by the shadow's share lines the visible
  // card up with them exactly.
  cardBox: { marginHorizontal: `${-CARD_BODY_BLEED_PERCENT}%` },
  hidden: { opacity: 0 },
});

export default HomeWalletCard;
