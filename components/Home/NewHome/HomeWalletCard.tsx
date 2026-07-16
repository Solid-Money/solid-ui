import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { path } from '@/constants/path';
import { getAsset } from '@/lib/assets';

// Intrinsic size of assets/images/visa-platinum-card.png (includes the card's
// drop shadow), used to render the artwork full-width without distortion.
const CARD_ASPECT_RATIO = 838 / 555;

/**
 * The merged green VISA Platinum "glass" card shown on the wallet page. Tapping
 * it opens the full card management page (/card/details). The card artwork —
 * including the "•••" menu glyph and the "VISA Platinum" wordmark — is baked
 * into the image (assets/images/visa-platinum-card.png).
 */
const HomeWalletCard = () => {
  const router = useRouter();

  return (
    <Pressable onPress={() => router.push(path.CARD_DETAILS)}>
      <Image
        source={getAsset('images/visa-platinum-card.png')}
        alt="Solid VISA Platinum card"
        style={{ width: '100%', aspectRatio: CARD_ASPECT_RATIO }}
        contentFit="contain"
      />
    </Pressable>
  );
};

export default HomeWalletCard;
