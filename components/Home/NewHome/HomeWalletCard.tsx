import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import NewCardArt from '@/components/Card/NewCardDetails/NewCardArt';
import { path } from '@/constants/path';
import { useCardHeroStore } from '@/store/useCardHeroStore';

interface HomeWalletCardProps {
  /** When true the card links to card details; otherwise it's shown but inert. */
  hasCard: boolean;
  /** Last 4 digits shown on the card's glyph badge (omitted when unknown). */
  last4?: string;
}

/**
 * The merged green VISA Platinum "glass" card shown on the wallet page. Always
 * displayed; only navigates to the card management page (/card/details) once the
 * user actually has a card. On tap it records its window rect and starts a hero
 * transition (useCardHeroStore) so the card flies up to the card-details screen.
 */
const HomeWalletCard = ({ hasCard, last4 }: HomeWalletCardProps) => {
  const router = useRouter();
  const start = useCardHeroStore(state => state.start);
  const ref = useRef<View>(null);

  const card = <NewCardArt last4={last4} />;

  if (!hasCard) {
    return card;
  }

  const handlePress = () => {
    const node = ref.current;
    if (!node) {
      router.push(path.CARD_DETAILS);
      return;
    }
    // Capture the card's position, start the hero, then navigate
    // (measureInWindow is async, so navigate from its callback).
    node.measureInWindow((x, y, width, height) => {
      if (width && height) {
        start({ x, y, width, height }, last4 ?? '');
      }
      router.push(path.CARD_DETAILS);
    });
  };

  return (
    <Pressable ref={ref} collapsable={false} onPress={handlePress}>
      {card}
    </Pressable>
  );
};

export default HomeWalletCard;
