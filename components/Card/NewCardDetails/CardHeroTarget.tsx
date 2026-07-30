import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCardHeroStore } from '@/store/useCardHeroStore';
import { useCardPaneStore } from '@/store/useCardPaneStore';

/**
 * Wraps the card inside the card-details pane and hides it whenever the pane doesn't
 * own the card — while the clone is in the air, and for the whole of a dismissal.
 *
 * Keying this on the flight alone wasn't enough. The pane stays up for a beat after
 * being dismissed so its sections can animate out, so the moment the flight ended
 * this card reappeared next to the wallet's own — two cards, until the pane finally
 * went. And a pane opened from a deep link has no card to fly, so there was no flight
 * to key off at all and both stayed up for the entire dismissal.
 *
 * It used to also measure itself and report where the clone should land. That's gone:
 * the destination is computed up front by getCardHeroDestination (verified to match
 * this layout exactly), which is what lets the flight start on the frame of the tap
 * instead of waiting for a layout pass. Measuring was also actively wrong once the
 * card started flying *back* on dismissal — it would have re-aimed the clone at the
 * pane it was leaving.
 */
const CardHeroTarget = ({ children }: { children: ReactNode }) => {
  const isFlying = useCardHeroStore(state => state.active);
  const isPaneOpen = useCardPaneStore(state => state.isOpen);

  return <View style={isFlying || !isPaneOpen ? styles.hidden : undefined}>{children}</View>;
};

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
});

export default CardHeroTarget;
