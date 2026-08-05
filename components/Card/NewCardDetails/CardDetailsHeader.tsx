import { Pressable, StyleSheet, View } from 'react-native';

import {
  HEADER_BUTTON_SIZE,
  HEADER_TOP_PADDING,
} from '@/components/Card/NewCardDetails/cardHeroLayout';
import { HERO_ENTER, HeroEnter } from '@/components/Card/NewCardDetails/heroMotion';
import { BackCircleIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';

interface CardDetailsHeaderProps {
  /** Dismisses the pane — it's a layer on the wallet screen, not a route. */
  onBack: () => void;
}

/**
 * Mobile header of the card-details pane: a 44pt circular back button on the left
 * and a centred "Solid card" title (Figma 20095:5396 / 20095:5761). Both fade +
 * settle in behind the flying card.
 */
const CardDetailsHeader = ({ onBack }: CardDetailsHeaderProps) => {
  return (
    <View style={styles.header}>
      <HeroEnter spec={HERO_ENTER.back}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
          className="items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80"
        >
          <BackCircleIcon />
        </Pressable>
      </HeroEnter>
      <HeroEnter spec={HERO_ENTER.title} style={styles.title}>
        <Text className="text-center text-[20px] font-semibold text-white" numberOfLines={1}>
          Solid card
        </Text>
      </HeroEnter>
    </View>
  );
};

const styles = StyleSheet.create({
  // Figma: back button at y=59 with a 44pt status bar above it → 15pt below the
  // safe area, and the row is exactly as tall as the button. Shared with
  // getCardHeroDestination, which predicts where the card lands under this header.
  header: { paddingHorizontal: 16, paddingTop: HEADER_TOP_PADDING },
  backButton: { height: HEADER_BUTTON_SIZE, width: HEADER_BUTTON_SIZE },
  // Centred across the full width (not between the button and the right edge).
  title: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 60,
    position: 'absolute',
    right: 60,
    top: HEADER_TOP_PADDING,
  },
});

export default CardDetailsHeader;
