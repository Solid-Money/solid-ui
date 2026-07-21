import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardGlyphBadge from '@/components/Card/NewCardDetails/CardGlyphBadge';
import { getAsset } from '@/lib/assets';

// Intrinsic size of the (glyph-removed) VISA Platinum artwork, including its
// baked-in drop shadow, so it renders full-width without distortion.
export const NEW_CARD_ASPECT_RATIO = 861 / 555;

interface NewCardArtProps {
  /** Last 4 digits shown on the glyph badge (front only). */
  last4?: string;
  /**
   * Optional overlay rendered instead of the glyph badge — used for the flipped
   * "reveal" face (card number / expiry / CVV). When omitted, the glyph badge is
   * shown (the normal front face).
   */
  overlay?: ReactNode;
}

/**
 * The redesigned VISA Platinum card visual: the green artwork with the glass
 * glyph oval on top. Shared by the home wallet card, the card-details screen,
 * and the hero-transition clone so the card looks identical everywhere (which is
 * what makes the shared-element transition read as one card).
 */
const NewCardArt = ({ last4, overlay }: NewCardArtProps) => {
  return (
    <View style={styles.box}>
      <Image
        source={getAsset('images/visa-platinum-card.png')}
        alt="Solid VISA Platinum card"
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      {overlay ?? <CardGlyphBadge last4={last4} />}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: NEW_CARD_ASPECT_RATIO },
});

export default NewCardArt;
