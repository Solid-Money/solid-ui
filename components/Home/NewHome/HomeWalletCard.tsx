import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';
import { useCardHeroStore } from '@/store/useCardHeroStore';

// Intrinsic size of assets/images/visa-platinum-card.png (includes the card's
// drop shadow), used to render the artwork full-width without distortion.
const CARD_ASPECT_RATIO = 838 / 555;

interface HomeWalletCardProps {
  /** When true the card links to card details; otherwise it's shown but inert. */
  hasCard: boolean;
}

/**
 * The merged green VISA Platinum "glass" card shown on the wallet page. Always
 * displayed; only navigates to the card management page (/card/details) once the
 * user actually has a card. On tap it records its window rect (useCardHeroStore)
 * so the card-details screen can animate the card up from here.
 */
const HomeWalletCard = ({ hasCard }: HomeWalletCardProps) => {
  const router = useRouter();
  const setFromRect = useCardHeroStore(state => state.setFromRect);
  const ref = useRef<View>(null);

  const card = (
    <Image
      source={getAsset('images/visa-platinum-card.png')}
      alt="Solid VISA Platinum card"
      style={{ width: '100%', aspectRatio: CARD_ASPECT_RATIO }}
      contentFit="contain"
    />
  );

  if (!hasCard) {
    return card;
  }

  const handlePress = () => {
    const node = ref.current;
    if (!node) {
      router.push(path.CARD_DETAILS);
      return;
    }
    // Capture the card's position, then navigate (measureInWindow is async).
    node.measureInWindow((x, y, width, height) => {
      if (width && height) {
        setFromRect({ x, y, width, height });
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
