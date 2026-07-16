import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';

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
 * user actually has a card. The card artwork — including the "•••" menu glyph and
 * the "VISA Platinum" wordmark — is baked into the image.
 */
const HomeWalletCard = ({ hasCard }: HomeWalletCardProps) => {
  const router = useRouter();

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

  return <Pressable onPress={() => router.push(path.CARD_DETAILS)}>{card}</Pressable>;
};

export default HomeWalletCard;
